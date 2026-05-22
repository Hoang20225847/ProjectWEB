/**
 * Batch: AI gợi ý themes/mood/contentTags/audience + sync Qdrant.
 *
 *   node scripts/suggest-all-books.js --published-only
 *   node scripts/suggest-all-books.js --published-only --limit=5
 *   node scripts/suggest-all-books.js --dry-run
 *
 * ENV: CHATBOT_SEMANTIC_BATCH_DELAY_MS (mặc định 9000), CHATBOT_SEMANTIC_GEMINI_COOLDOWN_MS
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/book_store';
const DELAY_MS = Math.max(
  1000,
  Number(process.env.CHATBOT_SEMANTIC_BATCH_DELAY_MS || 9000),
);
const STOP_AFTER_QUOTA = Number(process.env.CHATBOT_SEMANTIC_STOP_AFTER_QUOTA || 3);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLimit() {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return null;
  const n = Number(String(arg.split('=')[1] || '').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function isQuotaError(msg) {
  const s = String(msg || '').toLowerCase();
  return s.includes('429') || s.includes('quota') || s.includes('rate limit') || s.includes('resource_exhausted');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const publishedOnly = process.argv.includes('--published-only');
  const force = process.argv.includes('--force');
  const limit = parseLimit();

  const { enrichBookSemantics } = require(path.join(
    __dirname,
    '..',
    'src',
    'app',
    'chatbot',
    'services',
    'bookSemanticEnrichment',
  ));
  const Book = require(path.join(__dirname, '..', 'src', 'app', 'models', 'Books'));

  await mongoose.connect(mongoURI);

  const filter = publishedOnly ? { status: 'published' } : {};
  let rows = await Book.find(filter).select('_id name status').lean();
  if (limit != null) rows = rows.slice(0, limit);

  const stats = {
    scanned: rows.length,
    dryRun,
    publishedOnly,
    force,
    delayMs: DELAY_MS,
    enriched: 0,
    skipped: 0,
    failed: 0,
    quotaAborted: false,
  };

  let consecutiveQuota = 0;

  console.log(JSON.stringify({ message: 'suggest-all-books start', filter, count: rows.length }, null, 2));

  for (let i = 0; i < rows.length; i += 1) {
    const id = String(rows[i]._id);
    if (dryRun) {
      if (i < 8 || i === rows.length - 1) console.log('[dry-run]', id, rows[i].name);
      continue;
    }

    try {
      const r = await enrichBookSemantics(id, { mergeMode: 'replace', force });
      if (r.ok && r.action === 'enriched') {
        stats.enriched += 1;
        consecutiveQuota = 0;
      } else if (r.ok) {
        stats.skipped += 1;
        consecutiveQuota = 0;
      } else {
        stats.failed += 1;
        const errMsg = r.error || r.reason || 'unknown';
        const hint = r.rawHint ? ` | raw: ${String(r.rawHint).slice(0, 80)}` : '';
        console.warn(
          `… ${i + 1}/${rows.length}`,
          id.slice(-6),
          r.reason || 'fail',
          '—',
          errMsg.slice(0, 120),
          hint,
        );
        if (isQuotaError(errMsg)) {
          consecutiveQuota += 1;
          if (consecutiveQuota >= STOP_AFTER_QUOTA) {
            console.error(
              `[suggest-all] Dừng sau ${consecutiveQuota} lỗi quota/429 liên tiếp. Đợi quota reset rồi chạy lại.`,
            );
            stats.quotaAborted = true;
            break;
          }
        } else {
          consecutiveQuota = 0;
        }
      }
      if (r.ok && (i + 1) % 10 === 0) {
        console.log(`… ${i + 1}/${rows.length}`, id.slice(-6), r.action);
      }
    } catch (e) {
      stats.failed += 1;
      console.warn('[suggest-all]', id, e?.message || e);
    }

    if (i < rows.length - 1 && !stats.quotaAborted) await sleep(DELAY_MS);
  }

  console.log(JSON.stringify({ message: 'suggest-all-books done', stats }, null, 2));
  await mongoose.disconnect().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
