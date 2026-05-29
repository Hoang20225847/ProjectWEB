import axios from '../../components/axios/axios.customize';

/** audience: 'user' (mặc định, storefront) | 'admin' (chuông trang quản trị) */
export async function getNotifications(email, page = 1, limit = 20, audience = 'user') {
    try {
        const aud = audience === 'admin' ? 'admin' : 'user';
        const q = new URLSearchParams({
            email,
            page: String(page),
            limit: String(limit),
            audience: aud,
        });
        const response = await axios.get(`/api/notifications?${q.toString()}`);
        return response;
    } catch (err) {
        console.error('Lỗi khi lấy notifications:', err);
        throw err;
    }
}

export async function getUnreadCount(email, audience = 'user') {
    try {
        const aud = audience === 'admin' ? 'admin' : 'user';
        const q = new URLSearchParams({ email, audience: aud });
        const response = await axios.get(`/api/notifications/count?${q.toString()}`);
        return response.count;
    } catch (err) {
        console.error('Lỗi khi lấy số notification chưa đọc:', err);
        return 0;
    }
}

export async function markAsRead(id) {
    try {
        const response = await axios.put(`/api/notifications/${id}/read`);
        return response;
    } catch (err) {
        console.error('Lỗi khi đánh dấu notification:', err);
        throw err;
    }
}

export async function markAllAsRead(email, audience = 'user') {
    try {
        const aud = audience === 'admin' ? 'admin' : 'user';
        const response = await axios.put(`/api/notifications/read-all`, { email, audience: aud });
        return response;
    } catch (err) {
        console.error('Lỗi khi đánh dấu tất cả notification:', err);
        throw err;
    }
}

export async function deleteNotification(id) {
    try {
        const response = await axios.delete(`/api/notifications/${id}`);
        return response;
    } catch (err) {
        console.error('Lỗi khi xóa notification:', err);
        throw err;
    }
}

export async function deleteAllNotifications(email, audience = 'user') {
    try {
        const aud = audience === 'admin' ? 'admin' : 'user';
        const response = await axios.delete(`/api/notifications`, { data: { email, audience: aud } });
        return response;
    } catch (err) {
        console.error('Lỗi khi xóa tất cả notification:', err);
        throw err;
    }
}
