const config = require('../config');

function idleMs() {
  return config.session.idleMinutes * 60 * 1000;
}

function sessionPayload(s) {
  if (!s) return null;
  const last = new Date(s.lastActivityAt || s.createdAt).getTime();
  const idleFor = Date.now() - last;
  const remainingMs = Math.max(0, idleMs() - idleFor);
  const needsIssueResolved = !s.issueResolved && s.phase === 'awaiting_resolved';

  const needsFeedback =
    !s.feedbackSkipped &&
    !s.rating &&
    s.issueResolved &&
    (s.phase === 'awaiting_feedback' ||
      (s.status === 'closed' &&
        ['timeout', 'declined_continue', 'user_closed'].includes(s.endReason || '')));

  return {
    sessionId: s.sessionId,
    title: s.title,
    status: s.status,
    phase: s.phase || 'active',
    endReason: s.endReason,
    rating: s.rating,
    feedback: s.feedback,
    issueResolved: s.issueResolved || '',
    needsIssueResolved,
    feedbackSkipped: !!s.feedbackSkipped,
    totalTokensUsed: s.totalTokensUsed || 0,
    tokenThreshold: config.session.tokenThreshold,
    idleMinutes: config.session.idleMinutes,
    feedbackSkipSec: config.session.feedbackSkipSec,
    secondsUntilIdle: Math.ceil(remainingMs / 1000),
    needsFeedback,
    lastActivityAt: s.lastActivityAt,
    endedAt: s.endedAt,
  };
}

module.exports = {
  sessionPayload,
  idleMs,
};
