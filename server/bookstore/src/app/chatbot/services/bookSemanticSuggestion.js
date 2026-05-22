const llm = require('../clients/llmClient');
const config = require('../config');

const JSON_SCHEMA_EXAMPLE =
  '{"themes":["chữa lành","tuổi thơ"],"mood":["buồn","nhẹ nhàng"],"contentTags":[],"audience":["teen"],"rationale":""}';

function normalizeSemanticList(arr, max = 24) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const s = String(x || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 64);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function hasMeaningfulSemantics(parsed) {
  if (!parsed) return false;
  return (
    parsed.themes.length > 0 ||
    parsed.mood.length > 0 ||
    parsed.contentTags.length > 0 ||
    parsed.audience.length > 0
  );
}

function rawToParsed(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    themes: normalizeSemanticList(raw.themes, 16),
    mood: normalizeSemanticList(raw.mood, 12),
    contentTags: normalizeSemanticList(raw.contentTags, 20),
    audience: normalizeSemanticList(raw.audience, 8),
    rationale: String(raw.rationale || '').slice(0, 500),
  };
}

/** Trích JSON từ text / markdown fence / function args. */
function parseJsonFromText(text) {
  if (text == null) return null;
  if (typeof text === 'object') return rawToParsed(text);
  let s = String(text).trim();
  if (!s) return null;

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const attempts = [s];
  const brace = s.match(/\{[\s\S]*\}/);
  if (brace) attempts.push(brace[0]);

  for (const chunk of attempts) {
    try {
      const raw = JSON.parse(chunk);
      const parsed = rawToParsed(raw);
      if (parsed) return parsed;
    } catch {
      /* next */
    }
  }
  return null;
}

function parseToolPayload(res) {
  const calls = Array.isArray(res?.toolCalls) ? res.toolCalls : [];
  for (const c of calls) {
    if (c?.function?.name !== 'submit_book_semantics') continue;
    let args = c.function?.arguments;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        continue;
      }
    }
    if (args && typeof args === 'object') {
      const parsed = rawToParsed(args);
      if (parsed) return parsed;
    }
  }
  return null;
}

function buildBookContextBlock({
  bookName,
  author,
  genres,
  categoryName,
  description,
  reviewText,
}) {
  const genresLine = Array.isArray(genres) && genres.length ? genres.join(', ') : '(chưa có)';
  return [
    `Tựa sách: ${bookName || '(không có)'}`,
    `Tác giả: ${author || '(không có)'}`,
    `Danh mục cửa hàng: ${categoryName || '(không rõ)'}`,
    `Thể loại (genres): ${genresLine}`,
    '',
    'Mô tả sách:',
    String(description || '').trim() || '(trống)',
    '',
    'Nhận xét độc giả (gộp):',
    String(reviewText || '').trim() || '(chưa có)',
  ].join('\n');
}

function buildJsonMessages(block) {
  return [
    {
      role: 'system',
      content: [
        'Bạn trích xuất metadata semantic cho sách bán lẻ Việt Nam.',
        'Trả VỀ DUY NHẤT một JSON object hợp lệ (không markdown, không lời dẫn).',
        `Ví dụ schema: ${JSON_SCHEMA_EXAMPLE}`,
        'Quy tắc:',
        '- themes: 3–6 chủ đề/motif (tiếng Việt ngắn, mỗi nhãn ≤ 4 từ), lấy từ mô tả/review.',
        '- mood: 2–5 tông cảm xúc khi đọc.',
        '- contentTags: 0–4 nhãn phụ, không trùng themes.',
        '- audience: mã như teen, adult, middle_grade, young_adult, children nếu suy ra được.',
        '- rationale: một câu tiếng Việt (optional).',
        '- Không bịa chi tiết không có trong văn bản.',
        '- Nếu mô tả đủ nội dung: mỗi mảng themes và mood phải có ít nhất 1 phần tử.',
      ].join('\n'),
    },
    { role: 'user', content: block },
  ];
}

function semanticLlmOptions(overrides = {}) {
  const cooldown = Number(
    process.env.CHATBOT_SEMANTIC_GEMINI_COOLDOWN_MS ?? config.llm.geminiMinIntervalMs ?? 9000,
  );
  return {
    temperature: Number(process.env.CHATBOT_SEMANTIC_TEMPERATURE || 0.2),
    maxTokens: Number(process.env.CHATBOT_SEMANTIC_MAX_TOKENS || 2048),
    model: process.env.CHATBOT_SEMANTIC_MODEL || config.llm.fastModel || config.llm.model,
    jsonMode: true,
    geminiCooldownMs: cooldown,
    ...overrides,
  };
}

function looksTruncatedJson(text) {
  const s = String(text || '').trim();
  if (!s.startsWith('{')) return false;
  if (s.endsWith('}')) return false;
  return s.includes('"themes"') || s.includes('"mood"');
}

async function suggestSemanticLabels({
  bookName,
  author,
  genres = [],
  categoryName,
  description = '',
  reviewText = '',
} = {}) {
  if (!llm.hasKey()) {
    return {
      ok: false,
      error: 'Thiếu CHATBOT_LLM_API_KEY / GOOGLE_API_KEY.',
      code: 'no_key',
    };
  }

  const block = buildBookContextBlock({
    bookName,
    author,
    genres,
    categoryName,
    description,
    reviewText,
  });

  const messages = buildJsonMessages(block);
  let llmOpts = semanticLlmOptions();

  async function runOnce(opts) {
    const res = await llm.complete({ messages, ...opts });
    if (res?.finishReason === 'no_key') {
      return { res, fail: { ok: false, error: 'Thiếu API key LLM.', code: 'no_key' } };
    }
    if (res?.finishReason === 'error') {
      return {
        res,
        fail: { ok: false, error: res.error || 'llm_error', code: 'api_error' },
      };
    }
    let parsed = parseJsonFromText(res?.content);
    if (!parsed) parsed = parseToolPayload(res);
    return { res, parsed };
  }

  let { res, parsed, fail } = await runOnce(llmOpts);
  if (fail) return fail;

  const truncated =
    res?.finishReason === 'MAX_TOKENS' ||
    looksTruncatedJson(res?.content);

  if (!hasMeaningfulSemantics(parsed) && truncated) {
    const retryOpts = semanticLlmOptions({
      maxTokens: Math.max(llmOpts.maxTokens, 3072),
    });
    ({ res, parsed, fail } = await runOnce(retryOpts));
    if (fail) return fail;
  }

  if (!hasMeaningfulSemantics(parsed)) {
    return {
      ok: false,
      error: 'LLM không trả JSON semantics đủ nội dung (themes/mood/tags/audience).',
      code: 'parse_empty',
      rawHint: String(res?.content || '').slice(0, 500),
      finishReason: res?.finishReason,
      toolCalls: (res?.toolCalls || []).length,
    };
  }

  return { ok: true, ...parsed };
}

module.exports = {
  suggestSemanticLabels,
  normalizeSemanticList,
  hasMeaningfulSemantics,
  parseJsonFromText,
};
