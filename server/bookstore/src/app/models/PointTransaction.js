const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TX_TYPES = ['earn', 'redeem', 'expire', 'adjust'];

const PointTransactionSchema = new Schema(
  {
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    account: { type: Schema.Types.ObjectId, ref: 'account', default: null },
    type: { type: String, enum: TX_TYPES, required: true },
    /** Dương = cộng điểm, âm = trừ */
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

PointTransactionSchema.index({ email: 1, createdAt: -1 });

const PointTransaction = mongoose.model('PointTransaction', PointTransactionSchema);
PointTransaction.TX_TYPES = TX_TYPES;
module.exports = PointTransaction;
