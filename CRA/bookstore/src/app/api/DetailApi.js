/** Chi tiết 1 cuốn theo tên (khớp URL). Chỉ published / unlisted / legacy. */
export async function getBookDetail(nameFromUrl, opts = {}) {
  try {
    const q = encodeURIComponent(String(nameFromUrl || '').trim());
    if (!q) return null;
    const authorPage = Math.max(1, Number.parseInt(String(opts.authorPage ?? '1'), 10) || 1);
    const response = await fetch(`/api/books/detail?name=${q}&authorPage=${authorPage}`);
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết sách:', err);
    return null;
  }
}
