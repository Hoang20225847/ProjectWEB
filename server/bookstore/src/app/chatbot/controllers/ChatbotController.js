const crypto = require('crypto');

const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');

const llm = require('../clients/llmClient');
const { buildContext } = require('../chat/contextBuilder');
const { rewriteQuery } = require('../chat/queryRewriter');
const { ragSearch } = require('../chat/ragSearch');
const { buildMessages } = require('../chat/promptBuilder');
const { nameSessionAsync } = require('../chat/sessionNamer');

const { TOOL_DEFINITIONS, runTool, TOOLS } = require('../tools');
const lifecycle = require('../services/sessionLifecycle');
const { estimateTurnTokens } = require('../services/sessionTokens');
const { sessionPayload } = require('../services/sessionState');
const config = require('../config');

function genSessionId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

function normalizeIssueResolved(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'yes' || s === 'true' || s === 'resolved') return 'yes';
  if (s === 'no' || s === 'false' || s === 'unresolved') return 'no';
  if (s === 'partial' || s === 'part' || s === 'mot_phan') return 'partial';
  return '';
}

/**
 * Routing nhanh: gọi thẳng tool khi nhận diện được ý định (không qua LLM) → ít chờ & ít quota.
 */
function inferToolPlansFast(question, user) {
  const q = String(question || '').trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const plans = [];
  const push = (name, args = {}) => {
    if (plans.length >= 3) return;
    if (plans.some((p) => p.name === name)) return;
    plans.push({ name, args });
  };

  const looksFlash =
    /flash\s*-?\s*sale|flashsale/i.test(lower) ||
    /\b(?:sự\s*kiện|chương\s*trình|đợt\b)[^.!?]{0,60}\b(?:flash|giờ\s*vàng|time\s+sale)\b/i.test(lower) ||
    /\b(?:giờ\s*vàng|đợt\s*giảm\b)[^.!?]{0,40}\b(?:giảm\s*giá|sale|flash)\b/i.test(lower);
  const looksPromotionEvent =
    /\b(?:ưu\s*đãi|khuyến\s*mại|khuyến\s*mãi|đang\s*giảm|giảm\s*sốc|deal)\b[^.!?]{0,40}(?:flash|đợt|chương\s*trình|sự\s*kiện|banner)/i.test(
      lower,
    );
  if (looksFlash || looksPromotionEvent) {
    push('getFlashSale', {});
  }

  if (
    /\b(?:đơn\s*hàng|đơn\s*của|lịch\s*sử\s*(?:đặt|mua)|theo\s*dõi\s*đơn|đặt\s*hàng\s*trước|đã\s*mua\s*những|bao\s*nhiêu\s*đơn)\b/i.test(
      lower,
    )
  ) {
    push('getUserOrders', { limit: 6 });
  }

  if (
    /\b(?:ưu\s*đãi|quyền\s*lợi)\s*hội\s*viên\b|\bhạng\s*(?:silver|gold|diamond|bạch\s*kim|kim\s*cương|vàng|bạc)\b|\btích\s*(?:đ|điểm)|\bđiểm\s*thưởng\b|\bloyalty\b/i.test(
      lower,
    )
  ) {
    push('getMemberBenefits', { tierSlug: user?.tierSlug || '' });
  }

  if (
    /\b(?:voucher|mã\s*giảm|mã\s*km|coupon|gift[\s_-]*code)\b/i.test(lower)
  ) {
    const cm =
      q.match(/(?:code|mã)\s*[:\s]+([A-Z0-9][A-Z0-9_-]{5,})\b/i) ||
      q.match(/\b([A-Z]{2,}[A-Z0-9_-]{4,})\b/) ||
      q.match(/\b([A-Z][A-Za-z0-9_-]{6,})\b/);
    if (cm) {
      push('checkVoucher', { code: String(cm[1]).toUpperCase() });
    }
  }

  return plans;
}

/**
 * Fast path trống nhưng ý định có thể cần searchBooks / getFlashSale... → gọi router LLM (1 lần).
 */
