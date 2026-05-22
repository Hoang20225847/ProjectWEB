const mongoose = require('mongoose');
const FlashSale = require('../models/FlashSale');
const Book = require('../models/Books');
const {
  getActiveFlashSaleMap,
  getUpcomingFlashSaleMap,
  DEFAULT_UPCOMING_WINDOW_HOURS,
} = require('../services/flashSaleService');

const ITEMS_BOOK_POPULATE = {
  path: 'items.bookId',
  select: 'name img price discount stock isMemberOnly status',
};

function isAdmin(req) {
  return req?.user?.role === 'admin';
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return { items: null, error: 'Danh sách sách không hợp lệ' };
  const seen = new Set();
  const items = [];
  for (const it of rawItems) {
    const id = String(it?.bookId || it?._id || '').trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return { items: null, error: 'Có sách không hợp lệ trong danh sách' };
    }
    if (seen.has(id)) continue;
    const disc = Math.round(Number(it?.discountPercent));
    if (!Number.isFinite(disc) || disc < 1 || disc > 99) {
      return { items: null, error: 'Phần trăm giảm phải nằm trong khoảng 1-99' };
    }
    seen.add(id);
    items.push({ bookId: new mongoose.Types.ObjectId(id), discountPercent: disc });
  }
  if (items.length === 0) return { items: null, error: 'Cần chọn ít nhất 1 sách' };
  return { items, error: null };
}

function statusOf(sale, now = new Date()) {
  const start = new Date(sale.startsAt).getTime();
  const end = new Date(sale.endsAt).getTime();
  const t = now.getTime();
  if (!sale.active) return 'inactive';
  if (t < start) return 'scheduled';
  if (t >= end) return 'ended';
  return 'live';
}

function withStatus(saleDoc, now = new Date()) {
  const obj = saleDoc.toObject ? saleDoc.toObject() : saleDoc;
  obj.status = statusOf(obj, now);
  return obj;
}

