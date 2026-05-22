const FlashSale = require('../../models/FlashSale');
const config = require('../config');
const qdrant = require('../clients/qdrantClient');
const { syncFlashSaleById } = require('./promotionVectorSync');

let changeStream = null;

async function handleChange(change) {
  try {
    const id = change?.documentKey?._id;
    if (!id) return;
    const op = change?.operationType;
    if (op === 'delete') {
      await qdrant.deletePoint('promotion', qdrant.objectIdToPointId(id));
      return;
    }
    await syncFlashSaleById(String(id));
  } catch (err) {
    console.warn('[chatbot.promotionWatcher]', err?.message || err);
  }
}

async function startPromotionWatcher() {
  if (!config.qdrant.enabled) return;
  try {
    changeStream = FlashSale.watch([{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }], {
      fullDocument: 'updateLookup',
    });
    changeStream.on('change', handleChange);
    changeStream.on('error', (err) => {
      console.error('[chatbot.promotionWatcher] stream error:', err?.message || err);
      try { changeStream.close(); } catch (_e) {}
      changeStream = null;
    });
    console.log('[chatbot.promotionWatcher] change stream started.');
  } catch (err) {
    console.warn('[chatbot.promotionWatcher] skip watcher:', err?.message || err);
  }
}

function stopPromotionWatcher() {
  if (changeStream) {
    try { changeStream.close(); } catch (_e) {}
    changeStream = null;
  }
}

module.exports = { startPromotionWatcher, stopPromotionWatcher };
