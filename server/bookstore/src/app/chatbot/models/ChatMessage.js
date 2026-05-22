const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Mỗi lượt user / assistant là một document.
 * - retrievedBookIds: danh sách Book đã RAG ra (để hiển thị card sách)
 * - toolsUsed: tool đã được LLM gọi trong lượt này
 */
const ChatMessageSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, default: '' },
    retrievedBookIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Book' }], default: [] },
    toolsUsed: {
      type: [
        {
          name: String,
          argsSummary: String,
          ok: Boolean,
        },
      ],
      default: [],
    },
    /** ms LLM mất để trả lời (chỉ ghi cho assistant) */
    latencyMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
