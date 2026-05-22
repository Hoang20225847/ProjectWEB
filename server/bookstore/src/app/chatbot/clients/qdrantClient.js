const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

/**
 * Qdrant REST client — hỗ trợ nhiều collection (product | promotion | faq).
 */

function client() {
  return axios.create({
    baseURL: config.qdrant.url.replace(/\/$/, ''),
    timeout: config.qdrant.timeoutMs,
    headers: config.qdrant.apiKey ? { 'api-key': config.qdrant.apiKey } : {},
  });
}

/** @typedef {'product'|'promotion'|'faq'} QdrantKind */

function normalizeKind(kind) {
  const k = String(kind || 'product').toLowerCase();
  if (k === 'promotion' || k === 'promotions') return 'promotion';
  if (k === 'faq' || k === 'faqs') return 'faq';
  return 'product';
}

function collectionName(kind) {
  const k = normalizeKind(kind);
  const c = config.qdrant.collections || {};
  if (k === 'promotion') return c.promotion || 'bookstore_promotions';
  if (k === 'faq') return c.faq || 'bookstore_faq';
  return c.product || 'bookstore_books';
}

/** Đảm bảo index payload theo đúng từng collection (mỗi tên chỉ khởi tạo 1 lần). */
const _payloadIndexedCollections = new Set();
const _ensuredCollections = new Set();

const PAYLOAD_INDEXES_BY_KIND = {
  product: [
    { field_name: 'domain', field_schema: 'keyword' },
    { field_name: 'status', field_schema: 'keyword' },
    { field_name: 'genres', field_schema: 'keyword' },
    { field_name: 'themes', field_schema: 'keyword' },
    { field_name: 'mood', field_schema: 'keyword' },
    { field_name: 'contentTags', field_schema: 'keyword' },
    { field_name: 'audience', field_schema: 'keyword' },
    { field_name: 'language', field_schema: 'keyword' },
    { field_name: 'bookId', field_schema: 'keyword' },
    { field_name: 'categoryId', field_schema: 'keyword' },
    { field_name: 'country', field_schema: 'keyword' },
    { field_name: 'isMemberOnly', field_schema: 'bool' },
  ],
  promotion: [
    { field_name: 'domain', field_schema: 'keyword' },
    { field_name: 'promotionId', field_schema: 'keyword' },
    { field_name: 'active', field_schema: 'bool' },
    { field_name: 'bookIds', field_schema: 'keyword' },
    { field_name: 'startsAtMs', field_schema: 'integer' },
    { field_name: 'endsAtMs', field_schema: 'integer' },
  ],
  faq: [
    { field_name: 'domain', field_schema: 'keyword' },
    { field_name: 'faqId', field_schema: 'keyword' },
    { field_name: 'category', field_schema: 'keyword' },
  ],
};

async function ensurePayloadIndexes(kind) {
  const k = normalizeKind(kind);
  const name = collectionName(kind);
  if (!config.qdrant.enabled || _payloadIndexedCollections.has(name)) return true;
  const indexes = PAYLOAD_INDEXES_BY_KIND[k] || PAYLOAD_INDEXES_BY_KIND.product;
  try {
    const c = client();
    const coll = encodeURIComponent(name);
    for (const idx of indexes) {
      try {
        await c.put(`/collections/${coll}/index?wait=true`, idx);
      } catch (err) {
        const msg =
          err?.response?.data?.status?.error || err?.response?.data || err?.message || '';
        if (/already exists/i.test(String(msg))) continue;
        console.warn(
          '[chatbot.qdrant] payload index',
          name,
          idx.field_name,
          'skipped:',
          typeof msg === 'string' ? msg : JSON.stringify(msg),
        );
      }
    }
    _payloadIndexedCollections.add(name);
    return true;
  } catch (err) {
    console.error('[chatbot.qdrant] ensurePayloadIndexes failed:', err?.message || err);
    return false;
  }
}

/**
 * @param {QdrantKind} [kind]
 */
async function ensureCollection(kind = 'product') {
  if (!config.qdrant.enabled) return false;
  const name = collectionName(kind);
  if (_ensuredCollections.has(name)) {
    await ensurePayloadIndexes(kind);
    return true;
  }
  try {
    const c = client();
    const url = `/collections/${encodeURIComponent(name)}`;
    const head = await c.get(url).catch(() => ({ status: 404 }));
    if (head?.status === 200 || head?.data?.result) {
      _ensuredCollections.add(name);
      await ensurePayloadIndexes(kind);
      return true;
    }
    await c.put(url, {
      vectors: { size: config.embedding.dim, distance: 'Cosine' },
    });
    _ensuredCollections.add(name);
    await ensurePayloadIndexes(kind);
    return true;
  } catch (err) {
    console.error('[chatbot.qdrant] ensureCollection failed:', name, err?.message || err);
    return false;
  }
}

async function upsertPoint(kind, { id, vector, payload }) {
  if (!config.qdrant.enabled) return false;
  const ok = await ensureCollection(kind);
  if (!ok) return false;
  try {
    const c = client();
    const name = encodeURIComponent(collectionName(kind));
    await c.put(`/collections/${name}/points?wait=true`, {
      points: [{ id, vector, payload }],
    });
    return true;
  } catch (err) {
    console.error('[chatbot.qdrant] upsert failed:', collectionName(kind), err?.response?.data || err?.message || err);
    return false;
  }
}

async function deletePoint(kind, id) {
  if (!config.qdrant.enabled) return false;
  try {
    const c = client();
    const name = encodeURIComponent(collectionName(kind));
    await c.post(`/collections/${name}/points/delete?wait=true`, { points: [id] });
    return true;
  } catch (err) {
    console.error('[chatbot.qdrant] delete failed:', collectionName(kind), err?.message || err);
    return false;
  }
}

/**
 * @param {object} opts
 * @param {number[]} opts.vector
 * @param {QdrantKind} [opts.kind]
 */
async function search({
  vector,
  limit = 5,
  filter = null,
  minScore = 0,
  kind = 'product',
} = {}) {
  if (!config.qdrant.enabled) return [];
  const ok = await ensureCollection(kind);
  if (!ok) return [];
  try {
    const c = client();
    const name = encodeURIComponent(collectionName(kind));
    const body = {
      vector,
      limit: Math.max(1, Math.min(20, Number(limit) || 5)),
      with_payload: true,
      with_vector: false,
    };
    if (filter) body.filter = filter;
    if (minScore > 0) body.score_threshold = minScore;
    const { data } = await c.post(`/collections/${name}/points/search`, body);
    return Array.isArray(data?.result) ? data.result : [];
  } catch (err) {
    console.error('[chatbot.qdrant] search failed:', collectionName(kind), err?.response?.data || err?.message || err);
    return [];
  }
}

/** ObjectId → UUID Qdrant */
function objectIdToPointId(objectIdHex) {
  const hex = String(objectIdHex || '').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** ID FAQ ổn định (slug) → point id deterministic */
function faqSlugToPointId(slug) {
  const h = crypto.createHash('sha256').update(`faq:${String(slug || '')}`, 'utf8').digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

module.exports = {
  normalizeKind,
  collectionName,
  ensureCollection,
  ensurePayloadIndexes,
  upsertPoint,
  deletePoint,
  search,
  objectIdToPointId,
  faqSlugToPointId,
};
