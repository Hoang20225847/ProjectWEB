const llm = require('../clients/llmClient');
const config = require('../config');

/**
 * Viết lại câu hỏi của user thành câu đầy đủ, không phụ thuộc ngữ cảnh,
 * để dùng cho RAG search. VD: "cái đó giá bao nhiêu?" -> "Sách X giá bao nhiêu?"
 *
 * Bỏ qua khi:
 *  - phiên mới (không có history)
 *  - không có LLM key (graceful fallback)
 */
/** Heuristic: câu có đại từ chỉ định / hỏi tiếp → nhiều khả năng phụ thuộc ngữ cảnh. */
function looksContextual(q) {
  return /(\bcái\b|\bnày\b|\bđó\b|\bnó\b|\bbộ\b|\btác phẩm\b|\bsách trên\b|\bcuốn trên\b|\bvẫn\b|\bcòn\b|\bnữa\b|^thế|^vậy)/i.test(q);
}

async function rewriteQuery({ chatContext, question }) {
  const q = String(question || '').trim();
  if (!q) return '';
  if (!Array.isArray(chatContext) || chatContext.length === 0) return q;
  if (!llm.hasKey()) return q;

  // Tối ưu quota Gemini: chỉ rewrite khi câu ngắn / có pronouns rõ ràng.
  // Đa số câu user tự thân đủ rõ -> bỏ qua, tiết kiệm 1 LLM call/lượt.
  if (q.length >= 30 && !looksContextual(q)) return q;

  const messages = [
    {
      role: 'system',
      content:
        'Bạn là bộ viết lại truy vấn. Dựa vào lịch sử hội thoại, viết lại câu hỏi mới nhất thành 1 câu hoàn chỉnh, độc lập ngữ cảnh, ngắn gọn, tiếng Việt. Không thêm thông tin tự bịa. Chỉ trả về 1 câu duy nhất.',
    },
    ...chatContext.slice(-6),
    { role: 'user', content: `Câu hỏi mới: ${q}\nViết lại:` },
  ];

  const res = await llm.complete({
    messages,
    model: config.llm.fastModel,
    temperature: 0.1,
    maxTokens: 120,
  });
  const out = (res.content || '').replace(/^["']|["']$/g, '').trim();
  return out || q;
}

module.exports = { rewriteQuery };
