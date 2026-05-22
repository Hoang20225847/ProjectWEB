const mongoose = require('mongoose');

const { Schema } = mongoose;

const AuthorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 4000 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AuthorSchema.index({ sortOrder: 1, name: 1 });

module.exports = mongoose.model('Author', AuthorSchema);
