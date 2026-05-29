/**
 * API base — dev: localhost:3001 | Vercel: REACT_APP_API_URL trên dashboard.
 */
const API_BASE_URL = (
  process.env.REACT_APP_API_URL || 'http://localhost:3001'
).replace(/\/$/, '');

/** URL đầy đủ cho path /uploads hoặc đường dẫn tương đối từ DB. */
export function resolveMediaUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return s;
  }
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${API_BASE_URL}${path}`;
}

export default API_BASE_URL;
