const FlashSale = require('../models/FlashSale');

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_UPCOMING_WINDOW_HOURS = 7;

/**
 * Trả về Map(bookIdString -> meta) cho các sách đang trong khung giờ flash sale.
 * Nếu một sách thuộc nhiều flash sale đang chạy → giữ % giảm cao nhất.
 */
async function getActiveFlashSaleMap(now = new Date()) {
  const sales = await FlashSale.find({
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).lean();

  const map = new Map();
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const id = String(item.bookId);
      const disc = Math.max(0, Math.min(99, Math.round(Number(item.discountPercent) || 0)));
      if (disc <= 0) continue;
      const prev = map.get(id);
      if (!prev || disc > prev.discountPercent) {
        map.set(id, {
          status: 'live',
          flashSaleId: String(sale._id),
          title: sale.title,
          discountPercent: disc,
          startsAt: sale.startsAt,
          endsAt: sale.endsAt,
        });
      }
    }
  }
  return map;
}

/**
 * Trả về Map(bookIdString -> meta) cho các sách sắp được flash sale trong vòng N giờ.
 * Bỏ qua sách đang trong flash sale ngay lúc này (vì nó sẽ thuộc map active).
 */
async function getUpcomingFlashSaleMap(now = new Date(), windowHours = DEFAULT_UPCOMING_WINDOW_HOURS) {
  const window = Math.max(0, Number(windowHours) || 0) * HOUR_MS;
  const horizon = new Date(now.getTime() + window);
  const sales = await FlashSale.find({
    active: true,
    startsAt: { $gt: now, $lte: horizon },
  }).lean();

  const map = new Map();
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const id = String(item.bookId);
      const disc = Math.max(0, Math.min(99, Math.round(Number(item.discountPercent) || 0)));
      if (disc <= 0) continue;
      const prev = map.get(id);
      if (!prev || new Date(sale.startsAt).getTime() < new Date(prev.startsAt).getTime()) {
        map.set(id, {
          status: 'upcoming',
          flashSaleId: String(sale._id),
          title: sale.title,
          discountPercent: disc,
          startsAt: sale.startsAt,
          endsAt: sale.endsAt,
        });
      }
    }
  }
  return map;
}

/**
 * Gắn thông tin flashSale vào danh sách sách trả ra cho client.
 * - Nếu đang chạy: book.flashSale = {status:'live', ...} và book.discount = % flash
 * - Nếu sắp chạy (trong N giờ): book.flashSale = {status:'upcoming', ...}, không đổi discount.
 */
async function attachFlashSaleToBooks(books, opts = {}) {
  if (!Array.isArray(books) || books.length === 0) return books;
  const now = new Date();
  const windowHours = opts.upcomingWindowHours ?? DEFAULT_UPCOMING_WINDOW_HOURS;
  const [activeMap, upcomingMap] = await Promise.all([
    getActiveFlashSaleMap(now),
    getUpcomingFlashSaleMap(now, windowHours),
  ]);

  return books.map((b) => {
    const idStr = String(b?._id || '');
    if (!idStr) return b;
    const live = activeMap.get(idStr);
    if (live) {
      const baseDisc = Math.max(0, Number(b.discount) || 0);
      const flashDisc = live.discountPercent;
      const finalDisc = flashDisc;
      const isPlain = !b || typeof b.toObject !== 'function';
      const next = isPlain ? { ...b } : b.toObject();
      next.discount = finalDisc;
      next.flashSale = { ...live, originalDiscount: baseDisc };
      return next;
    }
    const soon = upcomingMap.get(idStr);
    if (soon) {
      const isPlain = !b || typeof b.toObject !== 'function';
      const next = isPlain ? { ...b } : b.toObject();
      next.flashSale = soon;
      return next;
    }
    return b;
  });
}

/**
 * Lấy mức giảm hiệu lực của một sách (đồng bộ với hệ thống đặt hàng).
 * Trả về % giảm hiệu lực. Nếu có flash sale đang chạy thì ưu tiên flash sale.
 */
async function resolveEffectiveDiscount(book, now = new Date()) {
  if (!book?._id) return Number(book?.discount) || 0;
  const map = await getActiveFlashSaleMap(now);
  const flash = map.get(String(book._id));
  const baseDisc = Math.max(0, Number(book.discount) || 0);
  if (!flash) return baseDisc;
  return flash.discountPercent;
}

module.exports = {
  getActiveFlashSaleMap,
  getUpcomingFlashSaleMap,
  attachFlashSaleToBooks,
  resolveEffectiveDiscount,
  DEFAULT_UPCOMING_WINDOW_HOURS,
};
