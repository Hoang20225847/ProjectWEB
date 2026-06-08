/**
 * Parse ô nhập giá (VD: 150.000đ, 1.500.000) → đồng.
 * Legacy: số thuần < 1000 không có dấu phân cách nghìn → nghìn (150 → 150.000đ).
 */
function parseVndInputToDong(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const digitsOnly = s.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const hasThousandSep = /\D\d{3}\b/.test(s) || /\d{1,3}(\.\d{3})+/.test(s) || /\d{1,3}(,\d{3})+/.test(s);
  if (n < 1000 && !hasThousandSep) return n * 1000;
  return n;
}

/** Hiển thị số đồng dạng "150.000đ" (dùng ô nhập sách). */
function formatDongAsVndLabel(dong) {
  const n = Math.round(Number(dong) || 0);
  if (n <= 0) return '';
  return `${n.toLocaleString('vi-VN')}đ`;
}

/**
 * Giá niêm yết (đồng) từ DB — ưu tiên parse chuỗi VN; fallback legacy số thuần.
 */
function listPriceVnd(raw) {
  const fromParsed = parseVndInputToDong(raw);
  if (fromParsed > 0) return fromParsed;
  const n = Math.round(parseFloat(String(raw ?? '').replace(/[^\d.-]/g, '')) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return n;
  return n * 1000;
}

/**
 * % giảm hiển thị (badge, nhãn KM) — flash + % admin luôn hiện với mọi người;
 * % hạng hội viên chỉ hiện khi đã là hội viên và sách isMemberOnly.
 */
function resolveVisibleBookDiscountPercent(book, { isMember = false, memberTierDiscountPercent = 0 } = {}) {
  if (!book || typeof book !== 'object') return 0;
  const isMemberOnly = !!book.isMemberOnly;
  const flashLive = book?.flashSale?.status === 'live';
  const flashDisc = flashLive
    ? Math.max(0, Number(book?.flashSale?.discountPercent ?? book?.discount) || 0)
    : 0;
  const bookDisc = flashLive
    ? Math.max(0, Number(book?.flashSale?.originalDiscount) || 0)
    : Math.max(0, Number(book?.discount) || 0);

  if (flashDisc > 0) return flashDisc;
  if (bookDisc > 0) return bookDisc;
  if (isMemberOnly && isMember && memberTierDiscountPercent > 0) {
    return Math.max(0, Number(memberTierDiscountPercent) || 0);
  }
  return 0;
}

/**
 * % giảm áp dụng khi mua (giá trên thẻ / giỏ) — đồng bộ server:
 * flash → % admin → % hạng; sách hội viên: khách thường không được % admin/hạng.
 */
function resolvePayableBookDiscountPercent(book, { isMember = false, memberTierDiscountPercent = 0 } = {}) {
  if (!book || typeof book !== 'object') return 0;
  const isMemberOnly = !!book.isMemberOnly;
  const flashLive = book?.flashSale?.status === 'live';
  const flashDisc = flashLive
    ? Math.max(0, Number(book?.flashSale?.discountPercent ?? book?.discount) || 0)
    : 0;
  const bookDisc = flashLive
    ? Math.max(0, Number(book?.flashSale?.originalDiscount) || 0)
    : Math.max(0, Number(book?.discount) || 0);

  if (flashDisc > 0) return flashDisc;
  if (isMemberOnly && !isMember) return 0;
  if (bookDisc > 0) return bookDisc;
  if (isMemberOnly && isMember && memberTierDiscountPercent > 0) {
    return Math.max(0, Number(memberTierDiscountPercent) || 0);
  }
  return 0;
}

/** Sách đang có khuyến mãi cửa hàng (admin hoặc flash sale đang chạy). */
function bookHasStorePromotion(book) {
  if (!book || typeof book !== 'object') return false;
  if (book?.flashSale?.status === 'live') return true;
  return Math.max(0, Number(book?.discount) || 0) > 0;
}

/** @deprecated Dùng resolveVisibleBookDiscountPercent / resolvePayableBookDiscountPercent */
function resolveEffectiveBookDiscountPercent(book, opts = {}) {
  return resolvePayableBookDiscountPercent(book, opts);
}

/** Giá sau KM (đồng) — chỉ dùng để hiển thị; giỏ hàng vẫn dùng DiscountPrice (cùng đơn vị với giá gốc trong DB). */
function salePriceDisplayVnd(listPriceRaw, discountPct) {
  const base = listPriceVnd(listPriceRaw);
  const d = Number(discountPct) || 0;
  return Math.max(0, Math.ceil(base * (1 - d / 100)));
}

/** Chuẩn hóa số tiền (đồng) để in: số nhỏ hơn 1000 coi là nghìn. */
function normalizeDisplayDong(value) {
  const v = Math.round(Number(value) || 0);
  if (v <= 0) return 0;
  if (v >= 1000) return v;
  return v * 1000;
}

function formatVndDisplay(value) {
  const dong = normalizeDisplayDong(value);
  return `${dong.toLocaleString('vi-VN')} đ`;
}

/** Giá sau KM (đồng) để gửi giỏ / đơn, luôn đồng bộ với giá hiển thị. */
function DiscountPrice(a, b) {
  const base = listPriceVnd(a);
  const discount = Number(b) || 0;
  return Math.max(0, Math.ceil(base * (1 - discount / 100)));
}

export {
  listPriceVnd,
  salePriceDisplayVnd,
  normalizeDisplayDong,
  formatVndDisplay,
  parseVndInputToDong,
  formatDongAsVndLabel,
  resolveVisibleBookDiscountPercent,
  resolvePayableBookDiscountPercent,
  bookHasStorePromotion,
  resolveEffectiveBookDiscountPercent,
};
export default DiscountPrice;
