const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const config = require('../config');

/**
 * Logic vòng đời phiên chatbot:
 *  - touchSession: cập nhật lastActivityAt mỗi khi user/assistant gửi tin
 *  - autoEndIfIdle: kiểm tra lazy 1 phiên — nếu idle quá ngưỡng thì đóng
 *  - startIdleSweeper: scanner chạy nền mỗi N giây, đóng hàng loạt phiên idle
 *  - markUserClosed / markRated: đóng phiên theo hành động user
 */

const idleMs = () => config.session.idleMinutes * 60 * 1000;
const sweepIntervalMs = () => config.session.sweepIntervalSec * 1000;

async function touchSession(sessionId) {
  if (!sessionId) return;
  await ChatSession.updateOne(
    { sessionId, status: 'active' },
    { $set: { lastActivityAt: new Date() } },
  );
}

/**
 * Đọc 1 phiên + kiểm tra idle. Nếu idle vượt ngưỡng -> đóng phiên với endReason=timeout.
 * Trả về document mới nhất.
 */
async function autoEndIfIdle(sessionId) {
  const s = await ChatSession.findOne({ sessionId });
  if (!s) return null;
  if (s.status !== 'active') return s;
  const idleFor = Date.now() - new Date(s.lastActivityAt || s.createdAt).getTime();
  if (idleFor >= idleMs()) {
    s.status = 'closed';
    s.endReason = 'timeout';
    s.phase = 'awaiting_resolved';
    s.endedAt = new Date();
    await s.save();
  }
  return s;
}

async function sweepIdleSessions() {
  const threshold = new Date(Date.now() - idleMs());
  const res = await ChatSession.updateMany(
    { status: 'active', lastActivityAt: { $lt: threshold } },
    {
      $set: {
        status: 'closed',
        endReason: 'timeout',
        phase: 'awaiting_resolved',
        endedAt: new Date(),
      },
    },
  );
  if (res?.modifiedCount > 0) {
    console.log(`[chatbot.sweeper] auto-closed ${res.modifiedCount} idle session(s).`);
  }
  return res?.modifiedCount || 0;
}

let sweeperTimer = null;

function startIdleSweeper() {
  if (sweeperTimer) return;
  sweepIdleSessions().catch((e) => console.error('[chatbot.sweeper] initial run failed:', e?.message));
  sweeperTimer = setInterval(() => {
    sweepIdleSessions().catch((e) => console.error('[chatbot.sweeper] tick failed:', e?.message));
  }, sweepIntervalMs());
  console.log(
    `[chatbot.sweeper] started — idleMinutes=${config.session.idleMinutes}, sweepSec=${config.session.sweepIntervalSec}`,
  );
}

function stopIdleSweeper() {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}

async function markUserClosed(sessionId) {
  await ChatSession.updateOne(
    { sessionId, status: 'active' },
    {
      $set: {
        status: 'closed',
        endReason: 'user_closed',
        phase: 'awaiting_resolved',
        endedAt: new Date(),
      },
    },
  );
}

async function markRated(sessionId) {
  await ChatSession.updateOne(
    { sessionId },
    { $set: { endReason: 'rated' } },
  );
}

/**
 * Xóa toàn bộ tin nhắn của phiên sau khi kết thúc — chỉ giữ metadata trên ChatSession (rating, issueResolved, token…).
 */
async function purgeSessionMessages(sessionId) {
  if (!sessionId) return 0;
  const res = await ChatMessage.deleteMany({ sessionId });
  return res?.deletedCount || 0;
}

module.exports = {
  touchSession,
  autoEndIfIdle,
  sweepIdleSessions,
  startIdleSweeper,
  stopIdleSweeper,
  markUserClosed,
  markRated,
  purgeSessionMessages,
};
