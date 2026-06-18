const LISTING_STATUSES = ['draft', 'published', 'unlisted', 'archived'];

function mongoFilterNotDeleted() {
  return { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
}

/// <summary>
/// Mongo filter catalog đã publish (sách cũ không có status vẫn được coi published).
/// </summary>
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

/// <summary>
/// Sách có thể thêm giỏ/đặt hàng trên web (published hoặc unlisted, chưa xóa mềm).
/// </summary>
function isWebOrderableListing(doc) {
  if (!doc) return false;
  if (doc.deletedAt) return false;
  const s = doc.status;
  if (s == null || s === '' || !LISTING_STATUSES.includes(s)) return true;
  return s === 'published' || s === 'unlisted';
}

/// <summary>
/// Hiển thị chi tiết sách trên storefront; admin vẫn xem được sách đã xóa mềm.
/// </summary>
function canViewBookOnStorefront(doc, { isAdmin } = {}) {
  if (!doc) return false;
  if (doc.deletedAt && !isAdmin) return false;
  if (isAdmin) return true;
  const s = doc.status;
  if (s == null || s === '' || !LISTING_STATUSES.includes(s)) return true;
  return s === 'published' || s === 'unlisted';
}

/// <summary>
/// Phân loại tồn kho từ stock/minStock: outOfStock, lowStock, inStock, unmanaged.
/// </summary>
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
