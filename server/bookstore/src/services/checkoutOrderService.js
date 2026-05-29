const mongoose = require('mongoose');
const Order = require('../app/models/Orders');
const Book = require('../app/models/Books');
const AccountUser = require('../app/models/AccountUsers');
const { isWebOrderableListing } = require('../app/utils/bookVisibility');
const { getActiveFlashSaleMap } = require('../app/services/flashSaleService');
const { afterOrderItemsSold } = require('../app/services/orderBookUpdate');
const {
  quoteCheckout,
  incrementVoucherUse,
  decrementVoucherUse,
  consumeUserVoucher,
  releaseUserVoucher,
  consumeLoyaltyPoints,
  releaseLoyaltyPoints,
} = require('../app/services/membershipService');

function listPriceVnd(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const n = Number.parseInt(digits || '0', 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1000 ? n : n * 1000;
}

function discountedBookPriceVnd(book, { isMember = false, flashDiscountPercent = 0 } = {}) {
  const base = listPriceVnd(book?.price);
  if (book?.isMemberOnly && !isMember) return base;
  const baseDisc = Number(book?.discount) || 0;
  const flashDisc = Math.max(0, Number(flashDiscountPercent) || 0);
  const discount = flashDisc > 0 ? flashDisc : baseDisc;
  return Math.max(0, Math.ceil(base * (1 - discount / 100)));
}

const PAYMENT_METHOD_CODE = { cod: 0, vnpay: 1, momo: 2 };

/**
 * @param {object} body — email, items, address, salesChannel, voucherCode, redeemPoints
 * @param {{ paymentChannel: 'cod'|'vnpay'|'momo', deductInventory?: boolean }} opts
 */
async function createCheckoutOrder(body, opts = {}) {
  const { paymentChannel = 'cod', deductInventory = paymentChannel === 'cod' } = opts;
  const { email, items, address, salesChannel, voucherCode, redeemPoints } = body;

  const account = await AccountUser.findOne({ email: String(email || '').toLowerCase().trim() })
    .select('isMember')
    .lean();
  const isMember = !!account?.isMember;
  const flashMap = await getActiveFlashSaleMap();

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Giỏ hàng trống');
    err.status = 400;
    throw err;
  }

  const enrichedItems = [];
  for (const it of items) {
    const rawId = it?.bookId?._id || it?.bookId;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
      const err = new Error('Đơn hàng có mục không hợp lệ (bookId)');
      err.status = 400;
      throw err;
    }
    const b = await Book.findById(rawId)
      .select('status deletedAt name author img stock costPrice price discount isMemberOnly')
      .lean();
    if (!b) {
      const err = new Error('Có sách không tồn tại trong đơn');
      err.status = 400;
      throw err;
    }
    if (b.deletedAt) {
      const err = new Error(`Sách "${b.name || rawId}" đã ngừng kinh doanh.`);
      err.status = 400;
      throw err;
    }
    if (!isWebOrderableListing(b)) {
      const err = new Error(`Sách "${b.name || rawId}" không được bán trên web`);
      err.status = 400;
      throw err;
    }
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) {
      const err = new Error('Số lượng không hợp lệ');
      err.status = 400;
      throw err;
    }
    if (typeof b.stock === 'number' && !Number.isNaN(b.stock) && b.stock < qty) {
      const err = new Error(`Tồn kho không đủ cho "${b.name || 'sách'}" (còn ${b.stock}, cần ${qty})`);
      err.status = 400;
      throw err;
    }
    const flashMeta = flashMap.get(String(rawId));
    const flashDiscountPercent = flashMeta ? flashMeta.discountPercent : 0;
    const unitPrice = discountedBookPriceVnd(b, { isMember, flashDiscountPercent });
    enrichedItems.push({
      bookId: new mongoose.Types.ObjectId(String(rawId)),
      quantity: Math.floor(qty),
      price: unitPrice,
      totalPrice: Math.floor(qty) * unitPrice,
      unitImportCost: Number(b.costPrice) || 0,
      bookSnapshot: {
        name: String(b.name || '').slice(0, 260),
        img: String(b.img || ''),
        author: String(b.author || '').slice(0, 200),
        listPriceAtOrder: listPriceVnd(b.price),
      },
    });
  }

  const goodsSubtotalDong = enrichedItems.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
  const quote = await quoteCheckout({
    email,
    goodsSubtotalDong,
    voucherCode,
    redeemPoints,
    items: enrichedItems,
  });
  const totalAmount = quote.totalDong;
  const ch = ['web', 'app', 'api'].includes(salesChannel) ? salesChannel : 'web';

  const newOrder = new Order({
    email,
    items: enrichedItems,
    totalAmount,
    goodsSubtotalDong: quote.goodsSubtotalDong,
    memberDiscountDong: quote.memberDiscountDong,
    voucherDiscountDong: quote.voucherDiscountDong,
    pointsRedeemed: quote.pointsRedeemed || 0,
    pointsDiscountDong: quote.pointsDiscountDong || 0,
    shippingFeeDong: quote.shippingFeeDong,
    membershipTierSlug: quote.tierSlug || '',
    voucherCode:
      quote.voucherDiscountDong > 0 && voucherCode
        ? String(voucherCode).trim().toUpperCase()
        : '',
    address,
    salesChannel: ch,
    isPay: false,
    Paymedthod: PAYMENT_METHOD_CODE[paymentChannel] ?? 0,
    status: paymentChannel === 'cod' ? 'Chờ xử lý' : 'Chờ xử lý',
  });

  await newOrder.save();

  if (quote.voucherDiscountDong > 0 && quote.voucherCodeApplied) {
    const consumed = await consumeUserVoucher(email, quote.voucherCodeApplied, newOrder._id);
    if (!consumed) {
      await Order.findByIdAndDelete(newOrder._id);
      const err = new Error('Voucher không còn hợp lệ cho tài khoản này');
      err.status = 400;
      throw err;
    }
    await incrementVoucherUse(quote.voucherCodeApplied);
    newOrder.voucherConsumed = true;
    await newOrder.save();
  }

  if ((quote.pointsRedeemed || 0) > 0) {
    const consumedPoints = await consumeLoyaltyPoints(email, quote.pointsRedeemed, newOrder._id);
    if (!consumedPoints) {
      if (quote.voucherDiscountDong > 0 && quote.voucherCodeApplied) {
        await releaseUserVoucher(email, quote.voucherCodeApplied, newOrder._id);
        await decrementVoucherUse(quote.voucherCodeApplied);
      }
      await Order.findByIdAndDelete(newOrder._id);
      const err = new Error('Điểm hiện tại không đủ, vui lòng thử lại');
      err.status = 400;
      throw err;
    }
    newOrder.pointsConsumed = true;
    await newOrder.save();
  }

  if (deductInventory) {
    await afterOrderItemsSold(enrichedItems, { orderId: newOrder._id });
  }

  return { order: newOrder, enrichedItems, quote };
}

