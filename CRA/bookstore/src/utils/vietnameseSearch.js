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

export function removeVietnameseTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function escapeRegexChar(ch) {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function vietnameseRegexPattern(rawQuery) {
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

export function createVietnameseRegex(rawQuery, flags = 'i') {
  const pattern = vietnameseRegexPattern(rawQuery);
  if (!pattern) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function matchesVietnameseSearch(text, query) {
  const q = removeVietnameseTones(query).toLowerCase().trim();
  if (!q) return true;
  const hay = removeVietnameseTones(text).toLowerCase();
  return hay.includes(q);
}
