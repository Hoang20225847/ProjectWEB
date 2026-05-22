const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Một cuộc trò chuyện chatbot.
 * - sessionId: UUID public (an toàn để gửi ra client)
 * - userId: null nếu khách
 * - status: active -> closed (timeout hoặc người dùng đóng)
 * - lastActivityAt: dùng để auto-end khi quá 5 phút
 * - rating / feedback: người dùng đánh giá sau khi phiên kết thúc
 */
const ChatSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'account', default: null, index: true },
    userEmail: { type: String, default: '' },
    title: { type: String, default: 'Cuộc trò chuyện mới', maxlength: 120 },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    endReason: {
      type: String,
      enum: ['', 'timeout', 'user_closed', 'rated', 'declined_continue', 'skipped_feedback'],
      default: '',
    },
    /**
     * Giai đoạn UX trong phiên:
     * - active: chat bình thường
     * - awaiting_continue: đủ token → chờ Có/Không
     * - awaiting_feedback: đã kết thúc hội thoại → chờ rating/comment
     */
    phase: {
      type: String,
      enum: ['active', 'awaiting_continue', 'awaiting_resolved', 'awaiting_feedback'],
      default: 'active',
      index: true,
    },
    /**
     * Khách xác nhận vấn đề đã được giải quyết chưa (trước/song song đánh giá).
     * yes | no | partial
     */
    issueResolved: {
      type: String,
      enum: ['', 'yes', 'no', 'partial'],
      default: '',
      index: true,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date, default: null },

    messageCount: { type: Number, default: 0 },
    toolCallCount: { type: Number, default: 0 },
    /** Token ước lượng cộng dồn trong phiên (input+output các lượt LLM) */
    totalTokensUsed: { type: Number, default: 0, min: 0 },

    rating: { type: Number, default: null, min: 1, max: 5 },
    feedback: { type: String, default: '', maxlength: 1000 },
    ratedAt: { type: Date, default: null },
    feedbackSkipped: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ChatSessionSchema.index({ status: 1, lastActivityAt: 1 });
ChatSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
