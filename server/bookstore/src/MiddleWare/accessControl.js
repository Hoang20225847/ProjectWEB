const mongoose = require('mongoose');
const { isAdmin } = require('./auth');
const Address = require('../app/models/Address');
const Order = require('../app/models/Orders');
const Notification = require('../app/models/Notifications');
const {
  buildListQuery,
  parseAudienceParam,
} = require('../app/controllers/NotificationController');

function normalizeEmail(v) {
  return String(v || '').toLowerCase().trim();
}

function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Chỉ user sở hữu địa chỉ hoặc admin được xóa. */
const requireAddressOwner = wrapAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ message: 'addressId không hợp lệ' });
  }
  if (isAdmin(req)) return next();

  const addr = await Address.findById(id).select('email').lean();
  if (!addr) {
    return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
  }
  if (normalizeEmail(addr.email) !== normalizeEmail(req.user.email)) {
    return res.status(403).json({ message: 'Không có quyền xóa địa chỉ của người khác' });
  }
  return next();
});

/**
 * Xóa tài khoản: user chỉ được xóa chính mình; admin được xóa user khác (không phải admin — kiểm tra trong controller).
 */
const requireAccountDeleteAccess = wrapAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
  }
  if (isAdmin(req)) return next();

  if (String(req.user.id) !== String(id)) {
    return res.status(403).json({ message: 'Chỉ được xóa tài khoản của chính bạn' });
  }
  return next();
});

/**
 * Xóa đơn: admin xóa mọi đơn (theo rule trong controller);
 * user chỉ xóa đơn của mình và chỉ khi trạng thái "Đã hủy".
 */
const requireOrderDeleteAccess = wrapAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ message: 'orderId không hợp lệ' });
  }

  const order = await Order.findById(id).select('email status').lean();
  if (!order) {
    return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
  }

  if (isAdmin(req)) {
    req.orderForDelete = order;
    return next();
  }

  if (normalizeEmail(order.email) !== normalizeEmail(req.user.email)) {
    return res.status(403).json({ message: 'Không có quyền xóa đơn hàng của người khác' });
  }
  if (order.status !== 'Đã hủy') {
    return res.status(403).json({
      message: 'Chỉ được xóa đơn của bạn khi đơn đã ở trạng thái "Đã hủy"',
      currentStatus: order.status,
    });
  }

  req.orderForDelete = order;
  return next();
});

/** Xóa một notification: đúng email + đúng audience (admin channel chỉ admin). */
const requireNotificationOwner = wrapAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ message: 'notificationId không hợp lệ' });
  }

  const doc = await Notification.findById(id).select('email audience').lean();
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Notification không tồn tại' });
  }

  const aud = doc.audience === 'admin' ? 'admin' : 'user';

  if (aud === 'admin') {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Thông báo quản trị chỉ admin được xóa' });
    }
    if (normalizeEmail(doc.email) !== normalizeEmail(req.user.email)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa thông báo admin của người khác' });
    }
    return next();
  }

  if (!isAdmin(req) && normalizeEmail(doc.email) !== normalizeEmail(req.user.email)) {
    return res.status(403).json({ success: false, message: 'Không có quyền xóa thông báo của người khác' });
  }

  return next();
});

/**
 * Xóa hàng loạt notification: user chỉ xóa inbox của mình;
 * admin có thể xóa inbox user khác (body.email) hoặc inbox admin (audience=admin).
 */
const requireNotificationDeleteAllAccess = wrapAsync(async (req, res, next) => {
  const audienceKind = parseAudienceParam(req.body?.audience ?? req.query?.audience);

  if (isAdmin(req)) {
    if (audienceKind === 'admin') {
      req.notificationDeleteQuery = buildListQuery(req.user.email, 'admin');
    } else {
      const targetEmail = normalizeEmail(
        req.body?.email ?? req.query?.email ?? req.user.email,
      );
      if (!targetEmail) {
        return res.status(400).json({ success: false, message: 'Thiếu email' });
      }
      req.notificationDeleteQuery = buildListQuery(targetEmail, 'user');
    }
    return next();
  }

  req.notificationDeleteQuery = buildListQuery(req.user.email, 'user');
  return next();
});

module.exports = {
  requireAddressOwner,
  requireAccountDeleteAccess,
  requireOrderDeleteAccess,
  requireNotificationOwner,
  requireNotificationDeleteAllAccess,
};
