const FlashSale = require('../../models/FlashSale');
const Book = require('../../models/Books');
const ChatbotCache = require('../models/ChatbotCache');
const config = require('../config');
const { listPriceVndFromBookPrice } = require('../../utils/moneyVnd');

const CACHE_KEY = 'flash_sale:live';

/**
 * Trả về các chương trình flash sale đang chạy + danh sách sách kèm giá sale.
 * Có cache MongoDB TTL 60s để không quá tải DB khi nhiều user hỏi.
 */
async function getFlashSale() {
  const cached = await ChatbotCache.getValue(CACHE_KEY);
  if (cached) return cached;

  const now = new Date();
  const sales = await FlashSale.find({
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).lean();

  if (!sales.length) {
    const empty = { count: 0, sales: [], generatedAt: now };
    await ChatbotCache.setValue(CACHE_KEY, empty, config.cache.flashSaleTtlSec);
    return empty;
  }

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

  const result = {
    count: sales.length,
    generatedAt: now,
    sales: sales.map((s) => ({
      _id: String(s._id),
      title: s.title,
      description: s.description || '',
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      items: (s.items || [])
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
        .filter(Boolean),
    })),
  };

  await ChatbotCache.setValue(CACHE_KEY, result, config.cache.flashSaleTtlSec);
  return result;
}

module.exports = getFlashSale;