function maybeNeedsLlmToolRouter(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  const kws = [
    'voucher',
    'mã giảm',
    'mã km',
    'coupon',
    'flash sale',
    'flashsale',
    'ưu đãi',
    'khuyến mãi',
    'khuyến mại',
    'sự kiện',
    'chương trình giảm',
    'promo',
    'deal',
    'đơn hàng',
    'đặt hàng',
    'lịch sử',
    'hội viên',
    'thành viên',
    'membership',
    'tier',
    'điểm thưởng',
    'loyalty',
  ];
  return kws.some((k) => lower.includes(k));
}

function injectToolArgs(name, rawArgs = {}, user) {
  const args = { ...(rawArgs || {}) };
  if (name === 'checkVoucher') {
    args.isMember = args.isMember ?? user.isMember;
    args.tierSlug = args.tierSlug ?? user.tierSlug;
  }
  if (name === 'getMemberBenefits') {
    if (!args.tierSlug && user.tierSlug) args.tierSlug = user.tierSlug;
  }
  if (name === 'getUserOrders') {
    args.email = user.email || '';
  }
  return args;
}

async function runToolPlans(plans, user, sse) {
  const toolResults = [];
  for (const plan of plans.slice(0, 3)) {
    if (!plan.name || typeof TOOLS[plan.name] !== 'function') continue;
    const args = injectToolArgs(plan.name, plan.args, user);
    const r = await runTool(plan.name, args);
    toolResults.push(r);
    sse('tool', { name: plan.name, ok: r.ok });
  }
  return toolResults;
}

function safeUser(req) {
  if (!req?.user) return { id: null, email: '', tierSlug: '', isMember: false };
  return {
    id: req.user.id || null,
    email: req.user.email || '',
    tierSlug: req.user.membershipTierSlug || '',
    isMember: !!req.user.isMember,
  };
}

class ChatbotController {
  /** POST /api/chatbot/session — tạo phiên mới */
  async createSession(req, res, next) {
    try {
      const u = safeUser(req);
      const session = await ChatSession.create({
        sessionId: genSessionId(),
        userId: u.id,
        userEmail: u.email,
        title: 'Cuộc trò chuyện mới',
        status: 'active',
        lastActivityAt: new Date(),
      });
      return res.status(201).json({
        ...sessionPayload(session),
        title: session.title,
      });
    } catch (err) { next(err); }
  }

  /** GET /api/chatbot/sessions — danh sách phiên của user */
  async listSessions(req, res, next) {
    try {
      const u = safeUser(req);
      if (!u.id) return res.status(200).json({ items: [] });
      const items = await ChatSession.find({ userId: u.id })
        .sort({ updatedAt: -1 })
        .limit(50)
        .select('sessionId title status endReason rating ratedAt createdAt updatedAt lastActivityAt messageCount')
        .lean();
      return res.status(200).json({ items });
    } catch (err) { next(err); }
  }

  /** GET /api/chatbot/session/:id — chi tiết + trạng thái idle */
  async getSession(req, res, next) {
    try {
      const sessionId = req.params.id;
      const s = await lifecycle.autoEndIfIdle(sessionId);
      if (!s) return res.status(404).json({ message: 'Không tìm thấy phiên.' });
      return res.status(200).json(sessionPayload(s));
    } catch (err) { next(err); }
  }

  /** GET /api/chatbot/session/:id/messages — load history cho UI */
  async getMessages(req, res, next) {
    try {
      const sessionId = req.params.id;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || config.session.historyPageSize));
      const docs = await ChatMessage.find({ sessionId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .lean();
      return res.status(200).json({ items: docs });
    } catch (err) { next(err); }
  }

  /** POST /api/chatbot/session/:id/close — user đóng phiên thủ công */
  async closeSession(req, res, next) {
    try {
      await lifecycle.markUserClosed(req.params.id);
      return res.status(200).json({ ok: true });
    } catch (err) { next(err); }
  }

