import { useEffect, useMemo, useState } from 'react';

/**
 * Chia `rows` theo cài đặt phân trang admin (bật/tắt + pageSize). Reset về trang 1 khi dữ liệu / pageSize đổi.
 */
export function useAdminPagedRows(rows, listPrefs) {
  const listLen = Array.isArray(rows) ? rows.length : 0;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [listLen, listPrefs.pageSize, listPrefs.paginationEnabled]);

  const totalPages = useMemo(() => {
    if (!listPrefs.paginationEnabled) return 1;
    return Math.max(1, Math.ceil(listLen / listPrefs.pageSize));
  }, [listLen, listPrefs.paginationEnabled, listPrefs.pageSize]);

  const pagedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (!listPrefs.paginationEnabled) return rows;
    const start = (page - 1) * listPrefs.pageSize;
    return rows.slice(start, start + listPrefs.pageSize);
  }, [rows, page, listPrefs.paginationEnabled, listPrefs.pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return { page, setPage, totalPages, pagedRows };
}
