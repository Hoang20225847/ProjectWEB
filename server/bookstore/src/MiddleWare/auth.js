const jwt = require('jsonwebtoken');

const JWT_SECRET = 'ce86b645-b01e-4681-a77c-00ca11579502';

function tryAttachUser(req) {
  req.user = null;
  if (!req.headers || !req.headers.authorization) return;
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded._id,
      email: decoded.email,
      name: decoded.name,
      avt: decoded.avt,
      role: decoded.role,
      isMember: decoded.isMember || false,
      membershipTierSlug: decoded.membershipTierSlug || '',
      loyaltyPoints: decoded.loyaltyPoints ?? 0,
    };
  } catch (e) {
    req.user = null;
  }
}

const auth = (req, res, next) => {
  tryAttachUser(req);

  const white_list = [
    '/regis',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/api/address',
    '/admin/login',
    '/uploads',
    '/payapi/check-payment-vnpay',
    '/api/review',
  ];

  const isPublicGetCategories = req.path === '/api/categories' && req.method === 'GET';
  const isPublicGetHeroImages = req.path === '/api/hero-images' && req.method === 'GET';
  const isPublicBookRead =
    req.method === 'GET' &&
    (req.path === '/api/books' ||
      req.path === '/api/books/filter' ||
      req.path === '/api/books/search' ||
      req.path === '/api/books/detail');
  const isPublicFlashSaleRead =
    req.method === 'GET' &&
    (req.path === '/api/flash-sales/live' ||
      req.path === '/api/flash-sales/upcoming' ||
      req.path === '/api/flash-sales/for-books');

  // Chatbot user endpoints chấp nhận khách (req.user có thể null).
  // Admin endpoints (/api/chatbot/admin/*) tự enforce role='admin' trong controller.
  const isChatbotPath = req.path.startsWith('/api/chatbot');

  if (
    isPublicGetCategories ||
    isPublicGetHeroImages ||
    isPublicBookRead ||
    isPublicFlashSaleRead ||
    isChatbotPath ||
    white_list.includes(req.path) ||
    req.originalUrl.startsWith('/uploads')
  ) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      message: 'Ban chua truyen Access_Token',
    });
  }

  return next();
};

/** Bắt buộc đã đăng nhập (dùng trên route nhạy cảm — bổ sung cho middleware auth toàn cục). */
function verifyToken(req, res, next) {
  tryAttachUser(req);
  if (!req.user) {
    return res.status(401).json({
      message: 'Bạn chưa đăng nhập hoặc token không hợp lệ',
    });
  }
  return next();
}

function isAdmin(req) {
  return req?.user?.role === 'admin';
}

module.exports = auth;
module.exports.verifyToken = verifyToken;
module.exports.tryAttachUser = tryAttachUser;
module.exports.isAdmin = isAdmin;
