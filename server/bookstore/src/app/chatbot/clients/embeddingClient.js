const axios = require('axios');
const config = require('../config');

/**
 * Embedding client. Hỗ trợ:
 *  - provider = 'gemini'   -> Google Generative Language API (gemini-embedding-001 / text-embedding-004)
 *  - provider = 'openai'   -> OpenAI-compatible /embeddings (text-embedding-3-small, 1536 chiều)
 *
 * Tự động trả vector zero (sentinel) nếu chưa cấu hình key — để pipeline không crash khi dev.
 * Có LRU cache + TTL trong RAM để giảm số request lên API (tránh 429 free tier).
 */

function hasKey() {
  return Boolean(config.embedding.apiKey);
}

function zeroVec() {
  return new Array(config.embedding.dim).fill(0);
}

// ---------- LRU cache ----------
const CACHE_MAX = Number(process.env.CHATBOT_EMBED_CACHE_MAX || 300);
const CACHE_TTL_MS = Number(process.env.CHATBOT_EMBED_CACHE_TTL_MS || 10 * 60 * 1000);
const _cache = new Map();

function cacheKey(text) {
  return `${config.embedding.provider}|${config.embedding.model}|${config.embedding.dim}|${text}`;
}

function cacheGet(text) {
  const key = cacheKey(text);
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  // bump to most-recent: delete + re-set giữ thứ tự insertion = LRU
  _cache.delete(key);
  _cache.set(key, entry);
  return entry.vec;
}

function cacheSet(text, vec) {
  if (!Array.isArray(vec) || vec.length === 0) return;
  const key = cacheKey(text);
  _cache.set(key, { vec, t: Date.now() });
  while (_cache.size > CACHE_MAX) {
    const oldest = _cache.keys().next().value;
    if (oldest === undefined) break;
    _cache.delete(oldest);
  }
}

async function embedGemini(clean) {
  // Tên model trên Generative Language API thường có prefix "models/".
  const rawModel = String(config.embedding.model || '').trim();
  const modelPath = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;

  const url =
    `${config.embedding.baseUrl.replace(/\/$/, '')}` +
    `/${modelPath}:embedContent` +
    `?key=${encodeURIComponent(config.embedding.apiKey)}`;

  // gemini-embedding-001 cho phép chọn outputDimensionality (768 / 1536 / 3072).
  // Các model legacy (text-embedding-004/005) bỏ qua trường này.
  const body = {
    content: { parts: [{ text: clean }] },
    outputDimensionality: config.embedding.dim,
  };

  const { data } = await axios.post(url, body, {
    headers: { 'content-type': 'application/json' },
    timeout: config.embedding.timeoutMs,
  });
  const vec = data?.embedding?.values;
  return Array.isArray(vec) && vec.length > 0 ? vec : null;
}

async function embedOpenAICompatible(clean) {
  const url = `${config.embedding.baseUrl.replace(/\/$/, '')}/embeddings`;
  const { data } = await axios.post(
    url,
    { model: config.embedding.model, input: clean },
    {
      headers: {
        Authorization: `Bearer ${config.embedding.apiKey}`,
        'content-type': 'application/json',
      },
      timeout: config.embedding.timeoutMs,
    },
  );
  const vec = data?.data?.[0]?.embedding;
  return Array.isArray(vec) && vec.length > 0 ? vec : null;
}

async function embedText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return zeroVec();
  if (!hasKey()) return zeroVec();

  const cached = cacheGet(clean);
  if (cached) return cached;

  try {
    const vec =
      config.embedding.provider === 'gemini'
        ? await embedGemini(clean)
        : await embedOpenAICompatible(clean);
    if (vec) {
      cacheSet(clean, vec);
      return vec;
    }
    return zeroVec();
  } catch (err) {
    const reason =
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'embed_error';
    console.error('[chatbot.embed] failed:', reason);
    return zeroVec();
  }
}

module.exports = { embedText, hasKey };
