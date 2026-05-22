const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PublisherSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200, unique: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Publisher', PublisherSchema);

