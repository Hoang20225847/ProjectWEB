const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const Category = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  order: { type: Number, default: 0 },
  /** Giữ để khớp URL / dữ liệu cũ dạng số 1–4 (tuỳ chọn) */
  legacyCode: { type: Number, sparse: true },
});

module.exports = mongoose.model('Category', Category);
