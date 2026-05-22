const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');

/**
 * Thống kê hiệu quả chatbot cho admin.
 * Mọi hàm trả về object JSON-friendly.
 */

function parseRange(req) {
  const to = req?.query?.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  let from = req?.query?.from ? new Date(req.query.from) : null;
  if (!from) {
    from = new Date(to);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

async function overview(req) {
  const { from, to } = parseRange(req);
  const range = { createdAt: { $gte: from, $lte: to } };

  const [totalSessions, sessionsRated, sessionsWithResolved, ratingAgg, sessionsByReason, issueResolvedAgg, tokenAgg, msgAgg] =
    await Promise.all([
    ChatSession.countDocuments(range),
    ChatSession.countDocuments({ ...range, rating: { $ne: null } }),
    ChatSession.countDocuments({ ...range, issueResolved: { $in: ['yes', 'no', 'partial'] } }),
    ChatSession.aggregate([
      { $match: { ...range, rating: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
          dist1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          dist2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          dist3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          dist4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          dist5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        },
      },
    ]),
    ChatSession.aggregate([
      { $match: range },
      { $group: { _id: '$endReason', count: { $sum: 1 } } },
    ]),
    ChatSession.aggregate([
      { $match: { ...range, issueResolved: { $in: ['yes', 'no', 'partial'] } } },
      { $group: { _id: '$issueResolved', count: { $sum: 1 } } },
    ]),
    ChatSession.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          avgTokens: { $avg: '$totalTokensUsed' },
          sumTokens: { $sum: '$totalTokensUsed' },
        },
      },
    ]),
    ChatMessage.aggregate([
      { $match: range },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
  ]);

  const ratingRow = ratingAgg[0] || {};
  const distribution = {
    1: ratingRow.dist1 || 0,
    2: ratingRow.dist2 || 0,
    3: ratingRow.dist3 || 0,
    4: ratingRow.dist4 || 0,
    5: ratingRow.dist5 || 0,
  };

  const reasonMap = sessionsByReason.reduce((acc, r) => {
    acc[r._id || 'open'] = r.count;
    return acc;
  }, {});

  const msgMap = msgAgg.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  const issueMap = issueResolvedAgg.reduce((acc, r) => {
    if (r._id) acc[r._id] = r.count;
    return acc;
  }, {});

  const tokenRow = tokenAgg[0] || {};
  const resolvedTotal = (issueMap.yes || 0) + (issueMap.no || 0) + (issueMap.partial || 0);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    sessions: {
      total: totalSessions,
      rated: sessionsRated,
      ratePct: totalSessions ? Math.round((sessionsRated / totalSessions) * 1000) / 10 : 0,
      byEndReason: {
        timeout: reasonMap.timeout || 0,
        user_closed: reasonMap.user_closed || 0,
        rated: reasonMap.rated || 0,
        declined_continue: reasonMap.declined_continue || 0,
        skipped_feedback: reasonMap.skipped_feedback || 0,
        open: reasonMap['open'] || reasonMap[''] || 0,
      },
    },
    rating: {
      avg: ratingRow.avgRating ? Math.round(ratingRow.avgRating * 100) / 100 : 0,
      count: ratingRow.count || 0,
      distribution,
    },
    issueResolved: {
      answered: sessionsWithResolved,
      yes: issueMap.yes || 0,
      no: issueMap.no || 0,
      partial: issueMap.partial || 0,
      resolvedPct: resolvedTotal
        ? Math.round(((issueMap.yes || 0) / resolvedTotal) * 1000) / 10
        : 0,
    },
    tokens: {
      avgPerSession: tokenRow.avgTokens
        ? Math.round(tokenRow.avgTokens)
        : 0,
      total: tokenRow.sumTokens || 0,
    },
    messages: {
      total: (msgMap.user || 0) + (msgMap.assistant || 0),
      user: msgMap.user || 0,
      assistant: msgMap.assistant || 0,
      avgPerSession: totalSessions
        ? Math.round((((msgMap.user || 0) + (msgMap.assistant || 0)) / totalSessions) * 100) / 100
        : 0,
    },
  };
}

async function dailySeries(req) {
  const { from, to } = parseRange(req);
  const rows = await ChatSession.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        sessions: { $sum: 1 },
        ratedSessions: { $sum: { $cond: [{ $ne: ['$rating', null] }, 1, 0] } },
        sumRating: { $sum: { $ifNull: ['$rating', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    date: r._id,
    sessions: r.sessions,
    ratedSessions: r.ratedSessions,
    avgRating: r.ratedSessions ? Math.round((r.sumRating / r.ratedSessions) * 100) / 100 : 0,
  }));
}

async function topToolsUsed(req) {
  const { from, to } = parseRange(req);
  const rows = await ChatMessage.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, 'toolsUsed.0': { $exists: true } } },
    { $unwind: '$toolsUsed' },
    {
      $group: {
        _id: '$toolsUsed.name',
        calls: { $sum: 1 },
        success: { $sum: { $cond: ['$toolsUsed.ok', 1, 0] } },
      },
    },
    { $sort: { calls: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({
    name: r._id,
    calls: r.calls,
    success: r.success,
    successPct: r.calls ? Math.round((r.success / r.calls) * 1000) / 10 : 0,
  }));
}

async function recentFeedback(req) {
  const { from, to } = parseRange(req);
  const limit = Math.max(1, Math.min(100, Number(req?.query?.limit) || 30));
  const filter = {
    createdAt: { $gte: from, $lte: to },
    $or: [
      { rating: { $ne: null } },
      { issueResolved: { $in: ['yes', 'no', 'partial'] } },
      { feedback: { $ne: '' } },
    ],
  };
  if (req?.query?.issueResolved) {
    filter.issueResolved = String(req.query.issueResolved);
    delete filter.$or;
  }
  if (req?.query?.minRating) {
    filter.rating = { $gte: Number(req.query.minRating) };
  }

  const rows = await ChatSession.find(filter)
    .sort({ ratedAt: -1, updatedAt: -1 })
    .limit(limit)
    .select(
      'sessionId userEmail title rating feedback issueResolved ratedAt endReason totalTokensUsed messageCount status createdAt',
    )
    .lean();
  return rows;
}

module.exports = { overview, dailySeries, topToolsUsed, recentFeedback };
