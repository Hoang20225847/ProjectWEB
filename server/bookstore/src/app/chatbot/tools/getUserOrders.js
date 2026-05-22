const Order = require('../../models/Orders');

/**
 * Tra cứu đơn hàng của user đang đăng nhập.
 * - `email` được Controller tự bơm từ req.user.email (JWT). Nếu không có email
 *   (khách chưa đăng nhập), tool trả requiresLogin = true để LLM nhắc user đăng nhập.
 * - Không trả thông tin nhạy cảm (cost, supplier, minStock...).
 *
 * @param {Object} args
 * @param {string} args.email   Email user (Controller inject từ JWT, KHÔNG tin client gửi).
 * @param {number} [args.limit] Số đơn gần nhất (mặc định 5, tối đa 10).
 * @param {string} [args.status] Lọc theo trạng thái ("Chờ xử lý" | "Đang giao" | "Hoàn thành" | "Đã hủy").
 */
async function getUserOrders(args = {}) {
  const email = String(args.email || '').toLowerCase().trim();
  if (!email) {
    return {
      requiresLogin: true,
      count: 0,
      items: [],
      message: 'Người dùng chưa đăng nhập — chưa thể tra cứu đơn hàng cá nhân.',
    };
  }

  const limit = Math.max(1, Math.min(Number(args.limit) || 5, 10));
  const filter = { email };
  if (args.status) filter.status = String(args.status);

  const docs = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'items.bookId', select: 'name img author' })
    .lean();

  const items = docs.map((o) => ({
    id: String(o._id),
    shortId: String(o._id).slice(-6),
    status: o.status,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
    voucherCode: o.voucherCode || '',
    pointsRedeemed: o.pointsRedeemed || 0,
    membershipTierSlug: o.membershipTierSlug || '',
    items: (o.items || []).slice(0, 6).map((it) => ({
      bookName: it?.bookId?.name || '(sách đã ẩn)',
      author: it?.bookId?.author || '',
      quantity: it?.quantity || 0,
      price: it?.price || 0,
    })),
  }));

  return { requiresLogin: false, count: items.length, items };
}

module.exports = getUserOrders;
