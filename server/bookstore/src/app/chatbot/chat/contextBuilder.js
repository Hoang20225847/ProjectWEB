const ChatMessage = require('../models/ChatMessage');
const config = require('../config');

/**
 * Lấy N tin nhắn gần nhất để làm bộ nhớ ngắn hạn cho LLM.
 * Trả về thứ tự cũ -> mới.
 */
async function buildContext(sessionId, windowSize = config.session.contextWindow) {
  if (!sessionId) return [];
  const docs = await ChatMessage.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, windowSize))
    .lean();
  return docs
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

module.exports = { buildContext };
