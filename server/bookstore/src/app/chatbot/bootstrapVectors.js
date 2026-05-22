const config = require('./config');

/**
 * Khởi tạo collection Qdrant theo domain + đồng bộ FAQ seed + các flash sale đang bật.
 */
async function bootstrapVectors() {
  if (!config.qdrant.enabled) return;
  const qdrant = require('./clients/qdrantClient');
  const { syncAllFaq } = require('./sync/faqVectors');
  const FlashSale = require('../models/FlashSale');
  const { syncFlashSaleById } = require('./sync/promotionVectorSync');

  await qdrant.ensureCollection('product');
  await qdrant.ensureCollection('promotion');
  await qdrant.ensureCollection('faq');

  const faq = await syncAllFaq();

  let n = 0;
  const rows = await FlashSale.find({ active: true }).select('_id').lean();
  for (const row of rows) {
    await syncFlashSaleById(String(row._id));
    n += 1;
  }
  console.log('[chatbot.vectors] bootstrap: FAQ=', faq, 'promotionsSynced=', n);
}

module.exports = { bootstrapVectors };
