const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DISCOUNT_TYPES = ['percent', 'fixed'];
const VOUCHER_VISIBILITY = ['public', 'private'];
const VOUCHER_AUDIENCE = ['all', 'member', 'tiers'];

/** Mã ưu đãi có điều kiện (campaign) */
const VoucherSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    /** percent: 0–100; fixed: số đồng */
    discountValue: { type: Number, required: true, min: 0 },
    /** Trần giảm tối đa (đồng), dùng cho cả percent/fixed; null = không giới hạn */
    maxDiscountDong: { type: Number, default: null, min: 0 },
    minOrderDong: { type: Number, default: 0, min: 0 },
    /** all: mọi tài khoản; member: chỉ hội viên; tiers: hội viên thuộc tierSlugs */
    audienceType: { type: String, enum: VOUCHER_AUDIENCE, default: 'member' },
    /** Dùng khi audienceType='tiers' */
    tierSlugs: { type: [String], default: [] },
    /** public: vào kho voucher user đủ điều kiện; private: chỉ dùng khi nhập đúng mã */
    visibility: { type: String, enum: VOUCHER_VISIBILITY, default: 'public' },
    /** true = mọi sách; false = chỉ các sách trong eligibleBookIds */
    applyAllBooks: { type: Boolean, default: true },
    eligibleBookIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Book' }], default: [] },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    /** Giới hạn số lần dùng tối đa cho mỗi account (null = không giới hạn) */
    maxUsesPerAccount: { type: Number, default: 1, min: 1 },
    maxRedemptions: { type: Number, default: null },
    redemptionCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Voucher = mongoose.model('Voucher', VoucherSchema);
Voucher.DISCOUNT_TYPES = DISCOUNT_TYPES;
Voucher.VOUCHER_VISIBILITY = VOUCHER_VISIBILITY;
Voucher.VOUCHER_AUDIENCE = VOUCHER_AUDIENCE;
module.exports = Voucher;
