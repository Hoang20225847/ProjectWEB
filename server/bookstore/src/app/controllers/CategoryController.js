const mongoose = require('mongoose');
const Category = require('../models/Category');
const Book = require('../models/Books');
const { mongoFilterPublishedCatalog } = require('../utils/bookVisibility');
const { migrateLegacyAuthorsToRefs } = require('../utils/migrateAuthorsFromBooks');

const DEFAULTS = [
  { name: 'Sách xã hội', slug: 'xa-hoi', order: 0, legacyCode: 1 },
  { name: 'Sách Thiếu nhi', slug: 'thieu-nhi', order: 1, legacyCode: 2 },
  { name: 'Sách Lịch sử', slug: 'lich-su', order: 2, legacyCode: 3 },
  { name: 'Sách Kinh dị', slug: 'kinh-di', order: 3, legacyCode: 4 },
];

let migrateOnce = null;
function ensureSeedAndMigrate() {
  if (!migrateOnce) {
    migrateOnce = (async () => {
      if ((await Category.countDocuments()) === 0) {
        await Category.insertMany(DEFAULTS);
      }
      const cats = await Category.find({});
      const byLegacy = {};
      for (const c of cats) {
        if (c.legacyCode != null) byLegacy[c.legacyCode] = c._id;
      }
      const coll = Book.collection;
      for (let code = 1; code <= 4; code++) {
        const id = byLegacy[code];
        if (!id) continue;
        const oid = new mongoose.Types.ObjectId(id);
        await coll.updateMany({ category: code }, { $set: { category: oid } });
        await coll.updateMany({ category: String(code) }, { $set: { category: oid } });
      }
      const fallback = await Category.findOne({ slug: 'xa-hoi' });
      if (fallback) {
        await coll.updateMany(
          { $or: [{ category: null }, { category: { $exists: false } }] },
          { $set: { category: fallback._id } }
        );
      }

      // Một lần: toàn bộ sách đã có trong DB → published + publishedAt (sách thêm sau qua API vẫn là draft).
      const db = mongoose.connection.db;
      if (db) {
        const mig = db.collection('app_migrations');
        const key = 'books_existing_to_published_v1';
        const already = await mig.findOne({ _id: key });
        if (!already) {
          const now = new Date();
          await coll.updateMany({}, { $set: { status: 'published' } });
          await coll.updateMany(
            { $or: [{ publishedAt: null }, { publishedAt: { $exists: false } }] },
            { $set: { publishedAt: now } }
          );
          await mig.insertOne({ _id: key, ranAt: now });
        }
      }

      await migrateLegacyAuthorsToRefs();
    })();
  }
  return migrateOnce;
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'danh-muc';
}

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function repairBookCategories(options = {}) {
  const { dryRun = false } = options;
  await ensureSeedAndMigrate();
  const categories = await Category.find({}).select('_id name slug legacyCode').lean();
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const byName = new Map(categories.map((c) => [normalizeText(c.name), c]));
  const bySlug = new Map(categories.map((c) => [String(c.slug || '').toLowerCase(), c]));
  const byLegacy = new Map(
    categories
      .filter((c) => c.legacyCode != null)
      .map((c) => [String(c.legacyCode), c])
  );
  const fallback = categories.find((c) => c.slug === 'xa-hoi') || categories[0] || null;
  const docs = await Book.collection.find({}, { projection: { _id: 1, category: 1 } }).toArray();
  const ops = [];
  let skipped = 0;

  const resolveCategoryId = (rawCategory) => {
    if (rawCategory == null) return fallback ? String(fallback._id) : null;

    if (rawCategory instanceof mongoose.Types.ObjectId) {
      const id = String(rawCategory);
      return byId.has(id) ? id : fallback ? String(fallback._id) : null;
    }

    if (typeof rawCategory === 'number') {
      const m = byLegacy.get(String(rawCategory));
      return m ? String(m._id) : fallback ? String(fallback._id) : null;
    }

    if (typeof rawCategory === 'string') {
      const trimmed = rawCategory.trim();
      if (!trimmed) return fallback ? String(fallback._id) : null;
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        return byId.has(trimmed) ? trimmed : fallback ? String(fallback._id) : null;
      }
      const byLegacyCode = byLegacy.get(trimmed);
      if (byLegacyCode) return String(byLegacyCode._id);
      const bySlugName = bySlug.get(trimmed.toLowerCase()) || byName.get(normalizeText(trimmed));
      if (bySlugName) return String(bySlugName._id);
      return fallback ? String(fallback._id) : null;
    }

    if (typeof rawCategory === 'object') {
      const candidateId = rawCategory._id ? String(rawCategory._id) : '';
      if (candidateId && mongoose.Types.ObjectId.isValid(candidateId) && byId.has(candidateId)) {
        return candidateId;
      }
      const candidateText = rawCategory.name || rawCategory.slug || '';
      if (candidateText) {
        const byText =
          bySlug.get(String(candidateText).toLowerCase()) ||
          byName.get(normalizeText(String(candidateText)));
        if (byText) return String(byText._id);
      }
      return fallback ? String(fallback._id) : null;
    }

    return fallback ? String(fallback._id) : null;
  };

  for (const doc of docs) {
    const nextCategoryId = resolveCategoryId(doc.category);
    if (!nextCategoryId) {
      skipped += 1;
      continue;
    }
    const currentIsValidObjectId = doc.category instanceof mongoose.Types.ObjectId;
    const currentId = currentIsValidObjectId ? String(doc.category) : String(doc.category || '');
    if (currentIsValidObjectId && currentId === nextCategoryId) continue;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { category: new mongoose.Types.ObjectId(nextCategoryId) } },
      },
    });
  }

  if (!dryRun && ops.length > 0) {
    await Book.collection.bulkWrite(ops, { ordered: false });
  }

  return {
    totalBooks: docs.length,
    repairedBooks: ops.length,
    skippedBooks: skipped,
    dryRun,
  };
}