  /**
   * POST /api/chatbot/session/:id/rate — gửi rating + feedback.
   * Cho phép gọi ngay cả khi phiên đang active (sẽ tự đóng).
   */
  async rateSession(req, res, next) {
    try {
      const sessionId = req.params.id;
      const skip = req.body?.skip === true || String(req.body?.skip || '').toLowerCase() === 'true';
      const ratingRaw = req.body?.rating;
      const feedback = String(req.body?.feedback || '').slice(0, 1000);
      const s = await ChatSession.findOne({ sessionId });
      if (!s) return res.status(404).json({ message: 'Không tìm thấy phiên.' });

      if (skip) {
        s.feedbackSkipped = true;
        s.ratedAt = new Date();
        if (s.status === 'active') {
          s.status = 'closed';
          s.endedAt = new Date();
        }
        s.phase = 'active';
        s.endReason = s.endReason || 'skipped_feedback';
        await s.save();
        lifecycle.purgeSessionMessages(sessionId).catch(() => {});
        return res.status(200).json({ ok: true, skipped: true, ...sessionPayload(s) });
      }

      const issueResolved = normalizeIssueResolved(req.body?.issueResolved);
      if (issueResolved) s.issueResolved = issueResolved;

      const rating = Math.max(1, Math.min(5, Number(ratingRaw)));
      if (!Number.isFinite(rating)) {
        return res.status(400).json({ message: 'rating phải là số 1-5 (hoặc gửi skip: true).' });
      }
      s.rating = rating;
      s.feedback = feedback;
      s.feedbackSkipped = false;
      s.ratedAt = new Date();
      if (s.status === 'active') {
        s.status = 'closed';
        s.endedAt = new Date();
      }
      s.phase = 'active';
      s.endReason = 'rated';
      await s.save();
      lifecycle.purgeSessionMessages(sessionId).catch(() => {});
      return res.status(200).json({ ok: true, rating: s.rating, feedback: s.feedback, ...sessionPayload(s) });
    } catch (err) { next(err); }
  }

  /**
   * POST /api/chatbot/session/:id/continue — trả lời "Bạn cần hỗ trợ thêm không?"
   * body: { wantMore: true | false }
   */
  async continueSession(req, res, next) {
    try {
      const sessionId = req.params.id;
      const wantMore =
        req.body?.wantMore === true || String(req.body?.wantMore || '').toLowerCase() === 'true';
      const s = await ChatSession.findOne({ sessionId });
      if (!s) return res.status(404).json({ message: 'Không tìm thấy phiên.' });
      if (s.phase !== 'awaiting_continue') {
        return res.status(400).json({
          message: 'Phiên không ở trạng thái chờ xác nhận tiếp tục.',
          phase: s.phase,
        });
      }

      if (wantMore) {
        s.phase = 'active';
        s.status = 'active';
        s.endReason = '';
        s.endedAt = null;
        s.totalTokensUsed = 0;
        s.lastActivityAt = new Date();
        await s.save();
        return res.status(200).json({
          ok: true,
          wantMore: true,
          message: 'Tiếp tục phiên trò chuyện.',
          ...sessionPayload(s),
        });
      }

      s.phase = 'awaiting_resolved';
      s.status = 'closed';
      s.endReason = 'declined_continue';
      s.endedAt = new Date();
      await s.save();
      return res.status(200).json({
        ok: true,
        wantMore: false,
        message: 'Vấn đề của bạn đã được giải quyết chưa?',
        ...sessionPayload(s),
      });
    } catch (err) { next(err); }
  }

