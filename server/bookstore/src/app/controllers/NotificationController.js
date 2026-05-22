const Notification = require('../models/Notifications');
const Order = require('../models/Orders');
const Book = require('../models/Books');
const AccountAdmin = require('../models/AccountAdmins');

/** Query Mongo cho một email + kênh user hoặc admin (bản ghi cũ không có audience = kênh user). */
function buildListQuery(email, audienceKind) {
    if (audienceKind === 'admin') {
        return { email, audience: 'admin' };
    }
    return {
        email,
        $or: [{ audience: { $exists: false } }, { audience: 'user' }],
    };
}

function parseAudienceParam(value) {
    return String(value || '').toLowerCase() === 'admin' ? 'admin' : 'user';
}

// Helper function để tạo notification (không cần req/res)
async function createNotificationHelper(
    email,
    type,
    title,
    message,
    link = null,
    orderId = null,
    bookId = null,
    bookImage = null,
    bookTitle = null,
    metadata = null,
    audience = 'user'
) {
    try {
        const audienceNorm = audience === 'admin' ? 'admin' : 'user';
        const notification = new Notification({
            email,
            type,
            title,
            message,
            link,
            orderId,
            bookId,
            bookImage,
            bookTitle,
            metadata,
            audience: audienceNorm,
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.log('Lỗi tạo notification helper:', error);
        return null;
    }
}

/** Gửi cùng một thông báo tới tất cả email admin (quản trị). */
async function notifyAllAdmins({ type, title, message, link = null, orderId = null, bookId = null, bookImage = null, bookTitle = null, metadata = null }) {
    try {
        const admins = await AccountAdmin.find({}).select('email').lean();
        const emails = [...new Set((admins || []).map((a) => a.email).filter(Boolean))];
        if (!emails.length) {
            console.log('notifyAllAdmins: chưa có tài khoản admin trong DB');
            return;
        }
        await Promise.all(
            emails.map((email) =>
                createNotificationHelper(
                    email,
                    type,
                    title,
                    message,
                    link,
                    orderId,
                    bookId,
                    bookImage,
                    bookTitle,
                    metadata,
                    'admin'
                )
            )
        );
    } catch (error) {
        console.log('notifyAllAdmins lỗi:', error);
    }
}

class NotificationController {

    async create(req, res, next) {
        try {
            const { email, type, title, message, link, orderId, bookId, bookImage, bookTitle, metadata, audience } = req.body;
            const aud = parseAudienceParam(audience);
            const notification = await createNotificationHelper(
                email,
                type,
                title,
                message,
                link,
                orderId,
                bookId,
                bookImage,
                bookTitle,
                metadata,
                aud
            );
            
            return res.status(200).json({
                success: true,
                data: notification
            });
        } catch (error) {
            console.log('Lỗi tạo notification:', error);
            return res.status(400).json({
                success: false,
                message: 'Tạo notification thất bại'
            });
        }
    }

    async getByEmail(req, res, next) {
        try {
            const { email } = req.query;
            const { limit = 20, page = 1 } = req.query;
            const audienceKind = parseAudienceParam(req.query.audience);
            const q = buildListQuery(email, audienceKind);

            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const notifications = await Notification.find(q)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));
            
            const total = await Notification.countDocuments(q);
            const unreadCount = await Notification.countDocuments({ ...q, isRead: false });
            
            return res.status(200).json({
                success: true,
                data: notifications,
                total,
                unreadCount,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.log('Lỗi lấy notifications:', error);
            return res.status(400).json({
                success: false,
                message: 'Lấy notifications thất bại'
            });
        }
    }

    async getUnreadCount(req, res, next) {
        try {
            const { email } = req.query;
            const audienceKind = parseAudienceParam(req.query.audience);
            const q = buildListQuery(email, audienceKind);

            const count = await Notification.countDocuments({ ...q, isRead: false });
            
            return res.status(200).json({
                success: true,
                count
            });
        } catch (error) {
            console.log('Lỗi lấy số notification chưa đọc:', error);
            return res.status(400).json({
                success: false,
                message: 'Lấy số notification thất bại'
            });
        }
    }

    async markAsRead(req, res, next) {
        try {
            const { id } = req.params;
            
            const notification = await Notification.findByIdAndUpdate(
                id,
                { isRead: true },
                { new: true }
            );
            
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification không tồn tại'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: notification
            });
        } catch (error) {
            console.log('Lỗi đánh dấu notification:', error);
            return res.status(400).json({
                success: false,
                message: 'Cập nhật notification thất bại'
            });
        }
    }

    async markAllAsRead(req, res, next) {
        try {
            const { email, audience } = req.body;
            const audienceKind = parseAudienceParam(audience);
            const q = buildListQuery(email, audienceKind);

            await Notification.updateMany(
                { ...q, isRead: false },
                { isRead: true }
            );
            
            return res.status(200).json({
                success: true,
                message: 'Đã đánh dấu tất cả là đã đọc'
            });
        } catch (error) {
            console.log('Lỗi đánh dấu tất cả notification:', error);
            return res.status(400).json({
                success: false,
                message: 'Cập nhật thất bại'
            });
        }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            
            const notification = await Notification.findByIdAndDelete(id);
            
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification không tồn tại'
                });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Xóa notification thành công'
            });
        } catch (error) {
            console.log('Lỗi xóa notification:', error);
            return res.status(400).json({
                success: false,
                message: 'Xóa notification thất bại'
            });
        }
    }

    async deleteAll(req, res, next) {
        try {
            const q =
              req.notificationDeleteQuery ||
              buildListQuery(
                req.user?.email || req.body?.email,
                parseAudienceParam(req.body?.audience),
              );

            await Notification.deleteMany(q);
            
            return res.status(200).json({
                success: true,
                message: 'Xóa tất cả notification thành công'
            });
        } catch (error) {
            console.log('Lỗi xóa tất cả notification:', error);
            return res.status(400).json({
                success: false,
                message: 'Xóa tất cả notification thất bại'
            });
        }
    }
}

// Export instance và helper function
const notificationController = new NotificationController();
module.exports = notificationController;
module.exports.createNotificationHelper = createNotificationHelper;
module.exports.notifyAllAdmins = notifyAllAdmins;
module.exports.buildListQuery = buildListQuery;
module.exports.parseAudienceParam = parseAudienceParam;