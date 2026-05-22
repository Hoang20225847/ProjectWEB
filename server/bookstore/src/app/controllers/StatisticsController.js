const Order = require('../models/Orders');
const Book = require('../models/Books');
const Category = require('../models/Category');
const StockMovement = require('../models/StockMovement');
const Review = require('../models/Review');
const AccountUser = require('../models/AccountUsers');
const mongoose = require('mongoose');
const { listPriceVndFromBookPrice } = require('../utils/moneyVnd');

function orderMatchForRevenue(req, dateRange = {}) {
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;
  const m = {
    status: { $ne: 'Đã hủy' },
    ...dateRange,
  };
  if (!isAdmin && userEmail) m.email = userEmail;
  return m;
}

/** Mọi trạng thái đơn — chỉ lọc theo người dùng + khoảng ngày (cho biểu đồ trạng thái / thanh toán) */
function orderMatchInDateRange(req, dateRange = {}) {
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;
  const m = { ...dateRange };
  if (!isAdmin && userEmail) m.email = userEmail;
  return m;
}

function normalizeDongValue(v) {
  const n = Number(v) || 0;
  if (n <= 0) return 0;
  return n < 1000 ? n * 1000 : n;
}

function listPriceVnd(raw) {
  return listPriceVndFromBookPrice(raw);
}

function memberRankByPoints(points) {
  if (points >= 3000) return 'Kim cương';
  if (points >= 1500) return 'Vàng';
  if (points >= 700) return 'Bạc';
  return 'Đồng';
}

/**
 * Join Book theo items.bookId — hỗ trợ ObjectId, chuỗi 24 hex, hoặc object { _id } (đơn từ cart cũ).
 * localField trực tiếp thất bại khi bookId là subdocument.
 */
function lookupBookForOrderLine(bookColl) {
  return {
    $lookup: {
      from: bookColl,
      let: { rawBid: '$items.bookId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: [
                '$_id',
                {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: [{ $type: '$$rawBid' }, 'objectId'] },
                        then: '$$rawBid',
                      },
                      {
                        case: { $eq: [{ $type: '$$rawBid' }, 'string'] },
                        then: {
                          $convert: {
                            input: '$$rawBid',
                            to: 'objectId',
                            onError: null,
                            onNull: null,
                          },
                        },
                      },
                      {
                        case: { $eq: [{ $type: '$$rawBid' }, 'object'] },
                        then: {
                          $convert: {
                            input: { $ifNull: ['$$rawBid._id', null] },
                            to: 'objectId',
                            onError: null,
                            onNull: null,
                          },
                        },
                      },
                    ],
                    default: null,
                  },
                },
              ],
            },
          },
        },
        { $project: { costPrice: 1 } },
        { $limit: 1 },
      ],
      as: '_b',
    },
  };
}

/**
 * Vốn theo phiếu xuất bán (stock_movements) có importPrice > 0, gắn đơn trong kỳ — khớp giá vốn lúc bán.
 * Bổ sung khi join Book trên đơn thiếu hoặc costPrice trên sách = 0 sau này.
 */
async function aggregateCogsFromSaleMovements(req, from, to) {
  const orderColl = Order.collection.collectionName;
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;

  const pipeline = [
    {
      $match: {
        type: 'sale',
        stockDirection: 'out',
        orderId: { $exists: true, $ne: null },
        importPrice: { $gt: 0 },
      },
    },
    {
      $lookup: {
        from: orderColl,
        localField: 'orderId',
        foreignField: '_id',
        as: '_ord',
      },
    },
    { $unwind: { path: '$_ord', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        '_ord.status': { $ne: 'Đã hủy' },
        '_ord.createdAt': { $gte: from, $lte: to },
      },
    },
  ];
  if (!isAdmin && userEmail) {
    pipeline.push({ $match: { '_ord.email': userEmail } });
  }
  pipeline.push({
    $group: {
      _id: null,
      cogs: {
        $sum: {
          $multiply: [
            { $convert: { input: '$quantity', to: 'double', onError: 0, onNull: 0 } },
            { $convert: { input: '$importPrice', to: 'double', onError: 0, onNull: 0 } },
          ],
        },
      },
    },
  });
  const [row] = await StockMovement.aggregate(pipeline);
  return Number(row?.cogs) || 0;
}

