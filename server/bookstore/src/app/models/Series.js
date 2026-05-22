const mongoose = require('mongoose');

const { Schema } = mongoose;

const SeriesSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 4000 },
    /** Thứ tự hiển thị trong admin / storefront */
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SeriesSchema.index({ sortOrder: 1, name: 1 });

module.exports = mongoose.model('Series', SeriesSchema);
