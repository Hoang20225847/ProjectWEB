const mongoose = require('mongoose');
const Book = require('../models/Books');
const StockMovement = require('../models/StockMovement');
const { parseVndInputToDong } = require('../utils/moneyVnd');

function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ quản trị viên mới truy cập được mục kho hàng.' });
    return true;
  }
  return false;
}

function parseMoney(priceStr) {
  return parseVndInputToDong(priceStr);
}

function effectiveMinStock(b) {
  const m = b.minStock;
  if (m != null && Number.isFinite(Number(m))) return Math.max(0, Number(m));
  return 5;
}

function isSlowMover(b, now = new Date(), days = 90) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const stock = Number(b.stock) || 0;
  if (stock <= 0) return false;
  const last = b.lastSoldAt ? new Date(b.lastSoldAt) : null;
  const created = b.createAt ? new Date(b.createAt) : null;
  if (last != null) return last < cutoff;
  if (created != null) return created < cutoff;
  return true;
}

/** Ưu tiên: hết hàng → tồn lâu → sắp hết → bình thường (khớp mock: Sapiens tồn lâu). */
function rowInventoryStatus(b, now = new Date()) {
  const stock = typeof b.stock === 'number' ? b.stock : null;
  if (stock == null) return 'untracked';
  if (stock <= 0) return 'out';
  if (isSlowMover(b, now)) return 'slow';
  const minS = effectiveMinStock(b);
  if (stock <= minS) return 'low';
  return 'normal';
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMovement(m) {
  const rawQ = Number(m.quantity);
  const absQty = Math.abs(rawQ);
  let type = m.type === 'export' ? 'sale' : m.type;
  let dir = m.stockDirection;
  if (!dir) {
    if (m.type === 'export' || rawQ < 0 || type === 'sale') dir = 'out';
    else dir = 'in';
  }
  const displayQty = absQty;
  const signedQty = dir === 'in' ? displayQty : -displayQty;
  return {
    ...m,
    type,
    stockDirection: dir,
    quantity: displayQty,
    signedQty,
  };
}

class InventoryController {
  /** KPI 4 ô: tổng đầu sách có kho, số danh mục, giá trị tồn, cần nhập, tồn lâu */
  async dashboard(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const books = await Book.find({ stock: { $exists: true, $type: 'number' } })
        .select('stock costPrice minStock lastSoldAt createAt category')
        .lean();

      const catIds = new Set();
      let valueAtCost = 0;
      let needRestock = 0;
      let slowStale = 0;
      const now = new Date();

      for (const b of books) {
        if (b.category) catIds.add(String(b.category));
        const s = Number(b.stock) || 0;
        valueAtCost += s * (Number(b.costPrice) || 0);
        const minS = effectiveMinStock(b);
        if (s > 0 && s <= minS) needRestock += 1;
        if (isSlowMover(b, now)) slowStale += 1;
      }

      res.status(200).json({
        totalSkusWithStock: books.length,
        categoryCount: catIds.size,
        valueAtCost,
        needRestockCount: needRestock,
        slowStaleCount: slowStale,
      });
    } catch (e) {
      next(e);
    }
  }

  async listByBook(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { q, categoryId, status } = req.query;
      const filter = {};
      if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
        filter.category = new mongoose.Types.ObjectId(String(categoryId));
      }
      if (q && String(q).trim()) {
        filter.name = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      let books = await Book.find(filter)
        .populate('category', 'name slug')
        .select(
          'name img price stock minStock stockImportedAt costPrice sold lastSoldAt createAt category'
        )
        .sort({ name: 1 })
        .lean();

      const now = new Date();
      const rows = books.map((b) => {
        const unitRetail = parseMoney(b.price);
        const stock = typeof b.stock === 'number' ? b.stock : null;
        const minS = effectiveMinStock(b);
        const cost = Number(b.costPrice) || 0;
        const invValue = stock != null ? stock * cost : null;
        const retailValue = stock != null ? stock * unitRetail : null;
        const st = rowInventoryStatus(b, now);
        const barDen = Math.max(minS * 4, 1);
        const stockBarPct = stock == null ? 0 : Math.min(100, Math.round((stock / barDen) * 100));
        return {
          _id: b._id,
          name: b.name,
          img: b.img,
          category: b.category?.name || '',
          categoryId: b.category?._id,
          stock,
          minStock: minS,
          stockBarPct,
          sold: b.sold || 0,
          costPrice: cost,
          unitRetail,
          inventoryValueAtCost: invValue,
          inventoryValueAtRetail: retailValue,
          lastSoldAt: b.lastSoldAt,
          stockImportedAt: b.stockImportedAt,
          createdAt: b.createAt,
          rowStatus: st,
        };
      });

      const statusFilter = status && String(status).trim();
      const filtered =
        statusFilter && statusFilter !== 'all'
          ? rows.filter((r) => r.rowStatus === statusFilter)
          : rows;

      res.status(200).json(filtered);
    } catch (e) {
      next(e);
    }
  }

  async alerts(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const books = await Book.find({ stock: { $exists: true, $type: 'number' } })
        .select('name img stock minStock sold price')
        .lean();

      const items = books.filter((b) => {
        const s = Number(b.stock) || 0;
        return s <= effectiveMinStock(b);
      });
      items.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));

      res.status(200).json({
        count: items.length,
        items: items.slice(0, 200),
      });
    } catch (e) {
      next(e);
    }
  }

  async movements(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
      const list = await StockMovement.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('bookId', 'name img')
        .lean();
      res.status(200).json(list.map(normalizeMovement));
    } catch (e) {
      next(e);
    }
  }

  async valueSummary(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const books = await Book.find({ stock: { $exists: true, $gt: 0 } })
        .select('stock costPrice price')
        .lean();
      let atCost = 0;
      let atRetail = 0;
      for (const b of books) {
        const s = b.stock;
        atCost += s * (Number(b.costPrice) || 0);
        atRetail += s * parseMoney(b.price);
      }
      res.status(200).json({
        bookCountWithStock: books.length,
        totalUnits: books.reduce((a, b) => a + (b.stock || 0), 0),
        valueAtCost: atCost,
        valueAtRetail: atRetail,
      });
    } catch (e) {
      next(e);
    }
  }

  async slowMovers(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const days = Math.max(7, parseInt(req.query.days, 10) || 90);
      const cutoff = new Date(Date.now() - days * 86400000);
      const books = await Book.find({
        stock: { $exists: true, $gt: 0 },
        $or: [{ lastSoldAt: { $lt: cutoff } }, { lastSoldAt: null }],
      })
        .select('name img stock sold lastSoldAt createAt price minStock')
        .sort({ lastSoldAt: 1 })
        .limit(100)
        .lean();
      res.status(200).json({ daysStale: days, count: books.length, items: books });
    } catch (e) {
      next(e);
    }
  }

  async stockImport(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { bookId, quantity, note, importPrice, supplierName } = req.body;
      const q = Math.floor(Number(quantity));
      const unitImport = importPrice != null && importPrice !== '' ? Number(importPrice) : null;
      const supplier = supplierName == null ? '' : String(supplierName).trim().slice(0, 200);

      if (!mongoose.Types.ObjectId.isValid(String(bookId)) || !Number.isFinite(q) || q < 1) {
        return res.status(400).json({ message: 'bookId hợp lệ và quantity ≥ 1 là bắt buộc' });
      }
      if (unitImport != null && (!Number.isFinite(unitImport) || unitImport < 0)) {
        return res.status(400).json({ message: 'importPrice không hợp lệ' });
      }

      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: 'Không tìm thấy sách' });

      const balanceBefore = typeof book.stock === 'number' && !Number.isNaN(book.stock) ? book.stock : 0;
      const balanceAfter = balanceBefore + q;
      book.stock = balanceAfter;
      book.stockImportedAt = new Date();

      if (unitImport != null && unitImport >= 0 && balanceAfter > 0) {
        const prevCost = Number(book.costPrice) || 0;
        const weighted =
          (balanceBefore * prevCost + q * unitImport) / balanceAfter;
        book.costPrice = Math.round(weighted);
      }

      const createdBy = String(req.user?.email || req.user?.id || '');

      const movementDoc = await StockMovement.create({
        bookId: book._id,
        type: 'import',
        stockDirection: 'in',
        quantity: q,
        balanceBefore,
        balanceAfter,
        importPrice: unitImport != null ? unitImport : null,
        supplierName: supplier,
        note: note || 'Nhập kho',
        orderId: null,
        createdBy,
      });

      await book.save();

      res.status(201).json({
        message: 'Đã nhập kho',
        movementId: String(movementDoc._id),
        bookId: String(book._id),
        stock: book.stock,
        costPrice: book.costPrice,
        balanceBefore,
        balanceAfter,
      });
    } catch (e) {
      next(e);
    }
  }

  /**
   * Hoàn tác phiếu nhập nhầm: trừ lại tồn + ghi adjust out (không trùng lần 2).
   * Giá vốn không tự đảo — chỉnh tay trong Quản lý sách nếu cần.
   */
  async reverseStockImport(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { movementId, note } = req.body;
      if (!mongoose.Types.ObjectId.isValid(String(movementId))) {
        return res.status(400).json({ message: 'movementId không hợp lệ' });
      }
      const mov = await StockMovement.findById(movementId).lean();
      if (!mov) {
        return res.status(404).json({ message: 'Không tìm thấy phiếu kho' });
      }
      const dir = mov.stockDirection || (mov.type === 'import' || mov.type === 'return' ? 'in' : 'out');
      if (mov.type !== 'import' || dir !== 'in') {
        return res.status(400).json({ message: 'Chỉ hoàn tác được phiếu nhập kho (import)' });
      }

      const marker = `__REV_IMPORT__:${String(mov._id)}__`;
      const dup = await StockMovement.findOne({
        bookId: mov.bookId,
        type: 'adjust',
        stockDirection: 'out',
        note: new RegExp(`^${escapeRegex(marker)}`),
      }).lean();
      if (dup) {
        return res.status(400).json({ message: 'Phiếu nhập này đã được hoàn tác trước đó' });
      }

      const origQty = Math.floor(Number(mov.quantity)) || 0;
      if (origQty < 1) {
        return res.status(400).json({ message: 'Số lượng phiếu gốc không hợp lệ' });
      }
      const revQty = origQty;

      const book = await Book.findById(mov.bookId);
      if (!book) {
        return res.status(404).json({ message: 'Không tìm thấy sách' });
      }
      const balanceBefore = typeof book.stock === 'number' && !Number.isNaN(book.stock) ? book.stock : 0;
      if (balanceBefore < revQty) {
        return res.status(400).json({
          message:
            'Tồn hiện tại không đủ để trừ (có thể đã bán). Dùng điều chỉnh tồn thủ công hoặc trừ từng phần.',
        });
      }
      const balanceAfter = Math.max(0, balanceBefore - revQty);
      book.stock = balanceAfter;

      const createdBy = String(req.user?.email || req.user?.id || '');
      const noteLine = [marker, note || 'Hoàn tác nhập kho nhầm'].filter(Boolean).join(' ');

      await StockMovement.create({
        bookId: book._id,
        type: 'adjust',
        stockDirection: 'out',
        quantity: revQty,
        balanceBefore,
        balanceAfter,
        importPrice: null,
        note: noteLine,
        orderId: null,
        createdBy,
      });

      await book.save();

      res.status(201).json({
        message: 'Đã hoàn tác phiếu nhập',
        stock: book.stock,
        costPriceNote:
          'Giá vốn không tự cập nhật khi hoàn tác — nếu cần, chỉnh tay trong Quản lý sách.',
      });
    } catch (e) {
      next(e);
    }
  }

  /** Khách trả hàng — tăng tồn, ghi return */
  async stockReturn(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { bookId, quantity, note, importPrice } = req.body;
      const q = Math.floor(Number(quantity));
      const unitImport = importPrice != null && importPrice !== '' ? Number(importPrice) : null;

      if (!mongoose.Types.ObjectId.isValid(String(bookId)) || !Number.isFinite(q) || q < 1) {
        return res.status(400).json({ message: 'bookId và quantity ≥ 1' });
      }

      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: 'Không tìm thấy sách' });

      const balanceBefore = typeof book.stock === 'number' && !Number.isNaN(book.stock) ? book.stock : 0;
      const balanceAfter = balanceBefore + q;
      book.stock = balanceAfter;
      book.stockImportedAt = new Date();

      const createdBy = String(req.user?.email || req.user?.id || '');

      await StockMovement.create({
        bookId: book._id,
        type: 'return',
        stockDirection: 'in',
        quantity: q,
        balanceBefore,
        balanceAfter,
        importPrice: unitImport != null ? unitImport : null,
        note: note || 'Khách trả hàng',
        orderId: null,
        createdBy,
      });

      await book.save();
      res.status(201).json({ message: 'Đã ghi nhận trả hàng', stock: book.stock });
    } catch (e) {
      next(e);
    }
  }

  /** Điều chỉnh tồn thủ công — quantity dương, body: direction in|out */
  async stockAdjust(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { bookId, quantity, direction, note } = req.body;
      const q = Math.floor(Number(quantity));
      const dir = direction === 'out' ? 'out' : 'in';

      if (!mongoose.Types.ObjectId.isValid(String(bookId)) || !Number.isFinite(q) || q < 1) {
        return res.status(400).json({ message: 'bookId và quantity ≥ 1' });
      }

      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: 'Không tìm thấy sách' });

      const balanceBefore = typeof book.stock === 'number' && !Number.isNaN(book.stock) ? book.stock : 0;
      const balanceAfter = dir === 'in' ? balanceBefore + q : Math.max(0, balanceBefore - q);
      book.stock = balanceAfter;

      const createdBy = String(req.user?.email || req.user?.id || '');

      await StockMovement.create({
        bookId: book._id,
        type: 'adjust',
        stockDirection: dir,
        quantity: q,
        balanceBefore,
        balanceAfter,
        importPrice: null,
        note: note || 'Điều chỉnh tồn',
        orderId: null,
        createdBy,
      });

      await book.save();
      res.status(201).json({ message: 'Đã điều chỉnh', stock: book.stock });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new InventoryController();
