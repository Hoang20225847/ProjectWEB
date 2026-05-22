const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/** Cấu hình hạng hội viên (Bạc / Vàng / Kim cương) — đơn vị đồng VN */
const MembershipTierSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    sortOrder: { type: Number, default: 0 },
    /** Ngưỡng chi tiêu tích lũy tối thiểu (đồng) để đạt hạng */
    minTotalSpentDong: { type: Number, required: true, default: 0, min: 0 },
    /** Giảm giá % trên tổng tiền hàng (trước ship) */
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** Miễn phí ship mọi đơn */
    shipFreeAll: { type: Boolean, default: false },
    /** Nếu không shipFreeAll: miễn ship khi tiền hàng sau giảm ≥ ngưỡng này (đồng) */
    shipFreeMinSubtotalDong: { type: Number, default: null, min: 0 },
    /** Điểm tích lũy: điểm / mỗi 1.000đ giá trị đơn hoàn thành */
    pointsPer1000Vnd: { type: Number, default: 10, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('MembershipTier', MembershipTierSchema);
