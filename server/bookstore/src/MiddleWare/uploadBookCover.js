const multer = require('multer');
const path = require('path');
const { buildBookCoverFilename } = require('../app/utils/bookCoverFilename');

const uploadDir = path.join(__dirname, '../public/uploads');

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const bookName = req.body?.bookName || req.body?.name || 'sach';
    const slotRaw = String(req.body?.slot || 'cover').trim();
    const slot = ['cover', '1', '2', '3', '4'].includes(slotRaw) ? slotRaw : 'cover';
    const filename = buildBookCoverFilename(
      uploadDir,
      bookName,
      file.originalname,
      file.mimetype,
      slot,
    );
    cb(null, filename);
  },
});

const uploadBookCover = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    if (!ok) {
      return cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF)'));
    }
    cb(null, true);
  },
});

module.exports = uploadBookCover;
