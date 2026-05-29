const STORAGE_KEY = 'bookstore_search_history';
const MAX_ITEMS = 8;

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword) {
  const q = keyword?.trim();
  if (!q) return getSearchHistory();
  let list = getSearchHistory().filter((x) => x !== q);
  list.unshift(q);
  list = list.slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function clearSearchHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function removeSearchHistoryItem(keyword) {
  const list = getSearchHistory().filter((x) => x !== keyword);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}
