import axios from '../../components/axios/axios.customize';

/** Admin: lấy toàn bộ flash sale */
export async function adminListFlashSales() {
  try {
    const data = await axios.get('/api/flash-sales/admin');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Lỗi lấy flash sale (admin):', err);
    return [];
  }
}

/** Admin: tạo flash sale mới */
export async function adminCreateFlashSale(payload) {
  return await axios.post('/api/flash-sales/admin', payload);
}

/** Admin: cập nhật flash sale */
export async function adminUpdateFlashSale(id, payload) {
  return await axios.put(`/api/flash-sales/admin/${id}`, payload);
}

/** Admin: xóa flash sale */
export async function adminDeleteFlashSale(id) {
  return await axios.delete(`/api/flash-sales/admin/${id}`);
}

/** User: flash sale đang chạy (kèm danh sách sách) */
export async function getLiveFlashSales() {
  try {
    const data = await axios.get('/api/flash-sales/live');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Lỗi lấy flash sale đang chạy:', err);
    return [];
  }
}

/** User: flash sale sắp diễn ra trong N giờ tới */
export async function getUpcomingFlashSales(hours = 7) {
  try {
    const data = await axios.get(`/api/flash-sales/upcoming?hours=${hours}`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Lỗi lấy flash sale sắp tới:', err);
    return [];
  }
}

/** User: thông tin flash sale (live/upcoming) cho danh sách bookId */
export async function getFlashSalesForBooks(bookIds = [], hours = 7) {
  try {
    const ids = (Array.isArray(bookIds) ? bookIds : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    if (ids.length === 0) return { live: {}, upcoming: {} };
    const qs = new URLSearchParams({ ids: ids.join(','), hours: String(hours) });
    const data = await axios.get(`/api/flash-sales/for-books?${qs.toString()}`);
    return data && typeof data === 'object' ? data : { live: {}, upcoming: {} };
  } catch (err) {
    console.error('Lỗi lấy flash sale theo sách:', err);
    return { live: {}, upcoming: {} };
  }
}
