const Review = require('../../models/Review');
const vectorSync = require('./vectorSync');
const config = require('../config');

let changeStream = null;

async function handleChange(change) {
  try {
    const bid =
      change?.fullDocument?.bookId ??
      change?.fullDocumentBeforeChange?.bookId;
    if (bid) await vectorSync.syncBookFromId(bid);
    else if (change?.documentKey && change?.operationType === 'delete') {
      const oid = change?.documentKey?._id;
      if (!oid) return;
      const doc = await Review.findById(oid).select('bookId').lean();
      if (doc?.bookId) await vectorSync.syncBookFromId(doc.bookId);
    }
  } catch (err) {
    console.warn('[chatbot.reviewWatcher]', err?.message || err);
  }
}

async function startReviewWatcher() {
  if (!config.qdrant.enabled) return;
  try {
    changeStream = Review.watch([{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }], {
      fullDocument: 'updateLookup',
      fullDocumentBeforeChange: true,
    });
    changeStream.on('change', handleChange);
    changeStream.on('error', (err) => {
      console.error('[chatbot.reviewWatcher] stream error:', err?.message || err);
      try { changeStream.close(); } catch (_e) {}
      changeStream = null;
    });
    console.log('[chatbot.reviewWatcher] change stream started.');
  } catch (err) {
    console.warn('[chatbot.reviewWatcher] MongoDB không hỗ trợ fullDocumentBeforeChange hoặc không watch được:', err?.message || err);
  }
}

function stopReviewWatcher() {
  if (changeStream) {
    try { changeStream.close(); } catch (_e) {}
    changeStream = null;
  }
}

module.exports = { startReviewWatcher, stopReviewWatcher };