class FlashSaleController {
  /** Admin: list toàn bộ flash sale (có populate sách) */
  async adminList(req, res) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin' });
      const sales = await FlashSale.find({})
        .populate(ITEMS_BOOK_POPULATE)
        .sort({ startsAt: -1, createdAt: -1 })
        .lean();
      const now = new Date();
      return res.status(200).json(sales.map((s) => ({ ...s, status: statusOf(s, now) })));
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi tải flash sale', error: String(e.message) });
    }
  }

  async adminCreate(req, res) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin' });
      const { title, description, startsAt, endsAt, items, active } = req.body || {};
      const titleClean = String(title || '').trim();
      if (!titleClean) return res.status(400).json({ message: 'Cần nhập tiêu đề' });
      const start = parseDate(startsAt);
      const end = parseDate(endsAt);
      if (!start || !end) return res.status(400).json({ message: 'Thời gian bắt đầu / kết thúc không hợp lệ' });
      if (end.getTime() <= start.getTime()) {
        return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
      }
      const norm = normalizeItems(items);
      if (norm.error) return res.status(400).json({ message: norm.error });

      const bookCount = await Book.countDocuments({ _id: { $in: norm.items.map((i) => i.bookId) } });
      if (bookCount !== norm.items.length) {
        return res.status(400).json({ message: 'Có sách không tồn tại' });
      }

      const created = await FlashSale.create({
        title: titleClean,
        description: String(description || '').trim(),
        startsAt: start,
        endsAt: end,
        items: norm.items,
        active: active !== false,
      });
      const populated = await FlashSale.findById(created._id).populate(ITEMS_BOOK_POPULATE);
      return res.status(201).json(withStatus(populated));
    } catch (e) {
      return res.status(500).json({ message: 'Tạo flash sale thất bại', error: String(e.message) });
    }
  }

  async adminUpdate(req, res) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin' });
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const sale = await FlashSale.findById(id);
      if (!sale) return res.status(404).json({ message: 'Không tìm thấy flash sale' });
      const { title, description, startsAt, endsAt, items, active } = req.body || {};
      if (title !== undefined) {
        const t = String(title).trim();
        if (!t) return res.status(400).json({ message: 'Tiêu đề không được rỗng' });
        sale.title = t;
      }
      if (description !== undefined) sale.description = String(description || '').trim();
      const nextStart = startsAt !== undefined ? parseDate(startsAt) : sale.startsAt;
      const nextEnd = endsAt !== undefined ? parseDate(endsAt) : sale.endsAt;
      if (!nextStart || !nextEnd) {
        return res.status(400).json({ message: 'Thời gian không hợp lệ' });
      }
      if (nextEnd.getTime() <= nextStart.getTime()) {
        return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
      }
      sale.startsAt = nextStart;
      sale.endsAt = nextEnd;
      if (items !== undefined) {
        const norm = normalizeItems(items);
        if (norm.error) return res.status(400).json({ message: norm.error });
        const bookCount = await Book.countDocuments({ _id: { $in: norm.items.map((i) => i.bookId) } });
        if (bookCount !== norm.items.length) {
          return res.status(400).json({ message: 'Có sách không tồn tại' });
        }
        sale.items = norm.items;
      }
      if (active !== undefined) sale.active = !!active;
      await sale.save();
      const populated = await FlashSale.findById(sale._id).populate(ITEMS_BOOK_POPULATE);
      return res.status(200).json(withStatus(populated));
    } catch (e) {
      return res.status(500).json({ message: 'Cập nhật flash sale thất bại', error: String(e.message) });
    }
  }

  async adminRemove(req, res) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin' });
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const sale = await FlashSale.findById(id);
      if (!sale) return res.status(404).json({ message: 'Không tìm thấy flash sale' });

      const now = new Date();
      const isLive = sale.active && sale.startsAt <= now && sale.endsAt > now;
      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      if (isLive && !force) {
        return res.status(400).json({
          message:
            'Flash sale đang diễn ra — không nên xóa hẳn. Nên đặt active=false (kết thúc sớm) hoặc truyền ?force=true.',
          isLive: true,
          endsAt: sale.endsAt,
        });
      }

      await FlashSale.findByIdAndDelete(id);

      try {
        const qdrant = require('../chatbot/clients/qdrantClient');
        const pointId = qdrant.objectIdToPointId(id);
        await qdrant.deletePoint('promotion', pointId);
      } catch (vErr) {
        console.warn('[flashsale.remove] qdrant cleanup failed:', vErr?.message || vErr);
      }

      return res.status(200).json({
        message: 'Đã xóa flash sale',
        flashSaleId: String(id),
        wasLive: isLive,
      });
    } catch (e) {
      return res.status(500).json({ message: 'Xóa thất bại', error: String(e.message) });
    }
  }

  /** User: lấy flash sale ĐANG diễn ra (có sách), ưu tiên kết thúc gần nhất. */
  async publicLive(req, res) {
    try {
      const now = new Date();
      const sales = await FlashSale.find({
        active: true,
        startsAt: { $lte: now },
        endsAt: { $gt: now },
      })
        .populate(ITEMS_BOOK_POPULATE)
        .sort({ endsAt: 1 })
        .lean();
      return res.status(200).json(sales.map((s) => ({ ...s, status: 'live' })));
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi tải flash sale đang chạy', error: String(e.message) });
    }
  }

  /** User: flash sale sắp diễn ra trong vòng N giờ (mặc định 7h). */
  async publicUpcoming(req, res) {
    try {
      const now = new Date();
      const hours = Math.max(1, Number(req.query.hours) || DEFAULT_UPCOMING_WINDOW_HOURS);
      const horizon = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const sales = await FlashSale.find({
        active: true,
        startsAt: { $gt: now, $lte: horizon },
      })
        .populate(ITEMS_BOOK_POPULATE)
        .sort({ startsAt: 1 })
        .lean();
      return res.status(200).json(sales.map((s) => ({ ...s, status: 'upcoming' })));
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi tải flash sale sắp tới', error: String(e.message) });
    }
  }

  /**
   * GET /api/flash-sales/for-books?ids=a,b,c
   * Trả về { live: {bookId: meta}, upcoming: {bookId: meta} } cho từng sách.
   */
  async publicForBooks(req, res) {
    try {
      const idsRaw = String(req.query.ids || '').trim();
      if (!idsRaw) return res.status(200).json({ live: {}, upcoming: {} });
      const ids = idsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));
      if (ids.length === 0) return res.status(200).json({ live: {}, upcoming: {} });
      const hours = Math.max(1, Number(req.query.hours) || DEFAULT_UPCOMING_WINDOW_HOURS);
      const now = new Date();
      const [activeMap, upcomingMap] = await Promise.all([
        getActiveFlashSaleMap(now),
        getUpcomingFlashSaleMap(now, hours),
      ]);
      const live = {};
      const upcoming = {};
      for (const id of ids) {
        if (activeMap.has(id)) live[id] = activeMap.get(id);
        else if (upcomingMap.has(id)) upcoming[id] = upcomingMap.get(id);
      }
      return res.status(200).json({ live, upcoming });
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi flash sale theo sách', error: String(e.message) });
    }
  }
}

module.exports = new FlashSaleController();