class CategoryController {
  async list(req, res) {
    try {
      await ensureSeedAndMigrate();
      const list = await Category.aggregate([
        { $sort: { order: 1, name: 1 } },
        {
          $lookup: {
            from: Book.collection.collectionName,
            let: { catId: '$_id' },
            pipeline: [
              {
                $match: {
                  $and: [{ $expr: { $eq: ['$category', '$$catId'] } }, mongoFilterPublishedCatalog()],
                },
              },
              { $count: 'n' },
            ],
            as: '_bookCount',
          },
        },
        {
          $addFields: {
            bookCount: {
              $ifNull: [{ $arrayElemAt: ['$_bookCount.n', 0] }, 0],
            },
          },
        },
        { $project: { _bookCount: 0 } },
      ]);
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'Lỗi lấy danh mục', error: String(e.message) });
    }
  }

  async create(req, res) {
    try {
      await ensureSeedAndMigrate();
      const { name, slug } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ message: 'Tên danh mục là bắt buộc' });
      }
      let finalSlug = slug && String(slug).trim() ? slugify(slug) : slugify(name);
      let candidate = finalSlug;
      let n = 0;
      while (await Category.findOne({ slug: candidate })) {
        n += 1;
        candidate = `${finalSlug}-${n}`;
      }
      finalSlug = candidate;
      const maxDoc = await Category.findOne().sort({ order: -1 }).select('order').lean();
      const nextOrder =
        maxDoc != null && typeof maxDoc.order === 'number' ? maxDoc.order + 1 : 0;
      const doc = await Category.create({
        name: String(name).trim(),
        slug: finalSlug,
        order: nextOrder,
      });
      res.status(201).json(doc);
    } catch (e) {
      res.status(400).json({ message: 'Không tạo được danh mục', error: String(e.message) });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, slug, order } = req.body;
      const doc = await Category.findById(id);
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
      if (name != null) doc.name = String(name).trim();
      if (slug != null && String(slug).trim()) {
        const s = slugify(slug);
        const clash = await Category.findOne({ slug: s, _id: { $ne: doc._id } });
        if (clash) return res.status(400).json({ message: 'Slug đã tồn tại' });
        doc.slug = s;
      }
      if (order != null) doc.order = Number(order);
      await doc.save();
      res.json(doc);
    } catch (e) {
      res.status(400).json({ message: 'Cập nhật thất bại', error: String(e.message) });
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params;
      const used = await Book.countDocuments({ category: id });
      if (used > 0) {
        return res.status(400).json({ message: `Không xóa được: còn ${used} sách thuộc danh mục này` });
      }
      const doc = await Category.findByIdAndDelete(id);
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
      res.json({ message: 'Đã xóa', id: doc._id });
    } catch (e) {
      res.status(400).json({ message: 'Xóa thất bại', error: String(e.message) });
    }
  }

  async repairBooks(req, res) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Chỉ admin mới được sửa dữ liệu danh mục sách' });
      }
      const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';
      const result = await repairBookCategories({ dryRun });
      return res.status(200).json({
        message: dryRun ? 'Đã kiểm tra dữ liệu category sách (chưa ghi DB)' : 'Đã sửa dữ liệu category sách',
        ...result,
      });
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi sửa dữ liệu category sách', error: String(e.message) });
    }
  }
}

const categoryController = new CategoryController();
categoryController.ensureSeedAndMigrate = ensureSeedAndMigrate;
categoryController.repairBookCategories = repairBookCategories;
module.exports = categoryController;