/** Hủy đơn online khi VNPay/MoMo thất bại — giải phóng voucher/điểm */
async function cancelUnpaidOnlineOrder(order) {
  if (!order) return;
  if (order.status === 'Đã hủy') return;

  if (order.voucherCode && order.voucherConsumed) {
    const released = await releaseUserVoucher(order.email, order.voucherCode, order._id);
    if (released) await decrementVoucherUse(order.voucherCode);
    order.voucherConsumed = false;
  }
  if (order.pointsConsumed && (Number(order.pointsRedeemed) || 0) > 0) {
    const releasedPts = await releaseLoyaltyPoints(order.email, order.pointsRedeemed, order._id);
    if (releasedPts) order.pointsConsumed = false;
  }

  order.status = 'Đã hủy';
  order.isPay = false;
  await order.save();
}

/** Xác nhận thanh toán online thành công */
async function confirmOnlinePayment(order) {
  if (!order || order.isPay) return order;

  order.isPay = true;
  order.status = 'Chờ xử lý';
  await order.save();
  await afterOrderItemsSold(order.items, { orderId: order._id });
  return order;
}

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  const raw = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  if (raw === '::1' || raw === '::ffff:127.0.0.1') return '127.0.0.1';
  return String(raw).replace('::ffff:', '');
}

module.exports = {
  createCheckoutOrder,
  cancelUnpaidOnlineOrder,
  confirmOnlinePayment,
  resolveClientIp,
  PAYMENT_METHOD_CODE,
};
