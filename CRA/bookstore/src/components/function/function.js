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
};
export default DiscountPrice;
