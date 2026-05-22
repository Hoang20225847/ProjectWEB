const llm = require('../clients/llmClient');
const config = require('../config');
const ChatSession = require('../models/ChatSession');

/**
 * Sau tin nhắn đầu tiên, gọi LLM nhỏ để đặt tên ngắn cho phiên (≤ 8 từ).
 * Fire-and-forget — không block response. Lỗi cũng không sao.
 */
async function nameSessionAsync(sessionId, firstUserMessage) {
  try {
    if (!sessionId || !firstUserMessage) return;
    if (!llm.hasKey()) return;
    const messages = [
      {
        role: 'system',
        content:
          'Tóm tắt câu hỏi đầu tiên của người dùng thành tiêu đề tiếng Việt ngắn (tối đa 8 từ, không dấu chấm cuối câu, không quotes). Chỉ in tiêu đề.',
      },
      { role: 'user', content: String(firstUserMessage).slice(0, 400) },
    ];
    const res = await llm.complete({
      messages,
      model: config.llm.fastModel,
      temperature: 0.3,
      maxTokens: 40,
    });
    const title = (res.content || '').replace(/^["']|["']$/g, '').replace(/[.\s]+$/, '').trim();
    if (title) {
      await ChatSession.updateOne({ sessionId }, { $set: { title: title.slice(0, 120) } });
    }
  } catch (err) {
    console.error('[chatbot.sessionNamer] error:', err?.message || err);
  }
}

module.exports = { nameSessionAsync };
