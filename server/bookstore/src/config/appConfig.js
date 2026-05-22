/**
 * Cấu hình deploy: local (npm start) | Render (API) | Vercel (CLIENT_BASE_URL).
 */

function getPort() {
  const p = Number(process.env.PORT);
  return Number.isFinite(p) && p > 0 ? p : 3001;
}

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/book_store'
  );
}

/** URL public của API (ảnh /uploads, VNPay return, avatar). */
function getPublicApiUrl() {
  const raw = (process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (raw) return raw;
  const port = getPort();
  return `http://localhost:${port}`;
}

function getClientBaseUrl() {
  return (process.env.CLIENT_BASE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
}

/** Danh sách origin CORS — phân tách bằng dấu phẩy. */
function getCorsOrigins() {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    getClientBaseUrl(),
  ];
  const merged = [...new Set([...defaults, ...fromEnv])];
  return merged;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

module.exports = {
  getPort,
  getMongoUri,
  getPublicApiUrl,
  getClientBaseUrl,
  getCorsOrigins,
  isProduction,
};
