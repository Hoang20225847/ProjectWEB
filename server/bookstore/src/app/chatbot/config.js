/**
 * Cấu hình tập trung cho module chatbot.
 * Tất cả giá trị nhạy cảm hoặc dễ thay đổi đều đọc từ env.
 * Mọi tính năng đều có fallback an toàn để app vẫn chạy được khi thiếu key.
 */

const env = process.env;

function defaultBaseUrl(provider) {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    default:
      return 'https://api.openai.com/v1';
  }
}

function defaultLlmModel(provider) {
  if (provider === 'gemini') return 'gemini-2.5-flash';
  if (provider === 'deepseek') return 'deepseek-chat';
  return 'gpt-4o-mini';
}

function defaultEmbedModel(provider) {
  return provider === 'gemini' ? 'text-embedding-004' : 'text-embedding-3-small';
}

function defaultEmbedDim(provider) {
  return provider === 'gemini' ? 768 : 1536;
}

const llmProvider = (env.CHATBOT_LLM_PROVIDER || 'openai').toLowerCase();
const embedProvider = (env.CHATBOT_EMBED_PROVIDER || 'openai').toLowerCase();

const config = {
  enabled: env.CHATBOT_ENABLED !== 'false',

  llm: {
    provider: llmProvider,
    apiKey:
      env.CHATBOT_LLM_API_KEY ||
      (llmProvider === 'deepseek' ? env.DEEPSEEK_API_KEY : '') ||
      env.GOOGLE_API_KEY ||
      env.GEMINI_API_KEY ||
      env.OPENAI_API_KEY ||
      '',
    baseUrl: env.CHATBOT_LLM_BASE_URL || defaultBaseUrl(llmProvider),
    model: env.CHATBOT_LLM_MODEL || defaultLlmModel(llmProvider),
    fastModel: env.CHATBOT_LLM_FAST_MODEL || defaultLlmModel(llmProvider),
    temperature: Number(env.CHATBOT_LLM_TEMPERATURE || 0.4),
    maxTokens: Number(env.CHATBOT_LLM_MAX_TOKENS || 800),
    timeoutMs: Number(env.CHATBOT_LLM_TIMEOUT_MS || 30000),
    /** Chờ (ms) sau khi stream LLM Gemini kết thúc trước request tiếp theo (mutex + free tier RPM). rewriter/tool-router không bị chờ. 0 = tắt. */
    geminiMinIntervalMs: Number(env.CHATBOT_GEMINI_MIN_INTERVAL_MS || 9000),
    /** Số lần thử lại khi HTTP 429 (rate limit). */
    max429Retries: Number(env.CHATBOT_LLM_429_MAX_RETRIES || 6),
  },

  embedding: {
    provider: embedProvider,
    apiKey:
      env.CHATBOT_EMBED_API_KEY ||
      env.GOOGLE_API_KEY ||
      env.GEMINI_API_KEY ||
      env.OPENAI_API_KEY ||
      '',
    baseUrl: env.CHATBOT_EMBED_BASE_URL || defaultBaseUrl(embedProvider),
    model: env.CHATBOT_EMBED_MODEL || defaultEmbedModel(embedProvider),
    dim: Number(env.CHATBOT_EMBED_DIM || defaultEmbedDim(embedProvider)),
    timeoutMs: Number(env.CHATBOT_EMBED_TIMEOUT_MS || 20000),
  },

  qdrant: {
    enabled: env.QDRANT_ENABLED !== 'false',
    url: env.QDRANT_URL || 'http://localhost:6333',
    apiKey: env.QDRANT_API_KEY || '',
    /**
     * Tách collection theo domain semantic.
     * Product: QDRANT_COLLECTION_PRODUCT hoặc QDRANT_COLLECTION (tương thích cũ).
     */
    collections: {
      product: env.QDRANT_COLLECTION_PRODUCT || env.QDRANT_COLLECTION || 'bookstore_books',
      promotion: env.QDRANT_COLLECTION_PROMOTION || 'bookstore_promotions',
      faq: env.QDRANT_COLLECTION_FAQ || 'bookstore_faq',
    },
    timeoutMs: Number(env.QDRANT_TIMEOUT_MS || 10000),
  },

  session: {
    /** Phiên tự kết thúc sau N phút không hoạt động */
    idleMinutes: Number(env.CHATBOT_SESSION_IDLE_MINUTES || 5),
    /** Tần suất quét phiên hết hạn (giây) */
    sweepIntervalSec: Number(env.CHATBOT_SESSION_SWEEP_SEC || 30),
    /** Ngưỡng token ước lượng / phiên → hỏi "Bạn cần hỗ trợ thêm không?" */
    tokenThreshold: Number(env.CHATBOT_SESSION_TOKEN_THRESHOLD || 1500),
    /** Tự bỏ qua màn đánh giá sau N giây (client + server ghi nhận skip) */
    feedbackSkipSec: Number(env.CHATBOT_FEEDBACK_SKIP_SEC || 30),
    /** Số tin nhắn gần nhất đưa vào context */
    contextWindow: Number(env.CHATBOT_CONTEXT_WINDOW || 6),
    /** Số tin nhắn tối đa khi load history cho UI */
    historyPageSize: Number(env.CHATBOT_HISTORY_PAGE_SIZE || 20),
  },

  rag: {
    topK: Number(env.CHATBOT_RAG_TOP_K || 8),
    minScore: Number(env.CHATBOT_RAG_MIN_SCORE || 0.15),
  },

  cache: {
    flashSaleTtlSec: Number(env.CHATBOT_CACHE_FLASH_TTL || 60),
    voucherTtlSec: Number(env.CHATBOT_CACHE_VOUCHER_TTL || 30),
    memberBenefitTtlSec: Number(env.CHATBOT_CACHE_MEMBER_TTL || 300),
  },
};

module.exports = config;
