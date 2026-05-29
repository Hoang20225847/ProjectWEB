const express = require ('express');
const router =express.Router();
const upload =require('../MiddleWare/upload')
const uploadBookCover = require('../MiddleWare/uploadBookCover')
const SiteController =require('../app/controllers/SiteController')
const CartController =require('../app/controllers/CartController')
const OrderController =require('../app/controllers/OrderController');
const UserController = require('../app/controllers/UserController');
const ReviewController =require('../app/controllers/ReviewController');
const CategoryController =require('../app/controllers/CategoryController')
const NotificationController = require('../app/controllers/NotificationController');
const HeroImageController = require('../app/controllers/HeroImageController');
const StatisticsController = require('../app/controllers/StatisticsController');
const InventoryController = require('../app/controllers/InventoryController');
const SeriesController = require('../app/controllers/SeriesController');
const AuthorController = require('../app/controllers/AuthorController');
const MembershipController = require('../app/controllers/MembershipController');
const FlashSaleController = require('../app/controllers/FlashSaleController');
const PublisherController = require('../app/controllers/PublisherController');
const SupplierController = require('../app/controllers/SupplierController');
const { verifyToken } = require('../MiddleWare/auth');
const {
  requireAddressOwner,
  requireAccountDeleteAccess,
  requireOrderDeleteAccess,
  requireNotificationOwner,
  requireNotificationDeleteAllAccess,
} = require('../MiddleWare/accessControl');

router.get('/categories',CategoryController.list)
router.post('/categories',CategoryController.create)
router.put('/categories/:id',CategoryController.update)
router.delete('/categories/:id',CategoryController.remove)
router.post('/categories/repair-books', CategoryController.repairBooks)

router.get('/books/detail', SiteController.getBookPublicDetail);
router.get('/books/search',SiteController.getBookSearch)
router.get('/books/filter',SiteController.filterBooks)
router.get('/books', SiteController.show);
router.get('/series', SeriesController.list);
router.post('/series', SeriesController.create);
router.put('/series/:id', SeriesController.update);
router.delete('/series/:id', SeriesController.remove);
router.put('/series/:id/members', SeriesController.setMembers);
router.get('/series/:id/books', SeriesController.booksInSeries);
router.get('/authors', AuthorController.list);
router.post('/authors', AuthorController.create);
router.put('/authors/:id', AuthorController.update);
router.delete('/authors/:id', AuthorController.remove);
router.put('/authors/:id/members', AuthorController.setMembers);
router.get('/authors/:id/books', AuthorController.booksByAuthor);
router.delete(`/books/:id`,SiteController.removeBook)
router.post('/books/upload-cover', (req, res, next) => {
  uploadBookCover.single('cover')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload ảnh thất bại' });
    }
    return SiteController.uploadBookCover(req, res);
  });
})
router.post('/books',SiteController.createBook)
router.put('/books',SiteController.updateBook)
router.get('/account/search',SiteController.getAccountSearch);
router.get('/account',SiteController.getAccount);
router.get('/account/my',SiteController.getMyAccount);
router.post('/account/upload-avt',upload.single('avatar'),UserController.uploadAvt)
router.post('/account',SiteController.changeInfo);
router.put('/account',UserController.updateAccount);
router.post('/address',SiteController.createAddress)
router.get('/address',SiteController.getAddress);
router.put('/address/:id',SiteController.setAddressDefault);
router.delete(
  '/address/:id',
  verifyToken,
  requireAddressOwner,
  SiteController.deleteAddress,
);
router.post('/cart',CartController.create)
router.get('/cart',CartController.getCart)
router.put('/cart/update',CartController.updateCart)
router.put('/cart',CartController.removeItemCart)
router.get('/order/search',OrderController.getOrderSearch)
router.post('/order',OrderController.create)
router.put('/order/:id',OrderController.reviewOrder)
router.put('/order',OrderController.updateOrder)
router.put('/orders/:id',OrderController.statusOrder)
router.post('/orders/repair-book-refs', OrderController.repairBookRefs)
router.get('/order',OrderController.getOrder)
router.get('/listorder',OrderController.getListOrder)
router.post('/review',ReviewController.create)
router.get('/review',ReviewController.getReviewBook)
router.get('/reviews/user/:email',ReviewController.getReviewsByUser)
router.put('/account/membership', UserController.updateMembership);
router.post('/membership/quote', MembershipController.quote);
router.get('/membership/my-vouchers', MembershipController.myVouchers);
router.get('/membership/admin/tiers', MembershipController.adminListTiers);
router.get('/membership/admin/tier-account-stats', MembershipController.adminTierAccountStats);
router.put('/membership/admin/tiers/:id', MembershipController.adminUpdateTier);
router.get('/membership/admin/benefits', MembershipController.adminListBenefits);
router.post('/membership/admin/benefits', MembershipController.adminCreateBenefit);
router.put('/membership/admin/benefits/:id', MembershipController.adminUpdateBenefit);
router.get('/membership/admin/vouchers', MembershipController.adminListVouchers);
router.post('/membership/admin/vouchers', MembershipController.adminCreateVoucher);
router.put('/membership/admin/vouchers/:id', MembershipController.adminUpdateVoucher);
router.get('/membership/admin/logs', MembershipController.adminListLogs);
router.get('/membership/admin/points', MembershipController.adminListPoints);
router.delete(
  '/account/:id',
  verifyToken,
  requireAccountDeleteAccess,
  SiteController.removeAccount,
);
router.delete(
  '/orders/:id',
  verifyToken,
  requireOrderDeleteAccess,
  OrderController.removeOrder,
);

