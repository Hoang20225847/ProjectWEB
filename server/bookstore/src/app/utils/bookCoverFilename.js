const fs = require('fs');
const path = require('path');

/** Chuyển tên sách thành tên file an toàn (không dấu, kebab-case). */
function slugifyBookName(name) {
  return (
    String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'sach'
  );
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function normalizeImageExt(originalName, mimetype) {
  let ext = path.extname(String(originalName || '')).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    if (mimetype === 'image/png') ext = '.png';
    else if (mimetype === 'image/webp') ext = '.webp';
    else if (mimetype === 'image/gif') ext = '.gif';
    else ext = '.jpg';
  }
  if (ext === '.jpeg') ext = '.jpg';
  return ext;
}

/**
 * @param {string} uploadDir — thư mục uploads
 * @param {string} bookName
 * @param {string} originalName
 * @param {string} mimetype
 */
/**
 * @param {'cover'|'1'|'2'|'3'|'4'} slot — ảnh chính: slug.ext; ảnh phụ: slug-1.ext …
 */
function buildBookCoverFilename(uploadDir, bookName, originalName, mimetype, slot = 'cover') {
  const base = slugifyBookName(bookName);
  const ext = normalizeImageExt(originalName, mimetype);
  const suffix = slot === 'cover' ? '' : `-${slot}`;
  let candidate = `${base}${suffix}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(uploadDir, candidate))) {
    candidate = `${base}${suffix}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

module.exports = {
  slugifyBookName,
  buildBookCoverFilename,
  ALLOWED_EXT,
};
