const Book = require('../../models/Books');
const Category = require('../../models/Category');
const Review = require('../../models/Review');
const { suggestSemanticLabels, normalizeSemanticList } = require('./bookSemanticSuggestion');
const vectorSync = require('../sync/vectorSync');

const ENABLED = process.env.CHATBOT_AUTO_SEMANTIC_ENABLED !== 'false';
const MIN_DESC_LEN = Math.max(0, Number(process.env.CHATBOT_AUTO_SEMANTIC_MIN_DESC || 40));

function hasSemanticLabels(book) {
  const t = Array.isArray(book?.themes) && book.themes.length > 0;
  const m = Array.isArray(book?.mood) && book.mood.length > 0;
  return t || m;
}

/**
 * Có nên chạy AI gợi ý sau khi lưu sách published.
 * @param {object|null} prev — document trước update (null khi create)
 * @param {object} next — document sau save
 * @param {object} [updatePayload] — body updates (updateBook)
 */
function shouldAutoEnrich(prev, next, updatePayload = {}) {
  if (!ENABLED) return false;
  if (!next || next.status !== 'published') return false;

  const desc = String(next.description || '').trim();
  if (desc.length < MIN_DESC_LEN) return false;

  const manualThemes =
    updatePayload &&
    'themes' in updatePayload &&
    Array.isArray(updatePayload.themes) &&
    updatePayload.themes.length > 0;
  const manualMood =
    updatePayload &&
    'mood' in updatePayload &&
    Array.isArray(updatePayload.mood) &&
    updatePayload.mood.length > 0;
  if (manualThemes && manualMood) return false;

  const justPublished = !prev || (prev.status !== 'published' && next.status === 'published');
  const descChanged =
    prev && String(prev.description || '').trim() !== String(next.description || '').trim();
  const semanticsEmpty = !hasSemanticLabels(next);

  return justPublished || descChanged || semanticsEmpty;
}

async function loadEnrichmentContext(book) {
  let categoryName = '';
  if (book?.category) {
    const cid =
      typeof book.category === 'object' && book.category._id ? book.category._id : book.category;
    const c = await Category.findById(cid).select('name').lean();
    if (c?.name) categoryName = String(c.name);
  }

  let reviewText = '';
  if (book?._id) {
    const rs = await Review.find({ bookId: book._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('comment')
      .lean();
    reviewText = rs
      .map((r) => String(r?.comment || '').trim())
      .filter(Boolean)
      .join('\n---\n')
      .slice(0, 12000);
  }

  return { categoryName, reviewText };
}

/**
 * Gọi LLM, ghi Mongo, sync Qdrant.
 * @param {string|object} bookOrId
 * @param {{ mergeMode?: 'union'|'replace', force?: boolean }} opts
 */
async function enrichBookSemantics(bookOrId, opts = {}) {
  const mergeMode = opts.mergeMode === 'union' ? 'union' : 'replace';
  const force = Boolean(opts.force);

  const id =
    typeof bookOrId === 'object' && bookOrId?._id ? bookOrId._id : bookOrId;
  if (!id) return { ok: false, reason: 'no_id' };

  const book = await Book.findById(id).lean();
  if (!book) return { ok: false, reason: 'not_found' };
  if (book.status !== 'published') return { ok: false, reason: 'not_published' };

  const desc = String(book.description || '').trim();
  if (desc.length < MIN_DESC_LEN) return { ok: false, reason: 'description_too_short' };

  if (!force && hasSemanticLabels(book) && mergeMode !== 'union') {
    return { ok: true, action: 'skipped_has_labels', bookId: String(id) };
  }

  const { categoryName, reviewText } = await loadEnrichmentContext(book);
  const suggested = await suggestSemanticLabels({
    bookName: book.name,
    author: book.author,
    genres: book.genres,
    categoryName,
    description: book.description,
    reviewText,
  });

  if (!suggested.ok) {
    return {
      ok: false,
      reason: 'llm_failed',
      code: suggested.code || 'unknown',
      error: suggested.error,
      rawHint: suggested.rawHint,
      bookId: String(id),
    };
  }

  let themes = suggested.themes;
  let mood = suggested.mood;
  let contentTags = suggested.contentTags;
  let audience = suggested.audience;

  if (mergeMode === 'union') {
    themes = normalizeSemanticList([...(book.themes || []), ...themes], 48);
    mood = normalizeSemanticList([...(book.mood || []), ...mood], 48);
    contentTags = normalizeSemanticList([...(book.contentTags || []), ...contentTags], 48);
    audience = normalizeSemanticList([...(book.audience || []), ...audience], 48);
  }

  await Book.updateOne(
    { _id: id },
    { $set: { themes, mood, contentTags, audience } },
  );

  const fresh = await Book.findById(id).lean();
  const sync = await vectorSync.syncBook(fresh);

  return {
    ok: true,
    action: 'enriched',
    bookId: String(id),
    themes,
    mood,
    contentTags,
    audience,
    vectorSync: sync,
    rationale: suggested.rationale || '',
  };
}

/** Chạy nền — không chặn response HTTP. */
function scheduleAutoEnrichOnPublish(prev, next, updatePayload = {}) {
  if (!shouldAutoEnrich(prev, next, updatePayload)) return;
  const bookId = String(next._id);
  const descChanged =
    prev && String(prev.description || '').trim() !== String(next.description || '').trim();
  const mergeMode = descChanged || !hasSemanticLabels(next) ? 'replace' : 'union';

  setImmediate(() => {
    enrichBookSemantics(bookId, { mergeMode, force: descChanged })
      .then((r) => {
        if (r.ok && r.action === 'enriched') {
          console.log('[chatbot.autoSemantic] enriched', bookId, {
            themes: r.themes?.length,
            mood: r.mood?.length,
          });
        } else if (r.ok && r.action === 'skipped_has_labels') {
          console.log('[chatbot.autoSemantic] skip (already has labels)', bookId);
        } else if (!r.ok) {
          console.warn('[chatbot.autoSemantic]', bookId, r.reason, r.error || '');
        }
      })
      .catch((err) => {
        console.warn('[chatbot.autoSemantic] error', bookId, err?.message || err);
      });
  });
}

module.exports = {
  enrichBookSemantics,
  scheduleAutoEnrichOnPublish,
  shouldAutoEnrich,
  hasSemanticLabels,
  MIN_DESC_LEN,
};
