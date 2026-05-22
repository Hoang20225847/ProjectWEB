const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Book = require('../models/Books');

function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ admin' });
    return true;
  }
  return false;
}

function normalizeName(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

class SupplierController {
  async list(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const rows = await Supplier.find({}).sort({ name: 1 }).lean();
      res.status(200).json(rows);
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const name = normalizeName(req.body?.name);
      if (!name) return res.status(400).json({ message: 'Thiếu name' });
      const created = await Supplier.create({ name });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }

  async update(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
      const name = normalizeName(req.body?.name);
      if (!name) return res.status(400).json({ message: 'Thiếu name' });
      const updated = await Supplier.findByIdAndUpdate(id, { name }, { new: true });
      if (!updated) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(updated);
    } catch (e) {
      next(e);
    }
  }

  async remove(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
      const doc = await Supplier.findById(id);
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });

      const name = String(doc.name || '').trim();
      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      if (name) {
        const used = await Book.countDocuments({
          supplier: name,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        });
        if (used > 0 && !force) {
          return res.status(400).json({
            message: `Không xóa được: còn ${used} sách đang dùng NCC "${name}". Truyền ?force=true để xóa nhưng các sách vẫn giữ tên NCC cũ.`,
            usedBooks: used,
          });
        }
      }
      await Supplier.findByIdAndDelete(id);
      res.status(200).json({ message: 'Đã xóa' });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new SupplierController();

