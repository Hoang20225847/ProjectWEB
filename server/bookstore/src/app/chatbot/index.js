const config = require('./config');
const validateChatbotConfig = config.validateChatbotConfig;
const routes = require('./routes');
const lifecycle = require('./services/sessionLifecycle');
const { bootstrapVectors } = require('./bootstrapVectors');
const { startBookWatcher, stopBookWatcher } = require('./sync/bookWatcher');

/**
 * Bootstrap module chatbot: gắn router + khởi động background jobs.
 * Gọi initChatbot(app) trong index.js của server SAU khi mongoose đã connect.
 */
function initChatbot(app, { mountPath = '/api/chatbot' } = {}) {
  if (!config.enabled) {
    console.log('[chatbot] disabled via env.');
    return;
  }

  const validation = validateChatbotConfig();
  if (!validation.ok) {
    console.error('[chatbot] Cấu hình .env không đủ — module không được mount:');
    for (const err of validation.errors) console.error(`  · ${err}`);
    return;
  }

  console.log(
    `[chatbot] LLM: ${config.llm.provider}/${config.llm.model} | Embed: ${config.embedding.provider}/${config.embedding.model} (dim=${config.embedding.dim})`,
  );

  app.use(mountPath, routes);
  lifecycle.startIdleSweeper();
  bootstrapVectors().catch((err) => console.error('[chatbot.bootstrapVectors]', err?.message || err));
  try {
    startBookWatcher();
  } catch (err) {
    console.error('[chatbot.init] bookWatcher failed:', err?.message || err);
  }
  console.log(`[chatbot] mounted at ${mountPath}`);
}

function shutdownChatbot() {
  lifecycle.stopIdleSweeper();
  stopBookWatcher();
}

module.exports = { initChatbot, shutdownChatbot, config, validateChatbotConfig };