/** Doanh thu + COGS (max: dòng đơn vs biến động bán) + LN gộp trong kỳ */
async function computeFinancialSnapshot(req, from, to) {
  const match = orderMatchForRevenue(req, { createdAt: { $gte: from, $lte: to } });
  const bookColl = Book.collection.collectionName;

  const [tot] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const [cogRow] = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    lookupBookForOrderLine(bookColl),
    { $unwind: { path: '$_b', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        cogs: {
          $sum: {
            $multiply: [
              { $convert: { input: { $ifNull: ['$items.quantity', 0] }, to: 'double', onError: 0, onNull: 0 } },
              {
                $convert: {
                  input: { $ifNull: ['$items.unitImportCost', { $ifNull: ['$_b.costPrice', 0] }] },
                  to: 'double',
                  onError: 0,
                  onNull: 0,
                },
              },
            ],
          },
        },
      },
    },
  ]);

  const cogsOrd = Number(cogRow?.cogs) || 0;
  const cogsMov = await aggregateCogsFromSaleMovements(req, from, to);
  const cogs = Math.max(cogsOrd, cogsMov);

  const revenue = tot?.revenue || 0;
  const orderCount = tot?.orderCount || 0;
  const grossProfit = revenue - cogs;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  return { revenue, orderCount, cogs, grossProfit, marginPct, aov, cogsOrd, cogsMov };
}

