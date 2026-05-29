import { useCallback, useEffect, useState } from 'react';

export const ADMIN_LIST_PREFS_LS = 'bookstore-admin:list-preferences';

const DEFAULT = {
  paginationEnabled: true,
  pageSize: 20,
};

function readPrefs() {
  try {
    const raw = localStorage.getItem(ADMIN_LIST_PREFS_LS);
    if (!raw) return { ...DEFAULT };
    const o = JSON.parse(raw);
    return {
      paginationEnabled: typeof o.paginationEnabled === 'boolean' ? o.paginationEnabled : DEFAULT.paginationEnabled,
      pageSize: [10, 20, 50, 100].includes(Number(o.pageSize)) ? Number(o.pageSize) : DEFAULT.pageSize,
    };
  } catch {
    return { ...DEFAULT };
  }
}

/**
 * Phân trang danh sách admin (bật/tắt + số dòng/trang). Lưu localStorage; tab khác đồng bộ qua sự kiện storage.
 */
export function useAdminListPreferences() {
  const [paginationEnabled, setPaginationEnabledState] = useState(() => readPrefs().paginationEnabled);
  const [pageSize, setPageSizeState] = useState(() => readPrefs().pageSize);

  const syncFromStorage = useCallback(() => {
    const p = readPrefs();
    setPaginationEnabledState(p.paginationEnabled);
    setPageSizeState(p.pageSize);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ADMIN_LIST_PREFS_LS || e.key === null) syncFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    localStorage.setItem(
      ADMIN_LIST_PREFS_LS,
      JSON.stringify({ paginationEnabled, pageSize })
    );
  }, [paginationEnabled, pageSize]);

  const setPaginationEnabled = useCallback((v) => {
    setPaginationEnabledState(!!v);
  }, []);

  const setPageSize = useCallback((n) => {
    const num = Number(n);
    setPageSizeState([10, 20, 50, 100].includes(num) ? num : DEFAULT.pageSize);
  }, []);

  return {
    paginationEnabled,
    pageSize,
    setPaginationEnabled,
    setPageSize,
  };
}