  /**
   * POST /api/chatbot/session/:id/issue-resolved
   * body: { issueResolved: 'yes' | 'no' | 'partial' }
   */
  async submitIssueResolved(req, res, next) {
    try {
      const sessionId = req.params.id;
      const issueResolved = normalizeIssueResolved(req.body?.issueResolved);
      if (!issueResolved) {
        return res.status(400).json({ message: 'issueResolved phải là yes, no hoặc partial.' });
      }
      const s = await ChatSession.findOne({ sessionId });
      if (!s) return res.status(404).json({ message: 'Không tìm thấy phiên.' });

      s.issueResolved = issueResolved;
      if (s.phase === 'awaiting_resolved' || s.phase === 'awaiting_continue') {
        s.phase = 'awaiting_feedback';
        if (s.status !== 'closed') {
          s.status = 'closed';
          s.endedAt = new Date();
        }
      }
      await s.save();
      return res.status(200).json({
        ok: true,
        issueResolved: s.issueResolved,
        message: 'Cảm ơn bạn! Vui lòng đánh giá trải nghiệm.',
        ...sessionPayload(s),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chatbot/session/:id/message — endpoint chính, stream qua SSE.
   * body: { content: string }
   */
  async sendMessage(req, res, next) {
    const sessionId = req.params.id;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ message: 'content rỗng.' });

    let session = await ChatSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên.' });

    session = await lifecycle.autoEndIfIdle(sessionId);
    if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên.' });

    if (session.phase === 'awaiting_continue') {
      return res.status(409).json({
        message: 'Vui lòng chọn Có hoặc Không — bạn có cần hỗ trợ thêm không?',
        phase: session.phase,
        ...sessionPayload(session),
      });
    }

    if (session.phase === 'awaiting_resolved' || (!session.issueResolved && session.phase === 'awaiting_feedback')) {
      return res.status(409).json({
        message: 'Vui lòng cho biết vấn đề đã được giải quyết chưa.',
        needsIssueResolved: true,
        ...sessionPayload(session),
      });
    }

    if (session.phase === 'awaiting_feedback' || (session.status === 'closed' && !session.feedbackSkipped && !session.rating)) {
      return res.status(409).json({
        message: 'Phiên đã kết thúc. Vui lòng đánh giá hoặc bỏ qua để bắt đầu phiên mới.',
        needsFeedback: true,
        ...sessionPayload(session),
      });
    }

    const idleFor = Date.now() - new Date(session.lastActivityAt || session.createdAt).getTime();
    if (session.status !== 'active' || idleFor >= config.session.idleMinutes * 60 * 1000) {
      if (session.status === 'active') {
        session.status = 'closed';
        session.endReason = 'timeout';
        session.phase = 'awaiting_resolved';
        session.endedAt = new Date();
        await session.save();
      }
      return res.status(409).json({
        message: 'Phiên đã kết thúc do không hoạt động. Vui lòng xác nhận vấn đề đã được giải quyết.',
        needsIssueResolved: true,
        ...sessionPayload(session),
      });
    }

    const u = safeUser(req);
    const isFirstUserMessage = session.messageCount === 0;

    // 1) Lưu tin user ngay
    const userMsg = await ChatMessage.create({
      sessionId,
      role: 'user',
      content,
    });
    await ChatSession.updateOne(
      { sessionId },
      { $inc: { messageCount: 1 }, $set: { lastActivityAt: new Date() } },
    );

    // 2) Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const sse = (event, payload) => {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload || {})}\n\n`);
      } catch (_e) {}
    };
    let clientGone = false;
    req.on('close', () => { clientGone = true; });
    sse('ready', { sessionId, userMessageId: String(userMsg._id) });

    const startedAt = Date.now();
    try {
      // 3) Build context + rewrite query
      const ctx = await buildContext(sessionId, config.session.contextWindow);
      const ctxForRewrite = ctx.slice(0, -1); // bỏ chính câu user vừa lưu
      const standalone = await rewriteQuery({ chatContext: ctxForRewrite, question: content });

      // 4) RAG (chạy song song với tool decision)
      const ragP = ragSearch(standalone);

      // 5) Tools: đường nhanh (regex) không gọi LLM; không khớp mới nhờ LLM router 1 round.
      const qEff = standalone || content;
      const fastPlans = inferToolPlansFast(qEff, u);
      let toolResults = [];
      if (fastPlans.length) {
        toolResults = await runToolPlans(fastPlans, u, sse);
      } else if (llm.hasKey() && maybeNeedsLlmToolRouter(qEff)) {
        const decisionMessages = [
          {
            role: 'system',
            content:
              'Bạn là router. Dựa vào câu hỏi và ngữ cảnh, quyết định có nên gọi tool trong số: searchBooks, getFlashSale, checkVoucher, getMemberBenefits, getUserOrders. Chỉ gọi tool khi thật cần. Không trả lời nội dung cho user.',
          },
          ...ctxForRewrite,
          { role: 'user', content: qEff },
        ];
        const decision = await llm.complete({
          messages: decisionMessages,
          model: config.llm.fastModel,
          temperature: 0,
          tools: TOOL_DEFINITIONS,
          toolChoice: 'auto',
          maxTokens: 200,
        });
        const llmPlans = [];
        const calls = Array.isArray(decision.toolCalls) ? decision.toolCalls : [];
        for (const call of calls.slice(0, 3)) {
          const rawName = call?.function?.name;
          try {
            const argsObj = JSON.parse(call?.function?.arguments || '{}');
            llmPlans.push({ name: rawName, args: argsObj });
          } catch (_e) {
            llmPlans.push({ name: rawName, args: {} });
          }
        }
        toolResults = await runToolPlans(
          llmPlans.filter((p) => p.name && typeof TOOLS[p.name] === 'function'),
          u,
          sse,
        );
      }

      const rag = await ragP;
      sse('rag', {
        books: rag.items?.length ?? 0,
        faq: rag.ragFaq?.length ?? 0,
        promotions: rag.ragPromotions?.length ?? 0,
        sources: rag.sources,
        source: rag.source,
      });

      // 6) Build prompt cuối & stream LLM
      const messages = buildMessages({
        chatContext: ctx,
        toolResults,
        ragBooks: rag.items,
        ragFaq: rag.ragFaq || [],
        ragPromotions: rag.ragPromotions || [],
        question: content,
        user: {
          isLoggedIn: !!u.id,
          email: u.email || '',
          isMember: !!u.isMember,
          tierSlug: u.tierSlug || '',
        },
      });

      let assistantText = '';
      for await (const chunk of llm.stream({ messages })) {
        if (clientGone) break;
        if (chunk.error) sse('error', { error: chunk.error });
        if (chunk.delta) {
          assistantText += chunk.delta;
          sse('delta', { delta: chunk.delta });
        }
        if (chunk.done) break;
      }

      // 7) Lưu assistant message
      const retrievedBookIds = (rag.items || [])
        .map((b) => b?._id)
        .filter(Boolean)
        .slice(0, 12);
      const toolsUsed = toolResults.map((r) => ({
        name: r.name,
        argsSummary: '',
        ok: !!r.ok,
      }));
      const latency = Date.now() - startedAt;
      const asst = await ChatMessage.create({
        sessionId,
        role: 'assistant',
        content: assistantText || '(không có phản hồi)',
        retrievedBookIds,
        toolsUsed,
        latencyMs: latency,
      });
      const toolPayload = toolResults
        .map((r) => (r?.data != null ? JSON.stringify(r.data) : r?.message || ''))
        .join('\n');
      const turnTokens = estimateTurnTokens({
        userContent: content,
        assistantText,
        standalone,
        toolPayload,
      });
      const newTotal = (session.totalTokensUsed || 0) + turnTokens;

      let phase = session.phase || 'active';
      let askContinue = false;
      if (phase === 'active' && newTotal >= config.session.tokenThreshold) {
        phase = 'awaiting_continue';
        askContinue = true;
      }

      await ChatSession.updateOne(
        { sessionId },
        {
          $inc: { messageCount: 1, toolCallCount: toolsUsed.length },
          $set: {
            lastActivityAt: new Date(),
            totalTokensUsed: newTotal,
            phase,
          },
        },
      );

      sse('done', {
        assistantMessageId: String(asst._id),
        retrievedBookIds: retrievedBookIds.map(String),
        latencyMs: latency,
        totalTokensUsed: newTotal,
        tokenThreshold: config.session.tokenThreshold,
      });

      if (askContinue) {
        sse('session', {
          action: 'ask_continue',
          message: 'Bạn cần hỗ trợ thêm không?',
          totalTokensUsed: newTotal,
          tokenThreshold: config.session.tokenThreshold,
        });
      }

      res.end();

      // 8) Đặt tên phiên async sau tin đầu tiên
      if (isFirstUserMessage) {
        nameSessionAsync(sessionId, content).catch(() => {});
      }
    } catch (err) {
      console.error('[chatbot.sendMessage] error:', err);
      try {
        sse('error', { error: err?.message || 'server_error' });
        res.end();
      } catch (_e) {}
    }
  }
}

module.exports = new ChatbotController();
