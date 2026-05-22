const mongoose = require('mongoose');
const Author = require('../models/Author');
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
  return s || 'author';
}

async function uniqueSlug(base) {
  let slug = slugifyBase(base);
  let n = 0;
  while (await Author.findOne({ slug }).select('_id').lean()) {
    n += 1;
    slug = `${slugifyBase(base)}-${n}`;
  }
  return slug;
}

class AuthorController {
  async list(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const rows = await Author.aggregate([
        { $sort: { sortOrder: 1, name: 1 } },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: 'authorRef',
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
        return res.status(400).json({ message: 'Thiếu tên tác giả' });
      }
      const description = req.body.description != null ? String(req.body.description).slice(0, 4000) : '';
      const sortOrder = Number.parseInt(String(req.body.sortOrder ?? '0'), 10) || 0;
      let slug = req.body.slug != null ? String(req.body.slug).trim().toLowerCase() : '';
      if (!slug) slug = await uniqueSlug(name);
      else {
        const exists = await Author.findOne({ slug }).select('_id').lean();
        if (exists) {
          return res.status(400).json({ message: 'Slug đã tồn tại' });
        }
      }
      const doc = await Author.create({ name, slug, description, sortOrder });
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
      const prev = await Author.findById(id);
      if (!prev) {
        return res.status(404).json({ message: 'Không tìm thấy tác giả' });
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
        const clash = await Author.findOne({ slug, _id: { $ne: prev._id } }).select('_id').lean();
        if (clash) return res.status(400).json({ message: 'Slug đã được dùng' });
        updates.slug = slug.slice(0, 160);
      }
      const doc = await Author.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      if (updates.name != null && prev.name !== doc.name) {
        await Book.updateMany({ authorRef: prev._id }, { $set: { author: doc.name } });
        try {
          const vectorSync = require('../chatbot/sync/vectorSync');
          const affected = await Book.find({ authorRef: prev._id }).select('_id').lean();
          for (const b of affected) {
            vectorSync.syncBookFromId(b._id).catch(() => {});
          }
        } catch (_) {}
      }
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
      const usedCount = await Book.countDocuments({ authorRef: id });
      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      if (usedCount > 0 && !force) {
        return res.status(400).json({
          message: `Không xóa được: còn ${usedCount} sách tham chiếu tác giả này. Truyền ?force=true để gỡ liên kết và tiếp tục xóa (sách vẫn giữ tên tác giả ở trường Book.author).`,
          usedBooks: usedCount,
        });
      }
      const a = await Author.findByIdAndDelete(id);
      if (!a) {
        return res.status(404).json({ message: 'Không tìm thấy tác giả' });
      }
      await Book.updateMany({ authorRef: id }, { $set: { authorRef: null } });
      return res.status(200).json({ message: 'Đã xóa tác giả', unlinkedBooks: usedCount });
    } catch (e) {
      return next(e);
    }
  }

  async setMembers(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID tác giả không hợp lệ' });
      }
      const author = await Author.findById(id).select('_id name').lean();
      if (!author) {
        return res.status(404).json({ message: 'Không tìm thấy tác giả' });
      }
      const raw = req.body.bookIds;
      const ids = Array.isArray(raw)
        ? raw.map((x) => String(x)).filter((x) => mongoose.Types.ObjectId.isValid(x))
        : [];
      const oidList = [...new Set(ids)].map((x) => new mongoose.Types.ObjectId(x));

      if (oidList.length) {
        await Book.updateMany(
          { _id: { $in: oidList } },
          { $set: { authorRef: author._id, author: author.name } }
        );
      }
      await Book.updateMany(
        { authorRef: author._id, _id: { $nin: oidList } },
        { $set: { authorRef: null, author: '' } }
      );
      const count = await Book.countDocuments({ authorRef: author._id });
      return res.status(200).json({ message: 'Đã cập nhật sách của tác giả', bookCount: count });
    } catch (e) {
      return next(e);
    }
  }

  async booksByAuthor(req, res, next) {
    try {
      if (!requireAdmin(req, res)) return;
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }
      const books = await Book.find({ authorRef: id }).populate('category').sort({ name: 1 }).lean();
      return res.status(200).json(books);
    } catch (e) {
      return next(e);
    }
  }
}

module.exports = new AuthorController();
