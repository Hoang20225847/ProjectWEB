const Voucher = require('../../models/Voucher');

/**
 * Kiểm tra 1 mã voucher có dùng được không + ước lượng tiền giảm.
 * @param {{code:string, orderTotalDong?:number, isMember?:boolean, tierSlug?:string}} args
 */
async function checkVoucher(args = {}) {
  const code = String(args.code || '').trim().toUpperCase();
  if (!code) return { valid: false, reason: 'Bạn cần cung cấp mã voucher.' };

  const v = await Voucher.findOne({ code }).lean();
  if (!v) return { valid: false, reason: `Không tìm thấy mã ${code}.` };

  if (!v.active) return { valid: false, reason: 'Voucher hiện đang ngừng áp dụng.' };

  const now = new Date();
  if (v.startsAt && now < v.startsAt) {
    return { valid: false, reason: `Voucher chưa bắt đầu, áp dụng từ ${v.startsAt.toLocaleString('vi-VN')}.` };
  }
  if (v.endsAt && now > v.endsAt) {
    return { valid: false, reason: 'Voucher đã hết hạn.' };
  }

  if (typeof v.maxRedemptions === 'number' && v.maxRedemptions > 0) {
    if ((v.redemptionCount || 0) >= v.maxRedemptions) {
      return { valid: false, reason: 'Voucher đã hết lượt sử dụng.' };
    }
  }

  if (v.audienceType === 'member' && !args.isMember) {
    return { valid: false, reason: 'Voucher này chỉ dành cho hội viên.' };
  }
  if (v.audienceType === 'tiers') {
    const tierSlug = String(args.tierSlug || '').toLowerCase();
    const allow = (v.tierSlugs || []).map((s) => String(s).toLowerCase());
    if (!tierSlug || !allow.includes(tierSlug)) {
      return { valid: false, reason: 'Hạng hội viên hiện tại chưa đủ điều kiện cho voucher này.' };
    }
  }

  const orderTotal = Number(args.orderTotalDong) || 0;
  if (orderTotal > 0 && v.minOrderDong && orderTotal < v.minOrderDong) {
    return {
      valid: false,
      reason: `Đơn tối thiểu để dùng mã là ${v.minOrderDong.toLocaleString('vi-VN')}đ.`,
    };
  }

  let discount = 0;
  if (v.discountType === 'percent') {
    discount = Math.round((orderTotal * (Number(v.discountValue) || 0)) / 100);
  } else {
    discount = Math.round(Number(v.discountValue) || 0);
  }
  if (typeof v.maxDiscountDong === 'number' && v.maxDiscountDong > 0) {
    discount = Math.min(discount, v.maxDiscountDong);
  }
  if (orderTotal > 0) discount = Math.min(discount, orderTotal);

  return {
    valid: true,
    code: v.code,
    title: v.title,
    discountType: v.discountType,
    discountValue: v.discountValue,
    minOrderDong: v.minOrderDong || 0,
    maxDiscountDong: v.maxDiscountDong || null,
    endsAt: v.endsAt,
    estimateDiscountDong: discount,
  };
}

module.exports = checkVoucher;
