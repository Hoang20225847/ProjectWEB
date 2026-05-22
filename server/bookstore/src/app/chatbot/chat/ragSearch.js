const Book = require('../../models/Books');
const { embedText } = require('../sync/embedder');
const qdrant = require('../clients/qdrantClient');
const config = require('../config');
const searchBooks = require('../tools/searchBooks');
const { promotionTemporalOk } = require('../sync/promotionVectorSync');

/**
 * Phân nhánh retrieval theo kiểu câu hỏi (intent légers — trước LLM/router tool).
 */
function classifyDomains(query) {
  const lower = String(query || '').toLowerCase();
  const bookKw =
    /\b(?:sách|đọc|truyện|tựa|novel|thiếu\s*nhi|truyện\s*tranh|tác\s*giả|cảm\s*động|buồn|chữa\s*lành|gợi\s*ý(?:\s*sách|\s*đọc))\b/i.test(
      lower,
    );

  const faqKw =
    /\b(?:giao\s*hàng|vận\s*chuyển|\bship\b|đổi\s*trả|hoàn\s*tiền|thanh\s*toán|\bcod\b|vnpay|momo|chính\s*sách|cách\s*(?:đặt|mua\s*hàng)|faq|liên\s*hệ|cửa\s*hàng\b|bao\s+lâu\s+(?:để\s+)?(?:nhận|giao))\b/i.test(
      lower,
    );

  const promoKw =
    /\bflash\s*-?\s*sale|flashsale|khuyến\s*mại|khuyến\s*mãi|\bdeal\b|\bpromo\b|\bsale\b|ưu\s*đãi|giảm\s+giá|giảm\s+sốc|giờ\s+vàng\b|đợt\s+giảm|chương\s*trình\s+(?:khuyến\s*mại|khuyến\s*mãi|giảm)|time\s+sale\b/i.test(
      lower,
    );

  let needsFaq = faqKw;
  let needsPromotion = promoKw;

  /** Mặc định có sách trong kết quả; tắt khi chỉ FAQ hoặc chỉ KM (semantic riêng). */
  let needsProduct = true;
  if (faqKw && !bookKw && !promoKw) needsProduct = false;
  if (promoKw && !bookKw) needsProduct = false;
  if ((promoKw || faqKw) && bookKw) needsProduct = true;

  return { needsFaq, needsPromotion, needsProduct };
}

/** Boost nhẹ sau vector search — slot cho rerank cross-encoder sau này. */
function rerankProductHits(hits, queryNorm) {
  const terms = String(queryNorm || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (!terms.length) return hits;
  function bonus(pl) {
    let b = 0;
    const bags = [
      ...(pl.genres || []),
      ...(pl.themes || []),
      ...(pl.mood || []),
      ...(pl.contentTags || []),
      ...(pl.audience || []),
    ];
    for (const lab of bags) {
      const s = String(lab).toLowerCase();
      for (const t of terms) {
        if (!t) continue;
        if (s.includes(t)) b += 0.025;
        else if (t.length >= 4 && (s.includes(t.slice(0, -1)) || t.includes(s))) b += 0.015;
      }
    }
    const nm = String(pl.name || '').toLowerCase();
    if (terms.some((t) => nm.includes(t))) b += 0.04;
    return b;
  }
  return [...hits].sort(
    (a, b) => b.score + bonus(b.payload || {}) - (a.score + bonus(a.payload || {})),
  );
}

/**
 * Pipeline: embed query → (tuỳ domain) search product / promotion / faq → metadata + rerank nhẹ → hydrate Mongo.
 */
async function ragSearch(query) {
  const q = String(query || '').trim();
  const empty = { items: [], ragFaq: [], ragPromotions: [], sources: {}, source: 'empty' };
  if (!q) return empty;

  const { needsFaq, needsPromotion, needsProduct } = classifyDomains(q);
  const sources = { product: 'skipped', faq: 'skipped', promotion: 'skipped' };

  if (!config.qdrant.enabled) {
    if (!needsProduct) return { ...empty, sources, source: 'qdrant_off' };
    const r = await searchBooks({ keyword: q, limit: config.rag.topK });
    sources.product = 'keyword';
    return { items: r.items, ragFaq: [], ragPromotions: [], sources, source: 'keyword' };
  }

  const vec = await embedText(q);
  const isBadVec = !vec || vec.every((v) => v === 0);
  if (isBadVec && needsProduct) {
    const r = await searchBooks({ keyword: q, limit: config.rag.topK });
    sources.product = 'keyword';
    return { items: r.items, ragFaq: [], ragPromotions: [], sources, source: 'keyword' };
  }

  const topK = config.rag.topK;
  let productHits = [];
  if (needsProduct && !isBadVec) {
    const filter = { must: [{ key: 'status', match: { value: 'published' } }] };
    productHits = await qdrant.search({
      kind: 'product',
      vector: vec,
      limit: Math.max(topK, 16),
      filter,
      minScore: config.rag.minScore,
    });
    sources.product = productHits.length ? 'vector' : 'vector_miss';
    productHits = rerankProductHits(productHits, q).slice(0, topK);
  } else sources.product = 'skipped_domain';

  let promoHitsFiltered = [];
  if (needsPromotion && !isBadVec) {
    const ph = await qdrant.search({
      kind: 'promotion',
      vector: vec,
      limit: 8,
      filter: null,
      minScore: Math.max(0.05, config.rag.minScore * 0.55),
    });
    promoHitsFiltered = ph.filter((h) => promotionTemporalOk(h.payload));
    if (promoHitsFiltered.length) sources.promotion = 'vector';
    else if (ph.length) sources.promotion = 'stale_window';
    else sources.promotion = 'none';
  }

  let faqHits = [];
  if (needsFaq && !isBadVec) {
    faqHits = await qdrant.search({
      kind: 'faq',
      vector: vec,
      limit: 4,
      minScore: 0.07,
    });
    sources.faq = faqHits.length ? 'vector' : 'none';
  }

  /** Hydrate books từ Mongo (đồng bộ giá/stock realtime). */
  let items = [];
  let combinedSource = 'skipped';
  if (needsProduct && !productHits.length) {
    const r = await searchBooks({ keyword: q, limit: topK });
    items = r.items;
    combinedSource = isBadVec ? 'keyword' : 'keyword_fallback';
    sources.product = combinedSource.startsWith('keyword') ? combinedSource : sources.product;
  } else if (needsProduct && productHits.length) {
    const ids = productHits.map((h) => h?.payload?.bookId).filter(Boolean);
    const filterStock = {
      status: 'published',
      _id: { $in: ids },
      $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }],
    };
    const books = ids.length
      ? await Book.find(filterStock, searchBooks.PUBLIC_PROJECTION)
          .populate({ path: 'category', select: 'name slug' })
          .lean()
      : [];
    const map = new Map(books.map((b) => [String(b._id), b]));
    items = productHits
      .map((h) => {
        const b = map.get(String(h?.payload?.bookId));
        if (!b) return null;
        return { ...b, _score: h.score };
      })
      .filter(Boolean);
    combinedSource = 'vector';

    if (!items.length && !isBadVec) {
      const r = await searchBooks({ keyword: q, limit: topK });
      items = r.items;
      combinedSource = 'keyword_fallback';
    }
  }

  const ragFaq = faqHits.map((h) => ({ score: h.score, ...(h.payload || {}) }));
  const ragPromotions = promoHitsFiltered.map((h) => ({ score: h.score, ...(h.payload || {}) }));

  return {
    items,
    ragFaq,
    ragPromotions,
    sources,
    source: combinedSource,
  };
}

module.exports = { ragSearch, classifyDomains };
