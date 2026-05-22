const config = require('./config');
const routes = require('./routes');
const lifecycle = require('./services/sessionLifecycle');
const { bootstrapVectors } = require('./bootstrapVectors');
const { startBookWatcher, stopBookWatcher } = require('./sync/bookWatcher');
const { startPromotionWatcher, stopPromotionWatcher } = require('./sync/promotionWatcher');
const { startReviewWatcher, stopReviewWatcher } = require('./sync/reviewWatcher');

/**
 * Bootstrap module chatbot: gắn router + khởi động background jobs.
 * Gọi initChatbot(app) trong index.js của server SAU khi mongoose đã connect.
 */
function initChatbot(app, { mountPath = '/api/chatbot' } = {}) {
  if (!config.enabled) {
    console.log('[chatbot] disabled via env.');
    return;
  }
  app.use(mountPath, routes);
  lifecycle.startIdleSweeper();
  bootstrapVectors().catch((err) => console.error('[chatbot.bootstrapVectors]', err?.message || err));
  startBookWatcher().catch((err) => {
    console.error('[chatbot.init] bookWatcher failed:', err?.message || err);
  });
  startPromotionWatcher().catch((err) => {
    console.error('[chatbot.init] promotionWatcher failed:', err?.message || err);
  });
  startReviewWatcher().catch((err) => {
    console.error('[chatbot.init] reviewWatcher failed:', err?.message || err);
  });
  console.log(`[chatbot] mounted at ${mountPath}`);
}

function shutdownChatbot() {
  lifecycle.stopIdleSweeper();
  stopBookWatcher();
  stopPromotionWatcher();
  stopReviewWatcher();
}

module.exports = { initChatbot, shutdownChatbot, config };
