const Book = require('../../models/Books');
const vectorSync = require('./vectorSync');
const config = require('../config');

/**
 * Polling đơn giản: đồng bộ sách đổi (theo updateAt) sang Qdrant.
 * Xóa sách qua API admin vẫn gọi vectorSync.removeBookById trực tiếp.
 */

const POLL_INTERVAL_MS = 60 * 1000;

let pollTimer = null;
let lastPollAt = new Date(0);

async function processFullIndex({ limit = 200 } = {}) {
  if (!config.qdrant.enabled) return { synced: 0, skipped: 0 };
  const books = await Book.find({ status: 'published' }).limit(limit).lean();
  let synced = 0;
  let skipped = 0;
  for (const b of books) {
    const r = await vectorSync.syncBook(b);
    if (r.ok) synced += 1;
    else skipped += 1;
  }
  return { synced, skipped };
}

function startBookPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const since = lastPollAt;
      lastPollAt = new Date();
      const changed = await Book.find({ updateAt: { $gt: since } }).limit(50).lean();
      for (const b of changed) {
        await vectorSync.syncBook(b);
      }
    } catch (err) {
      console.error('[chatbot.bookWatcher] poll error:', err?.message || err);
    }
  }, POLL_INTERVAL_MS);
  console.log(`[chatbot.bookWatcher] polling started (interval ${POLL_INTERVAL_MS / 1000}s).`);
}

function startBookWatcher() {
  if (!config.qdrant.enabled) {
    console.log('[chatbot.bookWatcher] Qdrant disabled — skip watcher.');
    return;
  }
  startBookPolling();
}

function stopBookWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = { startBookWatcher, stopBookWatcher, processFullIndex };
