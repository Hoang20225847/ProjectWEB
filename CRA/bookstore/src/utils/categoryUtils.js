/** Chuỗi id danh mục (ObjectId hoặc object populate) */
export function categoryIdStr(c) {
  if (c == null) return '';
  if (typeof c === 'object' && c._id != null) return String(c._id);
  return String(c);
}

/** Lọc theo query ?category= (slug, _id, legacyCode, hoặc số cũ 1–4) */
export function bookMatchesCategoryQuery(book, param) {
  if (param == null || param === '') return true;
  const p = String(param).trim();
  const c = book.category;
  if (!c) return false;
  if (typeof c === 'object') {
    if (c.slug && c.slug === p) return true;
    if (c._id && String(c._id) === p) return true;
    if (c.legacyCode != null && String(c.legacyCode) === p) return true;
    return false;
  }
  return String(c) === p;
}

export function sameCategory(catA, catB) {
  const a = categoryIdStr(catA);
  const b = categoryIdStr(catB);
  return a !== '' && a === b;
}
