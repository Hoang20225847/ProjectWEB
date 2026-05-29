const Book = require('../../models/Books');
const { createVietnameseRegex } = require('../../../utils/vietnameseSearch');

/**
 * Tìm sách phục vụ chatbot.
 * - LUÔN filter status=published và (stock>0 hoặc không quản lý stock).
 * - LUÔN dùng projection whitelist — không bao giờ trả costPrice/minStock/supplier.
 */

const PUBLIC_PROJECTION = {
  name: 1,
  author: 1,
  publisher: 1,
  genres: 1,
  themes: 1,
  mood: 1,
  contentTags: 1,
  audience: 1,
  country: 1,
  language: 1,
  ageRange: 1,
  description: 1,
  img: 1,
  price: 1,
  discount: 1,
  evaluate: 1,
  sold: 1,
  stock: 1,
  isMemberOnly: 1,
  category: 1,
  status: 1,
};

const PUBLIC_ALLOW_KEYS = new Set([
  '_id',
  ...Object.keys(PUBLIC_PROJECTION),
  'category',
]);

function sanitizeBook(doc) {
  if (!doc) return null;
  const out = {};
  for (const k of Object.keys(doc)) {
    if (PUBLIC_ALLOW_KEYS.has(k)) out[k] = doc[k];
  }
  return out;
}

/**
 * @param {Object} args
 * @param {string} [args.keyword] tìm theo tên/tác giả/mô tả
 * @param {string[]} [args.genres] mảng thể loại
 * @param {string[]} [args.themes]
 * @param {string[]} [args.mood]
 * @param {string[]} [args.contentTags]
 * @param {string[]} [args.audience]
 * @param {string} [args.country]
 * @param {number} [args.minPrice] giá tối thiểu (đồng)
 * @param {number} [args.maxPrice] giá tối đa (đồng)
 * @param {string} [args.language] vi | en | zh
 * @param {string} [args.sort] price_asc | price_desc | best_selling | newest
 * @param {number} [args.limit]
 */
async function searchBooks(args = {}) {
  const limit = Math.max(1, Math.min(Number(args.limit) || 6, 6));
  const filter = {
    status: 'published',
    $and: [
      { $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }] },
      { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
    ],
  };

  if (args.keyword) {
    const searchRegex = createVietnameseRegex(String(args.keyword).trim());
    if (searchRegex) {
      filter.$and.push({
        $or: [
          { name: { $regex: searchRegex } },
          { author: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
        ],
      });
    }
  }
  if (Array.isArray(args.genres) && args.genres.length) {
    filter.genres = { $in: args.genres.map((g) => String(g).trim().toLowerCase()).filter(Boolean) };
  }
  if (Array.isArray(args.themes) && args.themes.length) {
    filter.themes = { $in: args.themes.map((g) => String(g).trim().toLowerCase()).filter(Boolean) };
  }
  if (Array.isArray(args.mood) && args.mood.length) {
    filter.mood = { $in: args.mood.map((g) => String(g).trim().toLowerCase()).filter(Boolean) };
  }
  if (Array.isArray(args.contentTags) && args.contentTags.length) {
    filter.contentTags = {
      $in: args.contentTags.map((g) => String(g).trim().toLowerCase()).filter(Boolean),
    };
  }
  if (Array.isArray(args.audience) && args.audience.length) {
    filter.audience = { $in: args.audience.map((g) => String(g).trim().toLowerCase()).filter(Boolean) };
  }
  if (args.country) {
    filter.country = String(args.country).trim().toLowerCase();
  }
  if (args.language) {
    filter.language = String(args.language);
  }
  if (args.minPrice || args.maxPrice) {
    const min = Number(args.minPrice);
    const max = Number(args.maxPrice);
    const cond = {};
    if (Number.isFinite(min) && min > 0) cond.$gte = String(min);
    if (Number.isFinite(max) && max > 0) cond.$lte = String(max);
    if (Object.keys(cond).length) filter.price = cond;
  }

  let sort = { sold: -1, evaluate: -1 };
  if (args.sort === 'price_asc') sort = { price: 1 };
  else if (args.sort === 'price_desc') sort = { price: -1 };
  else if (args.sort === 'newest') sort = { publishedAt: -1, createAt: -1 };
  else if (args.sort === 'best_selling') sort = { sold: -1 };

  const docs = await Book.find(filter, PUBLIC_PROJECTION)
    .sort(sort)
    .limit(limit)
    .populate({ path: 'category', select: 'name slug' })
    .lean();

  return {
    count: docs.length,
    items: docs.map(sanitizeBook),
  };
}

module.exports = searchBooks;
module.exports.PUBLIC_PROJECTION = PUBLIC_PROJECTION;
