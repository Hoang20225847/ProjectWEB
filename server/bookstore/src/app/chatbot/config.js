/**
 * Cấu hình tập trung cho module chatbot.
 * Provider, model, API key và embedding dim BẮT BUỘC khai báo trong .env — không fallback OpenAI.
 */

const env = process.env;

const SUPPORTED_LLM_PROVIDERS = new Set(['gemini', 'anthropic', 'deepseek', 'openai']);
const SUPPORTED_EMBED_PROVIDERS = new Set(['gemini', 'openai']);

function trimEnv(name) {
  const v = env[name];
  if (v == null) return '';
  return String(v).trim();
}

function providerBaseUrl(provider) {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    default:
      return '';
  }
}

function buildLlmConfig() {
  const provider = trimEnv('CHATBOT_LLM_PROVIDER').toLowerCase();
  const model = trimEnv('CHATBOT_LLM_MODEL');
  const apiKey = trimEnv('CHATBOT_LLM_API_KEY');
  const baseUrl = trimEnv('CHATBOT_LLM_BASE_URL') || providerBaseUrl(provider);
  const fastModel = trimEnv('CHATBOT_LLM_FAST_MODEL') || model;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    fastModel,
    temperature: Number(env.CHATBOT_LLM_TEMPERATURE || 0.4),
    maxTokens: Number(env.CHATBOT_LLM_MAX_TOKENS || 800),
    timeoutMs: Number(env.CHATBOT_LLM_TIMEOUT_MS || 30000),
    geminiMinIntervalMs: Number(env.CHATBOT_GEMINI_MIN_INTERVAL_MS || 9000),
    max429Retries: Number(env.CHATBOT_LLM_429_MAX_RETRIES || 6),
  };
}

function buildEmbedConfig() {
  const provider = trimEnv('CHATBOT_EMBED_PROVIDER').toLowerCase();
  const model = trimEnv('CHATBOT_EMBED_MODEL');
  const apiKey = trimEnv('CHATBOT_EMBED_API_KEY');
  const baseUrl = trimEnv('CHATBOT_EMBED_BASE_URL') || providerBaseUrl(provider);
  const dimRaw = trimEnv('CHATBOT_EMBED_DIM');
  const dim = dimRaw ? Number(dimRaw) : NaN;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    dim,
    timeoutMs: Number(env.CHATBOT_EMBED_TIMEOUT_MS || 20000),
  };
}

const config = {
  enabled: env.CHATBOT_ENABLED !== 'false',

  llm: buildLlmConfig(),

  embedding: buildEmbedConfig(),

  qdrant: {
    enabled: env.QDRANT_ENABLED !== 'false',
    url: env.QDRANT_URL || 'http://localhost:6333',
    apiKey: env.QDRANT_API_KEY || '',
    collections: {
      product: env.QDRANT_COLLECTION_PRODUCT || env.QDRANT_COLLECTION || 'bookstore_books',
      promotion: env.QDRANT_COLLECTION_PROMOTION || 'bookstore_promotions',
      faq: env.QDRANT_COLLECTION_FAQ || 'bookstore_faq',
    },
    timeoutMs: Number(env.QDRANT_TIMEOUT_MS || 10000),
  },

  session: {
    idleMinutes: Number(env.CHATBOT_SESSION_IDLE_MINUTES || 5),
    sweepIntervalSec: Number(env.CHATBOT_SESSION_SWEEP_SEC || 30),
    tokenThreshold: Number(env.CHATBOT_SESSION_TOKEN_THRESHOLD || 1500),
    feedbackSkipSec: Number(env.CHATBOT_FEEDBACK_SKIP_SEC || 30),
    contextWindow: Number(env.CHATBOT_CONTEXT_WINDOW || 6),
    historyPageSize: Number(env.CHATBOT_HISTORY_PAGE_SIZE || 20),
  },

  rag: {
    topK: Number(env.CHATBOT_RAG_TOP_K || 8),
    minScore: Number(env.CHATBOT_RAG_MIN_SCORE || 0.15),
  },

  cache: {
    flashUpcomingWindowHours: Number(env.CHATBOT_FLASH_UPCOMING_HOURS || 168),
    flashSaleTtlSec: Number(env.CHATBOT_CACHE_FLASH_TTL || 60),
    voucherTtlSec: Number(env.CHATBOT_CACHE_VOUCHER_TTL || 30),
    memberBenefitTtlSec: Number(env.CHATBOT_CACHE_MEMBER_TTL || 300),
  },
};

/**
 * Kiểm tra cấu hình chatbot khi CHATBOT_ENABLED=true.
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateChatbotConfig(cfg = config) {
  const errors = [];
  if (!cfg.enabled) return { ok: true, errors };

  const llm = cfg.llm || {};
  const embedding = cfg.embedding || {};

  if (!llm.provider) errors.push('Thiếu CHATBOT_LLM_PROVIDER (gemini | deepseek | openai | anthropic).');
  else if (!SUPPORTED_LLM_PROVIDERS.has(llm.provider)) {
    errors.push(`CHATBOT_LLM_PROVIDER không hỗ trợ: "${llm.provider}".`);
  }
  if (!llm.model) errors.push('Thiếu CHATBOT_LLM_MODEL.');
  if (!llm.apiKey) errors.push('Thiếu CHATBOT_LLM_API_KEY.');
  if (!llm.baseUrl) errors.push('Thiếu CHATBOT_LLM_BASE_URL (hoặc provider không hợp lệ).');

  if (!embedding.provider) {
    errors.push('Thiếu CHATBOT_EMBED_PROVIDER (gemini | openai).');
  } else if (!SUPPORTED_EMBED_PROVIDERS.has(embedding.provider)) {
    errors.push(`CHATBOT_EMBED_PROVIDER không hỗ trợ: "${embedding.provider}".`);
  }
  if (!embedding.model) errors.push('Thiếu CHATBOT_EMBED_MODEL.');
  if (!embedding.apiKey) errors.push('Thiếu CHATBOT_EMBED_API_KEY.');
  if (!embedding.baseUrl) errors.push('Thiếu CHATBOT_EMBED_BASE_URL (hoặc provider không hợp lệ).');
  if (!Number.isFinite(embedding.dim) || embedding.dim <= 0) {
    errors.push('Thiếu hoặc sai CHATBOT_EMBED_DIM (số nguyên dương, ví dụ 768).');
  }

  return { ok: errors.length === 0, errors };
}

module.exports = config;
module.exports.validateChatbotConfig = validateChatbotConfig;
module.exports.SUPPORTED_LLM_PROVIDERS = SUPPORTED_LLM_PROVIDERS;
module.exports.SUPPORTED_EMBED_PROVIDERS = SUPPORTED_EMBED_PROVIDERS;
