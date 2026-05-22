const analytics = require('../services/analyticsService');
const ChatSession = require('../models/ChatSession');

function isAdmin(req) {
  return req?.user?.role === 'admin';
}

class ChatbotAdminController {
  /**
   * POST /admin/books/:id/suggest-semantic-labels
   * body: { persist?: boolean, mergeMode?: 'union' | 'replace' }
   * Gợi ý themes/mood/contentTags/audience từ mô tả + review (LLM). Admin JWT (role=admin).
   */
  async suggestBookSemanticLabels(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được gọi.' });
      const id = req.params.id;
      if (!id || !String(id).match(/^[a-f0-9]{24}$/i)) {
        return res.status(400).json({ message: 'bookId không hợp lệ.' });
      }

      const Book = require('../../models/Books');
      const { enrichBookSemantics } = require('../services/bookSemanticEnrichment');

      const persist = Boolean(req.body?.persist);
      const mergeMode = req.body?.mergeMode === 'replace' ? 'replace' : 'union';
      const force = Boolean(req.body?.force);

      const book = await Book.findById(id).lean();
      if (!book) return res.status(404).json({ message: 'Không tìm thấy sách.' });

      if (!persist) {
        const suggest = require('../services/bookSemanticSuggestion');
        const Category = require('../../models/Category');
        const Review = require('../../models/Review');
        let categoryName = '';
        if (book.category) {
          const c = await Category.findById(book.category).select('name').lean();
          if (c?.name) categoryName = String(c.name);
        }
        const revDocs = await Review.find({ bookId: id })
          .sort({ createdAt: -1 })
          .limit(30)
          .select('comment')
          .lean();
        const reviewText = revDocs
          .map((r) => String(r?.comment || '').trim())
          .filter(Boolean)
          .join('\n---\n')
          .slice(0, 12000);
        const suggested = await suggest.suggestSemanticLabels({
          bookName: book.name,
          author: book.author,
          genres: book.genres,
          categoryName,
          description: book.description,
          reviewText,
        });
        if (!suggested.ok) {
          return res.status(422).json({
            message: suggested.error || 'LLM thất bại',
            code: suggested.code,
            rawHint: suggested.rawHint,
          });
        }
        return res.status(200).json({
          bookId: String(id),
          suggested: {
            themes: suggested.themes,
            mood: suggested.mood,
            contentTags: suggested.contentTags,
            audience: suggested.audience,
            rationale: suggested.rationale || '',
          },
          persist: false,
        });
      }

      const r = await enrichBookSemantics(id, { mergeMode, force: force || mergeMode === 'replace' });
      if (!r.ok) {
        return res.status(422).json({
          message: r.error || r.reason || 'Enrich thất bại',
          reason: r.reason,
          code: r.code,
          rawHint: r.rawHint,
        });
      }

      return res.status(200).json({
        bookId: String(id),
        suggested: {
          themes: r.themes,
          mood: r.mood,
          contentTags: r.contentTags,
          audience: r.audience,
          rationale: r.rationale || '',
        },
        persist: true,
        mergeMode,
        action: r.action,
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /admin/chatbot/analytics/overview */
  async overview(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được xem.' });
      const data = await analytics.overview(req);
      return res.status(200).json(data);
    } catch (err) { next(err); }
  }

  /** GET /admin/chatbot/analytics/daily */
  async daily(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được xem.' });
      const data = await analytics.dailySeries(req);
      return res.status(200).json({ items: data });
    } catch (err) { next(err); }
  }

  /** GET /admin/chatbot/analytics/top-tools */
  async topTools(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được xem.' });
      const data = await analytics.topToolsUsed(req);
      return res.status(200).json({ items: data });
    } catch (err) { next(err); }
  }

  /** GET /admin/chatbot/feedbacks */
  async feedbacks(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được xem.' });
      const data = await analytics.recentFeedback(req);
      return res.status(200).json({ items: data });
    } catch (err) { next(err); }
  }

  /** GET /admin/chatbot/sessions — danh sách phiên (lọc theo rating/status) */
  async listSessions(req, res, next) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Chỉ admin được xem.' });
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
      const filter = {};
      if (req.query.status) filter.status = String(req.query.status);
      if (req.query.minRating) filter.rating = { $gte: Number(req.query.minRating) };
      if (req.query.hasFeedback === 'true') filter.feedback = { $ne: '' };
      if (req.query.issueResolved) filter.issueResolved = String(req.query.issueResolved);
      const items = await ChatSession.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(
          'sessionId userEmail title status phase endReason rating feedback issueResolved ratedAt totalTokensUsed messageCount createdAt endedAt',
        )
        .lean();
      return res.status(200).json({ items });
    } catch (err) { next(err); }
  }

}

module.exports = new ChatbotAdminController();
