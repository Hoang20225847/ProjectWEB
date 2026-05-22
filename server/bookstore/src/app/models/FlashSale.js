const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const FlashSaleItemSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    discountPercent: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false },
);

const FlashSaleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
    items: { type: [FlashSaleItemSchema], default: [] },
  },
  { timestamps: true },
);

FlashSaleSchema.index({ startsAt: 1, endsAt: 1, active: 1 });
FlashSaleSchema.index({ 'items.bookId': 1 });

module.exports = mongoose.model('FlashSale', FlashSaleSchema);