class StatisticsController {
  async getUserDashboard(req, res, next) {
    try {
      const userEmail = req.user?.email || '';
      if (!userEmail) return res.status(401).json({ message: 'Không xác định được người dùng' });

      const [orders, account] = await Promise.all([
        Order.find({ email: userEmail }).populate({
          path: 'items.bookId',
          populate: { path: 'category', select: 'name' },
        }),
        AccountUser.findOne({ email: userEmail }).select('_id isMember'),
      ]);

      const allOrders = Array.isArray(orders) ? orders : [];
      const validOrders = allOrders.filter((o) => o?.status !== 'Đã hủy');
      const pendingOrders = allOrders.filter((o) => o?.status === 'Chờ xử lý').length;

      const totalOrders = allOrders.length;
      const totalSpend = validOrders.reduce((sum, o) => sum + normalizeDongValue(o?.totalAmount), 0);
      const booksPurchased = validOrders.reduce(
        (sum, o) => sum + (Array.isArray(o?.items) ? o.items.reduce((s, it) => s + (Number(it?.quantity) || 0), 0) : 0),
        0
      );

      const categoryCounter = new Map();
      validOrders.forEach((order) => {
        (order.items || []).forEach((it) => {
          const qty = Number(it?.quantity) || 0;
          if (qty <= 0) return;
          const catName = it?.bookId?.category?.name || 'Khác';
          categoryCounter.set(catName, (categoryCounter.get(catName) || 0) + qty);
        });
      });
      const totalCategoryQty = Array.from(categoryCounter.values()).reduce((a, b) => a + b, 0);
      const favoriteCategories = Array.from(categoryCounter.entries())
        .map(([name, quantity]) => ({
          name,
          quantity,
          percent: totalCategoryQty ? Math.round((quantity / totalCategoryQty) * 100) : 0,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 4);

      const now = new Date();
      const monthBuckets = [];
      for (let i = 3; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.push({ key, label: `T${d.getMonth() + 1}`, spend: 0 });
      }
      const monthIndex = new Map(monthBuckets.map((m, idx) => [m.key, idx]));
      validOrders.forEach((o) => {
        const d = new Date(o?.createdAt);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const idx = monthIndex.get(key);
        if (idx === undefined) return;
        monthBuckets[idx].spend += normalizeDongValue(o?.totalAmount);
      });

      const reviewedOrderIds = validOrders.filter((o) => o?.review).map((o) => o._id);
      const distinctReviewedBookIds = new Set();
      validOrders.forEach((o) => {
        (o.items || []).forEach((it) => {
          const bid = it?.bookId?._id ? String(it.bookId._id) : '';
          if (bid) distinctReviewedBookIds.add(bid);
        });
      });

      const reviews = await Review.find({ userId: account?._id || null }).select('evaluate');
      const reviewedCount = Array.isArray(reviews) ? reviews.length : 0;
      const avgRating =
        reviewedCount > 0
          ? Math.round((reviews.reduce((sum, r) => sum + (Number(r?.evaluate) || 0), 0) / reviewedCount) * 10) / 10
          : 0;

      const rewardPoints = Math.floor(totalSpend / 2000);
      const voucherAvailable = Math.floor(rewardPoints / 400);
      const memberRank = memberRankByPoints(rewardPoints);

      let savedMoney = 0;
      validOrders.forEach((o) => {
        (o.items || []).forEach((it) => {
          const qty = Number(it?.quantity) || 0;
          const paidUnit = normalizeDongValue(it?.price);
          const listUnit = listPriceVnd(it?.bookId?.price);
          if (qty > 0 && listUnit > 0 && listUnit > paidUnit) {
            savedMoney += (listUnit - paidUnit) * qty;
          }
        });
      });

      return res.status(200).json({
        orderOverview: {
          totalOrders,
          pendingOrders,
          totalSpend,
          booksPurchased,
        },
        favoriteCategories,
        monthlySpending: monthBuckets,
        readingStats: {
          reviewedCount,
          avgRating,
          purchasedDistinctBooks: distinctReviewedBookIds.size,
          reviewedOrders: reviewedOrderIds.length,
        },
        rewards: {
          points: rewardPoints,
          memberRank: account?.isMember ? memberRank : 'Chưa đăng ký',
          voucherAvailable,
          totalSaved: savedMoney,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Thống kê số đơn hàng theo tháng (12 tháng gần nhất) - theo user hiện tại
  async getMonthlyOrders(req, res, next) {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const isAdmin = req.user?.role === 'admin';
      const userEmail = req.user?.email;

      // Pipeline aggregation
      const matchStage = {
        createdAt: {
          $gte: new Date(`${targetYear}-01-01`),
          $lt: new Date(`${targetYear + 1}-01-01`)
        },
        status: { $ne: 'Đã hủy' }
      };
      if (!isAdmin && userEmail) {
        matchStage.email = userEmail;
      }

      const pipeline = [
        {
          $match: matchStage
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' }
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const results = await Order.aggregate(pipeline);

      // Đảm bảo đủ 12 tháng
      const monthlyData = [];
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${targetYear}-${month.toString().padStart(2, '0')}`;
        const found = results.find(r => r._id === monthKey);
        monthlyData.push({
          month: month,
          monthLabel: `Tháng ${month}`,
          count: found ? found.count : 0,
          revenue: found ? found.totalRevenue : 0
        });
      }

      res.status(200).json({
        year: targetYear,
        data: monthlyData
      });
    } catch (error) {
      next(error);
    }
  }

  // Thống kê chi tiêu theo thể loại (sách đã mua) - theo user hiện tại
  async getCategorySpending(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const isAdmin = req.user?.role === 'admin';
      const userEmail = req.user?.email;

      // Doanh thu theo danh mục: đơn chưa hủy (đồng bộ các báo cáo doanh thu)
      let matchStage = {
        status: { $ne: 'Đã hủy' },
      };
      if (!isAdmin && userEmail) {
        matchStage.email = userEmail;
      }

      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const orders = await Order.find(matchStage)
        .populate({
          path: 'items.bookId',
          select: 'name price category',
          populate: { path: 'category', select: 'name _id' },
        })
        .lean();

      const categoryIds = new Set();
      orders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const book = item.bookId;
          const cat = book?.category;
          if (!cat) return;
          if (typeof cat === 'object' && cat._id) categoryIds.add(String(cat._id));
          else if (typeof cat === 'string' && mongoose.Types.ObjectId.isValid(cat)) categoryIds.add(String(cat));
        });
      });
      const categories = categoryIds.size
        ? await Category.find({ _id: { $in: [...categoryIds] } }).select('_id name').lean()
        : [];
      const categoryNameById = new Map(categories.map((c) => [String(c._id), c.name]));

      const orderBookIds = new Set();
      orders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const raw = item?.bookId;
          if (!raw) return;
          if (typeof raw === 'string' && mongoose.Types.ObjectId.isValid(raw)) {
            orderBookIds.add(String(raw));
          } else if (raw && typeof raw === 'object' && raw._id && mongoose.Types.ObjectId.isValid(String(raw._id))) {
            orderBookIds.add(String(raw._id));
          }
        });
      });
      const booksWithCategory = orderBookIds.size
        ? await Book.find({ _id: { $in: [...orderBookIds] } })
            .select('_id category')
            .populate({ path: 'category', select: 'name _id' })
            .lean()
        : [];
      const categoryNameByBookId = new Map();
      booksWithCategory.forEach((b) => {
        const rawCat = b?.category;
        let catName = '';
        if (rawCat && typeof rawCat === 'object') {
          catName = String(rawCat.name || '').trim();
          if (!catName && rawCat._id) catName = categoryNameById.get(String(rawCat._id)) || '';
        } else if (typeof rawCat === 'string') {
          catName = categoryNameById.get(rawCat) || '';
        }
        if (catName) categoryNameByBookId.set(String(b._id), catName);
      });

      // Tính tổng chi tiêu theo category
      const categorySpending = {};

      orders.forEach(order => {
        order.items.forEach(item => {
          const book = item.bookId;
          if (!book) return;
          let categoryName = 'Không xác định';
          if (book.category && typeof book.category === 'object') {
            categoryName = book.category.name || categoryName;
            if (!book.category.name && book.category._id) {
              categoryName = categoryNameById.get(String(book.category._id)) || categoryName;
            }
          } else if (typeof book.category === 'string') {
            categoryName = categoryNameById.get(book.category) || categoryName;
          }
          const itemBookId =
            typeof book === 'string'
              ? book
              : book && typeof book === 'object' && book._id
              ? String(book._id)
              : '';
          if (categoryName === 'Không xác định' && itemBookId) {
            categoryName = categoryNameByBookId.get(itemBookId) || categoryName;
          }
          const itemTotal = Number(item.totalPrice) || (Number(item.quantity) * parseFloat(book.price || 0));

          if (!categorySpending[categoryName]) {
            categorySpending[categoryName] = {
              totalSpent: 0,
              quantity: 0
            };
          }
          categorySpending[categoryName].totalSpent += itemTotal;
          categorySpending[categoryName].quantity += item.quantity;
        });
      });

      // Chuyển thành array
      const result = Object.keys(categorySpending).map(key => ({
        category: key,
        totalSpent: categorySpending[key].totalSpent,
        quantity: categorySpending[key].quantity
      })).sort((a, b) => b.totalSpent - a.totalSpent);

      res.status(200).json({
        totalCategories: result.length,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Top sách bán chạy (theo số lượng) - của user hiện tại
  async getTopBooks(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const isAdmin = req.user?.role === 'admin';
      const userEmail = req.user?.email;
      const match = { status: 'Hoàn thành' };
      if (!isAdmin && userEmail) match.email = userEmail;

      const orders = await Order.find(match).lean();
      const summary = new Map();

      orders.forEach((order) => {
        (order.items || []).forEach((item) => {
          const rawBook = item.bookId;
          let bookId = null;
          if (rawBook && typeof rawBook === 'object' && rawBook._id) {
            bookId = String(rawBook._id);
          } else if (typeof rawBook === 'string' && mongoose.Types.ObjectId.isValid(rawBook)) {
            bookId = rawBook;
          }
          if (!bookId) return;

          if (!summary.has(bookId)) {
            summary.set(bookId, {
              _id: bookId,
              name: rawBook?.name || '',
              img: rawBook?.img || rawBook?.image || '',
              price: Number(rawBook?.price) || 0,
              totalSold: 0,
              totalRevenue: 0,
            });
          }
          const row = summary.get(bookId);
          row.totalSold += Number(item.quantity) || 0;
          row.totalRevenue += Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.price) || row.price || 0));
        });
      });

      const ids = [...summary.keys()].filter((id) => mongoose.Types.ObjectId.isValid(id));
      const books = ids.length
        ? await Book.find({ _id: { $in: ids } }).select('_id name img image price').lean()
        : [];
      const bookMap = new Map(books.map((b) => [String(b._id), b]));

      const topBooks = [...summary.values()]
        .map((row) => {
          const dbBook = bookMap.get(row._id);
          return {
            ...row,
            name: dbBook?.name || row.name || 'Sách',
            img: dbBook?.img || dbBook?.image || row.img || '',
            price: Number(dbBook?.price) || row.price || 0,
          };
        })
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, parseInt(limit));

      res.status(200).json(topBooks);
    } catch (error) {
      next(error);
    }
  }

  /** Doanh thu theo ngày / tuần / tháng / năm — query: granularity, from, to (ISO) */
  async getRevenueByPeriod(req, res, next) {
    try {
      const granularity = String(req.query.granularity || 'month').toLowerCase();
      const to = req.query.to ? new Date(req.query.to) : new Date();
      to.setHours(23, 59, 59, 999);
      let from = req.query.from ? new Date(req.query.from) : null;
      if (!from) {
        from = new Date(to);
        if (granularity === 'day') from.setDate(from.getDate() - 13);
        else if (granularity === 'week') from.setDate(from.getDate() - 7 * 11);
        else if (granularity === 'year') {
          from.setFullYear(from.getFullYear() - 4);
          from.setMonth(0, 1);
        } else {
          from.setMonth(from.getMonth() - 11);
          from.setDate(1);
        }
        from.setHours(0, 0, 0, 0);
      }

      const match = orderMatchForRevenue(req, {
        createdAt: { $gte: from, $lte: to },
      });

      if (granularity === 'week') {
        const rows = await Order.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                y: { $isoWeekYear: '$createdAt' },
                w: { $isoWeek: '$createdAt' },
              },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 },
            },
          },
          { $sort: { '_id.y': 1, '_id.w': 1 } },
        ]);
        return res.status(200).json({
          granularity,
          from: from.toISOString(),
          to: to.toISOString(),
          data: rows.map((r) => ({
            period: `${r._id.y}-W${String(r._id.w).padStart(2, '0')}`,
            revenue: r.revenue,
            orders: r.orders,
          })),
        });
      }

      let groupId;
      if (granularity === 'day') {
        groupId = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      } else if (granularity === 'month') {
        groupId = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      } else if (granularity === 'year') {
        groupId = { $dateToString: { format: '%Y', date: '$createdAt' } };
      } else {
        return res.status(400).json({ message: 'granularity: day | week | month | year' });
      }

      const rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: groupId,
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      res.status(200).json({
        granularity,
        from: from.toISOString(),
        to: to.toISOString(),
        data: rows.map((r) => ({
          period: r._id,
          revenue: r.revenue,
          orders: r.orders,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /** Doanh thu theo kênh web / app / api */
  async getRevenueByChannel(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      const range = {};
      if (from && to) {
        to.setHours(23, 59, 59, 999);
        from.setHours(0, 0, 0, 0);
        range.createdAt = { $gte: from, $lte: to };
      }
      const match = orderMatchForRevenue(req, range);
      const rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ['$salesChannel', 'web'] },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]);
      res.status(200).json(rows.map((r) => ({ channel: r._id, revenue: r.revenue, orders: r.orders })));
    } catch (error) {
      next(error);
    }
  }

  /** LN gộp, biên LN, AOV — theo khoảng thời gian */
  async getFinancialSummary(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      if (!from || !to) {
        return res.status(400).json({ message: 'Bắt buộc: from, to (ISO date)' });
      }
      to.setHours(23, 59, 59, 999);
      from.setHours(0, 0, 0, 0);
      const snap = await computeFinancialSnapshot(req, from, to);
      const { revenue, orderCount, cogs, grossProfit, marginPct, aov, cogsOrd, cogsMov } = snap;

      let note =
        'Đơn vị: đồng VNĐ (theo totalAmount đơn và giá vốn lưu trên dòng đơn / phiếu kho). Tiền vốn = max(COGS từ dòng đơn, COGS từ phiếu xuất bán stock_movements có importPrice). Dòng đơn: SL × (unitImportCost hoặc costPrice sách). Phiếu bán: SL × importPrice lúc xuất.';
      if (revenue > 0 && cogs === 0) {
        note +=
          ' COGS vẫn 0: cập nhật giá vốn (costPrice) / nhập kho có giá nhập; đơn mới lưu unitImportCost; đơn có trừ tồn cần importPrice trên movement bán (tạo khi đặt hàng có quản lý stock).';
      } else if (revenue > 0 && cogsMov > cogsOrd) {
        note += ' (Trong kỳ, vốn lấy chủ yếu từ biến động kho bán — đồng bộ với giá vốn lúc giao dịch.)';
      }

      res.status(200).json({
        from: from.toISOString(),
        to: to.toISOString(),
        revenue,
        cogs,
        grossProfit,
        marginPct: Math.round(marginPct * 100) / 100,
        aov: Math.round(aov * 100) / 100,
        orderCount,
        note,
      });
    } catch (error) {
      next(error);
    }
  }

  /** So sánh kỳ hiện tại vs kỳ trước (cùng độ dài) */
  async getPeriodCompare(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      if (!from || !to) {
        return res.status(400).json({ message: 'Bắt buộc: from, to (ISO date)' });
      }
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      prevStart.setHours(0, 0, 0, 0);

      const summarize = async (a, b) => {
        const snap = await computeFinancialSnapshot(req, a, b);
        return {
          revenue: snap.revenue,
          orderCount: snap.orderCount,
          cogs: snap.cogs,
          grossProfit: snap.grossProfit,
          aov: snap.aov,
        };
      };

      const current = await summarize(start, end);
      const previous = await summarize(prevStart, prevEnd);
      const pct = (cur, prev) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

      res.status(200).json({
        current: { ...current, from: start.toISOString(), to: end.toISOString() },
        previous: { ...previous, from: prevStart.toISOString(), to: prevEnd.toISOString() },
        deltaPct: {
          revenue: Math.round(pct(current.revenue, previous.revenue) * 100) / 100,
          orders: Math.round(pct(current.orderCount, previous.orderCount) * 100) / 100,
          grossProfit: Math.round(pct(current.grossProfit, previous.grossProfit) * 100) / 100,
          aov: Math.round(pct(current.aov, previous.aov) * 100) / 100,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** Số đơn theo trạng thái — luôn đủ 4 trạng thái (0 nếu không có đơn) + trạng thái lạ nếu có */
  async getOrdersByStatus(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      if (!from || !to) {
        return res.status(400).json({ message: 'Bắt buộc: from, to (ISO date)' });
      }
      to.setHours(23, 59, 59, 999);
      from.setHours(0, 0, 0, 0);
      const match = orderMatchInDateRange(req, { createdAt: { $gte: from, $lte: to } });

      const rows = await Order.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const knownOrder = ['Chờ xử lý', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
      const countMap = new Map(
        rows.map((r) => [String(r._id != null ? r._id : '').trim() || 'Không xác định', r.count])
      );
      const seen = new Set();
      const ordered = knownOrder.map((s) => {
        seen.add(s);
        return { status: s, count: countMap.get(s) || 0 };
      });
      for (const r of rows) {
        const key = String(r._id != null ? r._id : '').trim() || 'Không xác định';
        if (!seen.has(key)) {
          seen.add(key);
          ordered.push({ status: key, count: r.count });
        }
      }

      res.status(200).json(ordered);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Đã thanh toán vs chưa — trong khoảng ngày.
   * Quy ước: isPay === true HOẶC trạng thái "Hoàn thành" → tính là đã thanh toán.
   */
  async getOrdersByPayment(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      if (!from || !to) {
        return res.status(400).json({ message: 'Bắt buộc: from, to (ISO date)' });
      }
      to.setHours(23, 59, 59, 999);
      from.setHours(0, 0, 0, 0);
      const match = orderMatchInDateRange(req, { createdAt: { $gte: from, $lte: to } });

      const rows = await Order.aggregate([
        { $match: match },
        {
          $addFields: {
            effectivePaid: {
              $or: [{ $eq: ['$isPay', true] }, { $eq: ['$status', 'Hoàn thành'] }],
            },
          },
        },
        {
          $group: {
            _id: { $cond: ['$effectivePaid', 'paid', 'unpaid'] },
            count: { $sum: 1 },
          },
        },
      ]);

      const paid = rows.find((r) => r._id === 'paid')?.count || 0;
      const unpaid = rows.find((r) => r._id === 'unpaid')?.count || 0;

      res.status(200).json({
        paid,
        unpaid,
        total: paid + unpaid,
        data: [
          { key: 'paid', label: 'Đã thanh toán', count: paid },
          { key: 'unpaid', label: 'Chưa thanh toán', count: unpaid },
        ],
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StatisticsController();
