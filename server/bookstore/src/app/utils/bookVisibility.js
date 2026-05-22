/**
 * Chiều 1 — catalog (status): độc lập với tồn kho.
 * Sách cũ không có `status` được coi như published (tương thích ngược).
 */

const LISTING_STATUSES = ['draft', 'published', 'unlisted', 'archived'];

/** Mongo filter exclude soft-deleted — dùng kèm các filter khác. */
function mongoFilterNotDeleted() {
  return { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
}

function mongoFilterPublishedCatalog() {
  return {
    $and: [
      {
        $or: [
          { status: 'published' },
          { status: { $exists: false } },
          { status: null },
        ],
      },
      mongoFilterNotDeleted(),
    ],
  };
}

function isWebOrderableListing(doc) {
  if (!doc) return false;
  if (doc.deletedAt) return false;
  const s = doc.status;
  if (s == null || s === '' || !LISTING_STATUSES.includes(s)) return true;
  return s === 'published' || s === 'unlisted';
}

function canViewBookOnStorefront(doc, { isAdmin } = {}) {
  if (!doc) return false;
  if (doc.deletedAt && !isAdmin) return false;
  if (isAdmin) return true;
  const s = doc.status;
  if (s == null || s === '' || !LISTING_STATUSES.includes(s)) return true;
  return s === 'published' || s === 'unlisted';
}

/** Chiều 2 — tính từ stock / minStock, không lưu DB */
function computeStockTier(book) {
  const stock = book.stock;
  if (stock === undefined || stock === null) return 'unmanaged';
  const n = Number(stock);
  if (!Number.isFinite(n)) return 'unmanaged';
  if (n <= 0) return 'outOfStock';
  const minS =
    book.minStock != null && Number.isFinite(Number(book.minStock))
      ? Math.max(0, Number(book.minStock))
      : 5;
  if (n <= minS) return 'lowStock';
  return 'inStock';
}

module.exports = {
  LISTING_STATUSES,
  mongoFilterPublishedCatalog,
  mongoFilterNotDeleted,
  isWebOrderableListing,
  canViewBookOnStorefront,
  computeStockTier,
};
