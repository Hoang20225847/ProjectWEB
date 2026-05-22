const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BENEFIT_KINDS = ['order_discount_override', 'free_shipping_override', 'points_multiplier', 'custom_note'];

/** Ưu đãi chi tiết gắn hạng — có thể bật/tắt độc lập, payload linh hoạt */
const MemberBenefitSchema = new Schema(
  {
    membershipTier: { type: Schema.Types.ObjectId, ref: 'MembershipTier', required: true, index: true },
    benefitKind: { type: String, enum: BENEFIT_KINDS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    /** VD: { percent: 12 } | { minOrderDong: 250000 } | { multiplier: 1.5 } */
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const MemberBenefit = mongoose.model('MemberBenefit', MemberBenefitSchema);
MemberBenefit.BENEFIT_KINDS = BENEFIT_KINDS;
module.exports = MemberBenefit;
