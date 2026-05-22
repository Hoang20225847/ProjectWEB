/**
 * Parse ô nhập giá VN (VD: 150.000đ, 1.500.000, 150000) → số nguyên đồng.
 * Legacy: số thuần < 1000 không có dấu phân cách nghìn → coi là nghìn (150 → 150.000đ).
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

/** Chuỗi lưu DB Book.price: chỉ chữ số, đơn vị đồng đầy đủ (VD "150000"). */
function bookPriceToStorageString(raw) {
  const d = parseVndInputToDong(raw);
  return d > 0 ? String(d) : '';
}

/** Đồng từ Book.price (chuỗi DB / legacy). */
function listPriceVndFromBookPrice(raw) {
  const d = parseVndInputToDong(raw);
  if (d > 0) return d;
  const n = Math.round(parseFloat(String(raw ?? '').replace(/[^\d.-]/g, '')) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return n;
  return n * 1000;
}

module.exports = { parseVndInputToDong, bookPriceToStorageString, listPriceVndFromBookPrice };
