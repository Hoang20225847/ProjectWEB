const mongoose = require('mongoose');
const Series = require('../models/Series');
const Book = require('../models/Books');

function requireAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ quản trị viên được thao tác' });
    return false;
  }
  return true;
}

function slugifyBase(name) {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'series';
}

async function uniqueSlug(base) {
  let slug = slugifyBase(base);
  let n = 0;
  while (await Series.findOne({ slug }).select('_id').lean()) {
    n += 1;
    slug = `${slugifyBase(base)}-${n}`;
  }
  return slug;
}

class SeriesController {
  async list(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const rows = await Series.aggregate([
        { $sort: { sortOrder: 1, name: 1 } },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: 'series',
            as: '_books',
          },
        },
        { $addFields: { bookCount: { $size: '$_books' } } },
        { $project: { _books: 0 } },
      ]);
      return res.status(200).json(rows);
    } catch (e) {
      return next(e);
    }
  }

  async create(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Thiếu tên series' });
      }
      const description = req.body.description != null ? String(req.body.description).slice(0, 4000) : '';
      const sortOrder = Number.parseInt(String(req.body.sortOrder ?? '0'), 10) || 0;
      let slug = req.body.slug != null ? String(req.body.slug).trim().toLowerCase() : '';
      if (!slug) slug = await uniqueSlug(name);
      else {
        const exists = await Series.findOne({ slug }).select('_id').lean();
        if (exists) {
          return res.status(400).json({ message: 'Slug đã tồn tại' });
        }
      }
      const doc = await Series.create({ name, slug, description, sortOrder });
      return res.status(201).json(doc);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ message: 'Slug trùng' });
      }
      return next(e);
    }
  }

  async update(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const prev = await Series.findById(id);
      if (!prev) {
        return res.status(404).json({ message: 'Không tìm thấy series' });
      }
      const updates = {};
      if (req.body.name != null) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ message: 'Tên không hợp lệ' });
        updates.name = name.slice(0, 200);
      }
      if (req.body.description != null) {
        updates.description = String(req.body.description).slice(0, 4000);
      }
      if (req.body.sortOrder != null) {
        updates.sortOrder = Number.parseInt(String(req.body.sortOrder), 10) || 0;
      }
      if (req.body.slug != null) {
        const slug = String(req.body.slug).trim().toLowerCase();
        if (!slug) return res.status(400).json({ message: 'Slug không hợp lệ' });
        const clash = await Series.findOne({ slug, _id: { $ne: prev._id } }).select('_id').lean();
        if (clash) return res.status(400).json({ message: 'Slug đã được dùng' });
        updates.slug = slug.slice(0, 160);
      }
      const doc = await Series.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      return res.status(200).json(doc);
    } catch (e) {
      return next(e);
    }
  }

  async remove(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const usedCount = await Book.countDocuments({ series: id });
      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      if (usedCount > 0 && !force) {
        return res.status(400).json({
          message: `Không xóa được: còn ${usedCount} sách thuộc series này. Truyền ?force=true để gỡ liên kết và xóa series.`,
          usedBooks: usedCount,
        });
      }
      const s = await Series.findByIdAndDelete(id);
      if (!s) {
        return res.status(404).json({ message: 'Không tìm thấy series' });
      }
      await Book.updateMany({ series: id }, { $set: { series: null } });
      return res.status(200).json({ message: 'Đã xóa series', unlinkedBooks: usedCount });
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Gán đúng tập sách thuộc series: các id trong bookIds thuộc series này;
   * sách trước đó thuộc series này nhưng không còn trong danh sách thì gỡ series.
   */
  async setMembers(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID series không hợp lệ' });
      }
      const series = await Series.findById(id).select('_id').lean();
      if (!series) {
        return res.status(404).json({ message: 'Không tìm thấy series' });
      }
      const raw = req.body.bookIds;
      const ids = Array.isArray(raw)
        ? raw.map((x) => String(x)).filter((x) => mongoose.Types.ObjectId.isValid(x))
        : [];
      const oidList = [...new Set(ids)].map((x) => new mongoose.Types.ObjectId(x));

      if (oidList.length) {
        await Book.updateMany({ _id: { $in: oidList } }, { $set: { series: series._id } });
      }
      await Book.updateMany(
        { series: series._id, _id: { $nin: oidList } },
        { $set: { series: null } }
      );
      const count = await Book.countDocuments({ series: series._id });
      return res.status(200).json({ message: 'Đã cập nhật danh sách sách trong series', bookCount: count });
    } catch (e) {
      return next(e);
    }
  }

  async booksInSeries(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const books = await Book.find({ series: id }).populate('category').sort({ name: 1 }).lean();
      return res.status(200).json(books);
    } catch (e) {
      return next(e);
    }
  }
}

module.exports = new SeriesController();
