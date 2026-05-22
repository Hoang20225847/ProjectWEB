/**
 * Ước lượng token khi provider không trả usage (chars/4, tối thiểu 1).
 */
function estimateTokens(text) {
  const s = String(text || '');
  if (!s.length) return 0;
  return Math.max(1, Math.ceil(s.length / 4));
}

function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((sum, m) => sum + estimateTokens(m?.content), 0);
}

/** Chỉ tính token của lượt hiện tại (không cộng lại toàn bộ context LLM). */
function estimateTurnTokens({ userContent, assistantText, standalone, toolPayload }) {
  return (
    estimateTokens(userContent) +
    estimateTokens(assistantText) +
    estimateTokens(standalone) +
    estimateTokens(toolPayload)
  );
}

module.exports = {
  estimateTokens,
  estimateMessagesTokens,
  estimateTurnTokens,
};
