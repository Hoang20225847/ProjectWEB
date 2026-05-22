/**
 * Re-export embedText. Tách file để 1 nơi duy nhất gọi embedding,
 * dễ thay backend (OpenAI / e5 self-host) sau này.
 */
const { embedText, hasKey } = require('../clients/embeddingClient');

module.exports = { embedText, hasKey };
