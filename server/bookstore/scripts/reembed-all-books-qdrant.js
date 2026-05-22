/**
 * Batch re-embed toàn kho (hoặc tập đã publish) vào Qdrant — dùng logic vectorSync.syncBook().
 *
 * Chạy từ thư mục server/bookstore:
 *   node scripts/reembed-all-books-qdrant.js --dry-run
 *   node scripts/reembed-all-books-qdrant.js --published-only
 *   node scripts/reembed-all-books-qdrant.js --limit 200
 *
 * ENV:
 *   MONGODB_URI (mặc định mongodb://localhost:27017/book_store)
 *   QDRANT_BATCH_DELAY_MS — nghỉ giữa mỗi sách để giảm 429 embedding (mặc định 200)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/book_store';
const BATCH_DELAY_MS = Math.max(
  0,
  Number(process.env.QDRANT_BATCH_DELAY_MS ?? process.env.CHATBOT_REEMBED_DELAY_MS ?? 200),
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLimit() {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return null;
  const n = Number(String(arg.split('=')[1] || '').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const publishedOnly = process.argv.includes('--published-only');
  const limit = parseLimit();

  const chatbotConfig = require(path.join(__dirname, '..', 'src', 'app', 'chatbot', 'config'));
  if (!chatbotConfig.qdrant.enabled) {
    console.error('[reembed] QDRANT_ENABLED=false — hãy bật vector DB trước.');
    process.exitCode = 1;
    return;
  }

  const Book = require(path.join(__dirname, '..', 'src', 'app', 'models', 'Books'));
  const vectorSync = require(path.join(__dirname, '..', 'src', 'app', 'chatbot', 'sync', 'vectorSync'));

  await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

  const filter = {};
  if (publishedOnly) filter.status = 'published';

  const ids = await Book.find(filter).select('_id').lean();
  let slice = ids;
  if (limit != null) slice = ids.slice(0, limit);

  const stats = {
    scanned: slice.length,
    dryRun,
    publishedOnly,
    ok: 0,
    deleted: 0,
    skipped: 0,
    embedFailed: 0,
    noBook: 0,
  };

  console.log(JSON.stringify({ message: 'reembed-all-books-qdrant start', filter, count: slice.length }, null, 2));

  for (let i = 0; i < slice.length; i += 1) {
    const row = slice[i];
    const oid = row?._id;
    if (!oid) {
      stats.noBook += 1;
      continue;
    }

    if (dryRun) {
      if (i < 12 || i === slice.length - 1) {
        console.log(`[dry-run] ${String(oid)}`);
      }
      continue;
    }

    const full = await Book.findById(oid).lean();
    if (!full) {
      stats.noBook += 1;
      continue;
    }

    try {
      const r = await vectorSync.syncBook(full);
      const act = String(r.action || '');
      if (r.ok && act === 'upserted') stats.ok += 1;
      else if (r.ok && act.startsWith('deleted')) stats.deleted += 1;
      else if (!r.ok && r.reason === 'embed_failed') stats.embedFailed += 1;
      else stats.skipped += 1;
    } catch (e) {
      stats.skipped += 1;
      console.warn('[reembed]', String(oid), e?.message || e);
    }

    if (BATCH_DELAY_MS && i < slice.length - 1) await sleep(BATCH_DELAY_MS);

    if ((i + 1) % 50 === 0) {
      console.log(`… progress ${i + 1}/${slice.length}`, stats);
    }
  }

  console.log(JSON.stringify({ message: 'reembed-all-books-qdrant done', stats }, null, 2));
  await mongoose.disconnect().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
