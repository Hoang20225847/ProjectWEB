const Book = require('../../models/Books');
const Category = require('../../models/Category');
const Review = require('../../models/Review');
const { embedText } = require('./embedder');
const qdrant = require('../clients/qdrantClient');

/**
 * Chỉ đưa các trường phục vụ ngữ nghĩa vào TEXT embed (không có giá, stock, ngày,...).
 */
function joinLabels(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {object} book — document Book (lean)
 * @param {{ categoryName?: string, reviewExcerpts?: string }} ctx
 */
function bookToEmbedText(book, ctx = {}) {
  const { categoryName = '', reviewExcerpts = '' } = ctx;
  const lines = [];
  if (book?.name) lines.push(`Tựa sách: ${book.name}`);
  if (book?.author) lines.push(`Tác giả: ${book.author}`);
  if (categoryName) lines.push(`Danh mục cửa hàng: ${categoryName}`);
  const genres = joinLabels(book?.genres);
  if (genres) lines.push(`Thể loại: ${genres}`);
  const themes = joinLabels(book?.themes);
  if (themes) lines.push(`Chủ đề và motif: ${themes}`);
  const mood = joinLabels(book?.mood);
  if (mood) lines.push(`Tông cảm xúc: ${mood}`);
  const tags = joinLabels(book?.contentTags);
  if (tags) lines.push(`Nhãn nội dung: ${tags}`);
  const audience = joinLabels(book?.audience);
  if (audience) lines.push(`Đối tượng phù hợp: ${audience}`);
  if (book?.language) lines.push(`Ngôn ngữ: ${book.language}`);
  if (book?.country) lines.push(`Bối cảnh / quốc gia: ${book.country}`);
  if (book?.ageRange) lines.push(`Gợi ý độ tuổi: ${book.ageRange}`);
  if (book?.description) lines.push(`Giới thiệu / mô tả: ${book.description}`);
  if (reviewExcerpts) lines.push(`Trích nhận xét độc giả: ${reviewExcerpts}`);
  return lines.filter(Boolean).join('\n');
}

function normSemanticArray(arr, max = 48) {
  return (Array.isArray(arr) ? arr : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, max);
}

/** Payload chỉ metadata semantic + khóa cần filter — không lưu giá/tồn kho (thay đổi realtime). */
function publicPayload(book) {
  const country = book.country != null ? String(book.country).trim().toLowerCase() : '';
  const catRaw = book.category;
  let categoryId = '';
  if (catRaw && typeof catRaw === 'object' && catRaw._id) categoryId = String(catRaw._id);
  else if (catRaw) categoryId = String(catRaw);

  return {
    domain: 'product',
    bookId: String(book._id),
    status: book.status || 'draft',
    name: (book.name || '').slice(0, 260),
    genres: normSemanticArray(book.genres),
    themes: normSemanticArray(book.themes),
    mood: normSemanticArray(book.mood),
    contentTags: normSemanticArray(book.contentTags),
    audience: normSemanticArray(book.audience),
    language: (book.language || 'vi').toLowerCase().slice(0, 16),
    categoryId,
    country: country.slice(0, 80),
    isMemberOnly: Boolean(book.isMemberOnly),
  };
}

async function fetchSemanticContext(book) {
  let categoryName = '';
  if (book?.category) {
    const cid =
      typeof book.category === 'object' && book.category._id ? book.category._id : book.category;
    const c = await Category.findById(cid).select('name').lean();
    if (c?.name) categoryName = String(c.name);
  }

  let reviewExcerpts = '';
  if (book?._id) {
    const rs = await Review.find({ bookId: book._id })
      .sort({ createdAt: -1 })
      .limit(14)
      .select('comment')
      .lean();
    const chunks = [];
    let total = 0;
    for (const r of rs) {
      const t = String(r?.comment || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const piece = t.slice(0, 220);
      chunks.push(piece);
      total += piece.length;
      if (total >= 1700) break;
    }
    reviewExcerpts = chunks.join(' | ');
  }
  return { categoryName, reviewExcerpts };
}

/**
 * Quyết định sách có nên trong vector không (điều kiện list / catalog).
 * Chi tiết giá-stock vẫn tra Mongo sau retrieval.
 */
function shouldIndex(book) {
  if (!book) return false;
  if (book.deletedAt) return false;
  if (book.status && book.status !== 'published') return false;
  if (typeof book.stock === 'number' && book.stock <= 0) return false;
  return true;
}

/**
 * Upsert / remove 1 sách (collection product).
 */
async function syncBook(book) {
  if (!book || !book._id) return { ok: false, reason: 'no_book' };
  const pointId = qdrant.objectIdToPointId(book._id);
  if (!shouldIndex(book)) {
    await qdrant.deletePoint('product', pointId);
    return { ok: true, action: 'deleted' };
  }
  const ctx = await fetchSemanticContext(book);
  const text = bookToEmbedText(book, ctx).trim();
  if (!text) {
    await qdrant.deletePoint('product', pointId);
    return { ok: true, action: 'deleted_empty' };
  }
  const vec = await embedText(text);
  if (!Array.isArray(vec) || vec.length === 0) return { ok: false, reason: 'embed_failed' };
  const ok = await qdrant.upsertPoint('product', {
    id: pointId,
    vector: vec,
    payload: publicPayload(book),
  });
  return { ok, action: ok ? 'upserted' : 'failed' };
}

async function removeBookById(bookId) {
  if (!bookId) return;
  await qdrant.deletePoint('product', qdrant.objectIdToPointId(bookId));
}

async function syncBookFromId(bookId) {
  if (!bookId) return null;
  const id = typeof bookId === 'object' && bookId._id ? bookId._id : bookId;
  const full = await Book.findById(id).lean();
  if (!full) {
    await removeBookById(id);
    return { ok: true, action: 'deleted_missing' };
  }
  return syncBook(full);
}

module.exports = {
  syncBook,
  removeBookById,
  syncBookFromId,
  bookToEmbedText,
  shouldIndex,
  publicPayload,
};
