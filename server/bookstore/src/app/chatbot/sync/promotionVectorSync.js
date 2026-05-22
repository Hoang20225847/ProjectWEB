const FlashSale = require('../../models/FlashSale');
const { embedText } = require('./embedder');
const qdrant = require('../clients/qdrantClient');

/**
 * Embedding riêng cho flash sale — không merge với product vector.
 */

function promotionToEmbedText(sale) {
  const lines = [`Chương trình khuyến mãi: ${sale.title || ''}`];
  if (sale.description) lines.push(`Mô tả chương trình: ${sale.description}`);
  const titles = [];
  for (const it of sale.items || []) {
    const b = it.bookId;
    if (b && typeof b === 'object' && b.name) titles.push(String(b.name));
  }
  if (titles.length) lines.push(`Các đầu sách trong chương trình (chỉ tên): ${titles.join('; ')}`);
  return lines.join('\n');
}

function promotionPayload(sale) {
  const bookIds = [];
  for (const it of sale.items || []) {
    const bid = it.bookId;
    if (bid && typeof bid === 'object' && bid._id) bookIds.push(String(bid._id));
    else if (bid) bookIds.push(String(bid));
  }
  return {
    domain: 'promotion',
    promotionId: String(sale._id),
    active: !!sale.active,
    title: (sale.title || '').slice(0, 220),
    description: (sale.description || '').slice(0, 500),
    bookIds,
    startsAtMs: new Date(sale.startsAt).getTime(),
    endsAtMs: new Date(sale.endsAt).getTime(),
  };
}

/** Chương trình đã kết thúc hoặc tắt → không đưa lên semantic index promo. */
function shouldIndexPromotion(sale, now = Date.now()) {
  if (!sale?.active) return false;
  return new Date(sale.endsAt).getTime() > now;
}

function promotionTemporalOk(payload, now = Date.now()) {
  const t = Number(now);
  if (!payload?.active) return false;
  const starts = Number(payload.startsAtMs);
  const ends = Number(payload.endsAtMs);
  if (Number.isFinite(starts) && t < starts) return false;
  if (Number.isFinite(ends) && t > ends) return false;
  return true;
}

async function syncFlashSaleById(saleOrId) {
  const sid = typeof saleOrId === 'object' && saleOrId?._id ? saleOrId._id : saleOrId;
  if (!sid) return { ok: false, reason: 'no_id' };
  const pointId = qdrant.objectIdToPointId(sid);

  const sale = await FlashSale.findById(sid).populate('items.bookId', 'name').lean();
  if (!sale) {
    await qdrant.deletePoint('promotion', pointId);
    return { ok: true, action: 'deleted_missing' };
  }

  if (!shouldIndexPromotion(sale)) {
    await qdrant.deletePoint('promotion', pointId);
    return { ok: true, action: 'deleted_inactive_or_ended' };
  }

  const text = promotionToEmbedText(sale).trim();
  if (!text) {
    await qdrant.deletePoint('promotion', pointId);
    return { ok: true, action: 'deleted_empty' };
  }

  const vec = await embedText(text);
  if (!Array.isArray(vec) || vec.length === 0) return { ok: false, reason: 'embed_failed' };

  const ok = await qdrant.upsertPoint('promotion', {
    id: pointId,
    vector: vec,
    payload: promotionPayload(sale),
  });
  return { ok, action: ok ? 'upserted_promotion' : 'failed' };
}

module.exports = {
  syncFlashSaleById,
  promotionTemporalOk,
  shouldIndexPromotion,
  promotionPayload,
};
