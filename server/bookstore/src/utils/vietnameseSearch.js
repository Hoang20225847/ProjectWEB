/**
 * Tìm kiếm tiếng Việt không phân biệt dấu (sach ↔ sách).
 */

const TONE_GROUPS = {
  a: 'àáảãạăằắẳẵặâầấẩẫậ',
  e: 'èéẻẽẹêềếểễệ',
  i: 'ìíỉĩị',
  o: 'òóỏõọôồốổỗộơờớởỡợ',
  u: 'ùúủũụưừứửữự',
  y: 'ỳýỷỹỵ',
};

function removeVietnameseTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function escapeRegexChar(ch) {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pattern regex: gõ không dấu vẫn khớp có dấu (vd. "sach" → "Sách").
 * @param {string} rawQuery
 * @returns {string|null}
 */
function vietnameseRegexPattern(rawQuery) {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return null;

  const base = removeVietnameseTones(trimmed).toLowerCase();
  let pattern = '';

  for (const ch of base) {
    if (ch === 'd') {
      pattern += '[dđ]';
    } else if (TONE_GROUPS[ch]) {
      pattern += `[${ch}${TONE_GROUPS[ch]}]`;
    } else {
      pattern += escapeRegexChar(ch);
    }
  }

  return pattern || null;
}

/**
 * @param {string} rawQuery
 * @param {string} [flags='i']
 * @returns {RegExp|null}
 */
function createVietnameseRegex(rawQuery, flags = 'i') {
  const pattern = vietnameseRegexPattern(rawQuery);
  if (!pattern) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * So khớp chuỗi phía client (filter local).
 */
function matchesVietnameseSearch(text, query) {
  const q = removeVietnameseTones(query).toLowerCase().trim();
  if (!q) return true;
  const hay = removeVietnameseTones(text).toLowerCase();
  return hay.includes(q);
}

module.exports = {
  removeVietnameseTones,
  vietnameseRegexPattern,
  createVietnameseRegex,
  matchesVietnameseSearch,
};