// Publisher / Supplier routes (admin)
router.get('/suppliers', SupplierController.list);
router.post('/suppliers', SupplierController.create);
router.put('/suppliers/:id', SupplierController.update);
router.delete('/suppliers/:id', SupplierController.remove);
router.get('/publishers', PublisherController.list);
router.post('/publishers', PublisherController.create);
router.put('/publishers/:id', PublisherController.update);
router.delete('/publishers/:id', PublisherController.remove);

// Notification routes
router.get('/notifications', NotificationController.getByEmail)
router.get('/notifications/count', NotificationController.getUnreadCount)
router.put('/notifications/:id/read', NotificationController.markAsRead)
router.put('/notifications/read-all', NotificationController.markAllAsRead)
router.delete(
  '/notifications/:id',
  verifyToken,
  requireNotificationOwner,
  NotificationController.delete,
);
router.delete(
  '/notifications',
  verifyToken,
  requireNotificationDeleteAllAccess,
  NotificationController.deleteAll,
);

// Hero Image Slider routes
router.get('/hero-images', HeroImageController.list)
router.get('/hero-images/all', HeroImageController.listAll)
router.get('/hero-images/:id', HeroImageController.getOne)
router.post('/hero-images', upload.single('image'), HeroImageController.create)
router.put('/hero-images/:id', upload.single('image'), HeroImageController.update)
router.delete('/hero-images/:id', HeroImageController.remove)
router.put('/hero-images/reorder', HeroImageController.reorder)

// Statistics routes
router.get('/statistics/user-dashboard', StatisticsController.getUserDashboard);
router.get('/statistics/monthly-orders', StatisticsController.getMonthlyOrders);
router.get('/statistics/category-spending', StatisticsController.getCategorySpending);
router.get('/statistics/top-books', StatisticsController.getTopBooks);
router.get('/statistics/revenue-by-period', StatisticsController.getRevenueByPeriod);
router.get('/statistics/revenue-by-channel', StatisticsController.getRevenueByChannel);
router.get('/statistics/financial-summary', StatisticsController.getFinancialSummary);
router.get('/statistics/period-compare', StatisticsController.getPeriodCompare);
router.get('/statistics/orders-by-status', StatisticsController.getOrdersByStatus);
router.get('/statistics/orders-by-payment', StatisticsController.getOrdersByPayment);

// Flash sale routes
router.get('/flash-sales/admin', FlashSaleController.adminList);
router.post('/flash-sales/admin', FlashSaleController.adminCreate);
router.put('/flash-sales/admin/:id', FlashSaleController.adminUpdate);
router.delete('/flash-sales/admin/:id', FlashSaleController.adminRemove);
router.get('/flash-sales/live', FlashSaleController.publicLive);
router.get('/flash-sales/upcoming', FlashSaleController.publicUpcoming);
router.get('/flash-sales/for-books', FlashSaleController.publicForBooks);

// Kho hàng (admin-only trong controller)
router.get('/inventory/dashboard', InventoryController.dashboard);
router.get('/inventory/by-book', InventoryController.listByBook);
router.get('/inventory/alerts', InventoryController.alerts);
router.get('/inventory/movements', InventoryController.movements);
router.get('/inventory/value-summary', InventoryController.valueSummary);
router.get('/inventory/slow-movers', InventoryController.slowMovers);
router.post('/inventory/stock-import', InventoryController.stockImport);
router.post('/inventory/stock-import/reverse', InventoryController.reverseStockImport);
router.post('/inventory/stock-return', InventoryController.stockReturn);
router.post('/inventory/stock-adjust', InventoryController.stockAdjust);

module.exports=router