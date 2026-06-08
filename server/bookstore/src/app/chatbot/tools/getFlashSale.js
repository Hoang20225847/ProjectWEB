const FlashSale = require('../../models/FlashSale');
const Book = require('../../models/Books');
const ChatbotCache = require('../models/ChatbotCache');
const config = require('../config');
const { listPriceVndFromBookPrice } = require('../../utils/moneyVnd');

const CACHE_KEY = 'flash_sale:live_and_upcoming';
const HOUR_MS = 60 * 60 * 1000;
/** Cửa sổ "sắp diễn ra" cho chatbot — rộng hơn API storefront (7h) để trả lời câu hỏi lịch KM. */
const UPCOMING_WINDOW_HOURS = Number(config.cache.flashUpcomingWindowHours) || 168;

function mapSaleItems(sale, bookMap) {
  return (sale.items || [])
    .map((it) => {
      const b = bookMap.get(String(it.bookId));
      if (!b) return null;
      const orig = listPriceVndFromBookPrice(b.price);
      const pct = Number(it.discountPercent) || 0;
      const salePrice = Math.max(0, Math.round(orig * (1 - pct / 100)));
      return {
        bookId: String(b._id),
        name: b.name,
        author: b.author || '',
        img: b.img || '',
        originalPrice: orig,
        discountPercent: pct,
        salePrice,
      };
    })
    .filter(Boolean);
}

async function hydrateSales(sales, status) {
  const bookIds = new Set();
  for (const s of sales) {
    for (const it of s.items || []) {
      if (it?.bookId) bookIds.add(String(it.bookId));
    }
  }
  const books = bookIds.size
    ? await Book.find(
        { _id: { $in: [...bookIds] }, status: 'published' },
        { name: 1, author: 1, img: 1, price: 1 },
      ).lean()
    : [];
  const bookMap = new Map(books.map((b) => [String(b._id), b]));
  return sales.map((s) => ({
    _id: String(s._id),
    status,
    title: s.title,
    description: s.description || '',
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    items: mapSaleItems(s, bookMap),
  }));
}

/**
 * Trả về flash sale đang chạy + sắp diễn ra (trong cửa sổ UPCOMING_WINDOW_HOURS).
 * Cache MongoDB TTL để không quá tải DB khi nhiều user hỏi.
 */
async function getFlashSale() {
  const cached = await ChatbotCache.getValue(CACHE_KEY);
  if (cached) return cached;

  const now = new Date();
  const horizon = new Date(now.getTime() + UPCOMING_WINDOW_HOURS * HOUR_MS);

  const [liveRaw, upcomingRaw] = await Promise.all([
    FlashSale.find({
      active: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    })
      .sort({ endsAt: 1 })
      .lean(),
    FlashSale.find({
      active: true,
      startsAt: { $gt: now, $lte: horizon },
    })
      .sort({ startsAt: 1 })
      .lean(),
  ]);

  const [live, upcoming] = await Promise.all([
    hydrateSales(liveRaw, 'live'),
    hydrateSales(upcomingRaw, 'upcoming'),
  ]);

  const result = {
    liveCount: live.length,
    upcomingCount: upcoming.length,
    count: live.length + upcoming.length,
    upcomingWindowHours: UPCOMING_WINDOW_HOURS,
    generatedAt: now,
    sales: live,
    upcomingSales: upcoming,
  };

  await ChatbotCache.setValue(CACHE_KEY, result, config.cache.flashSaleTtlSec);
  return result;
}

module.exports = getFlashSale;
