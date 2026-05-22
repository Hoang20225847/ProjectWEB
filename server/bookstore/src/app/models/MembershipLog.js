const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/** Lịch sử thay đổi hạng (audit) */
const MembershipLogSchema = new Schema(
  {
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    fromTierSlug: { type: String, default: '', trim: true },
    toTierSlug: { type: String, required: true, trim: true },
    totalSpentDong: { type: Number, default: 0, min: 0 },
    reason: { type: String, default: 'spend_threshold', trim: true, maxlength: 64 },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true },
);

MembershipLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MembershipLog', MembershipLogSchema);
