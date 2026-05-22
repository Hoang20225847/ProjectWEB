const Book = require('../../models/Books');
const vectorSync = require('./vectorSync');
const config = require('../config');

/**
 * Lắng nghe thay đổi trên collection Books (insert / update / delete)
 * và đồng bộ sang Qdrant. Yêu cầu MongoDB chạy ở chế độ replica set.
 * Nếu không có replica set, ta fallback sang polling đơn giản (interval).
 */

let changeStream = null;
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

async function handleChange(change) {
  try {
    const op = change?.operationType;
    if (!op) return;
    if (op === 'delete') {
      const id = change?.documentKey?._id;
      if (id) await vectorSync.removeBookById(String(id));
      return;
    }
    if (op === 'insert' || op === 'update' || op === 'replace') {
      const id = change?.documentKey?._id;
      if (!id) return;
      const full = await Book.findById(id).lean();
      if (!full) return;
      await vectorSync.syncBook(full);
    }
  } catch (err) {
    console.error('[chatbot.bookWatcher] handleChange error:', err?.message || err);
  }
}

function startPollingFallback() {
  if (pollTimer) return;
  const intervalMs = 60 * 1000;
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
  }, intervalMs);
  console.log('[chatbot.bookWatcher] polling fallback (no replica set).');
}

async function startBookWatcher() {
  if (!config.qdrant.enabled) {
    console.log('[chatbot.bookWatcher] Qdrant disabled — skip watcher.');
    return;
  }
  try {
    changeStream = Book.watch(
      [{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }],
      { fullDocument: 'updateLookup' },
    );
    changeStream.on('change', handleChange);
    changeStream.on('error', (err) => {
      console.error('[chatbot.bookWatcher] stream error:', err?.message || err);
      try { changeStream.close(); } catch (_e) {}
      changeStream = null;
      startPollingFallback();
    });
    console.log('[chatbot.bookWatcher] change stream started.');
  } catch (err) {
    console.warn(
      '[chatbot.bookWatcher] cannot start change stream (need replica set). Falling back to polling.',
      err?.message || err,
    );
    startPollingFallback();
  }
}

async function stopBookWatcher() {
  if (changeStream) {
    try { await changeStream.close(); } catch (_e) {}
    changeStream = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = { startBookWatcher, stopBookWatcher, processFullIndex };
