/** Cấu hình bảng admin — dùng chung cho trang quản lý + /admin/Settings */

export const LS_BOOK_COLS = 'bookstore-admin:cols-manage-book';
export const BOOK_TABLE_SPEC = [
  { id: 'product', label: 'Sản phẩm', required: true, width: 'minmax(280px, 1fr)' },
  { id: 'price', label: 'Giá', width: '120px' },
  { id: 'category', label: 'Thể loại', width: '120px' },
  { id: 'listing', label: 'Hiển thị web', width: '130px' },
  { id: 'discount', label: 'Khuyến mãi', width: '100px' },
  { id: 'stock', label: 'Tồn kho', width: '88px' },
  { id: 'sold', label: 'Đã bán', width: '90px' },
  { id: 'rating', label: 'Đánh giá', width: '90px' },
  { id: 'favourite', label: 'Yêu thích', width: '70px' },
  { id: 'action', label: 'Thao tác', required: true, width: '100px' },
];

export const LS_ORDER_COLS = 'bookstore-admin:cols-manage-order';
export const ORDER_TABLE_SPEC = [
  { id: 'orderCode', label: 'Mã đơn', required: true, width: 'minmax(108px, 200px)' },
  { id: 'createdAt', label: 'Ngày tạo', width: 'minmax(112px, 140px)' },
  { id: 'products', label: 'Sản phẩm', required: true, width: 'minmax(140px, 2fr)' },
  { id: 'email', label: 'Email', width: 'minmax(130px, 180px)' },
  { id: 'address', label: 'Địa chỉ', width: 'minmax(120px, 160px)' },
  { id: 'payment', label: 'Thanh toán', width: 'minmax(96px, 120px)' },
  { id: 'total', label: 'Tổng tiền', width: 'minmax(100px, 130px)' },
  { id: 'status', label: 'Tình trạng', width: 'minmax(108px, 140px)' },
  { id: 'action', label: 'Thao tác', required: true, width: 'minmax(84px, 100px)' },
];

export const LS_USER_COLS = 'bookstore-admin:cols-manage-user';
export const USER_TABLE_SPEC = [
  { id: 'name', label: 'Tên', required: true, width: '200px' },
  { id: 'email', label: 'Email', width: '220px' },
  { id: 'phone', label: 'Điện thoại', width: '140px' },
  { id: 'orders', label: 'Đơn hàng', width: '100px' },
  { id: 'membership', label: 'Hội viên', width: 'minmax(128px, 168px)' },
  { id: 'action', label: 'Thao tác', required: true, width: '120px' },
];

export const LS_CAT_COLS = 'bookstore-admin:cols-manage-category';
export const CATEGORY_TABLE_SPEC = [
  { id: 'name', label: 'Tên danh mục', required: true, width: 'minmax(280px, 1fr)' },
  { id: 'slug', label: 'Slug', width: '160px' },
  { id: 'order', label: 'Thứ tự', width: '120px' },
  { id: 'bookCount', label: 'Số sách', width: '90px' },
  { id: 'action', label: 'Thao tác', required: true, width: '140px' },
];

export const LS_HERO_COLS = 'bookstore-admin:cols-manage-hero';
export const HERO_TABLE_SPEC = [
  { id: 'thumb', label: 'Hình / mô tả ngắn', required: true, width: 'minmax(200px, 1.2fr)' },
  { id: 'alt', label: 'Alt text (cột riêng)', width: '1fr' },
  { id: 'link', label: 'Link', width: '120px' },
  { id: 'orderCol', label: 'Thứ tự', width: '100px' },
  { id: 'status', label: 'Trạng thái', width: '100px' },
  { id: 'action', label: 'Thao tác', required: true, width: '90px' },
];

export const ADMIN_DASHBOARD_TABLES = [
  { id: 'books', label: 'Quản lý sách', path: '/admin', lsKey: LS_BOOK_COLS, spec: BOOK_TABLE_SPEC },
  { id: 'orders', label: 'Quản lý đơn hàng', path: '/admin/Orders', lsKey: LS_ORDER_COLS, spec: ORDER_TABLE_SPEC },
  { id: 'users', label: 'Quản lý người dùng', path: '/admin/Users', lsKey: LS_USER_COLS, spec: USER_TABLE_SPEC },
  { id: 'categories', label: 'Quản lý danh mục', path: '/admin/Categories', lsKey: LS_CAT_COLS, spec: CATEGORY_TABLE_SPEC },
  { id: 'hero', label: 'Hero slider', path: '/admin/HeroImages', lsKey: LS_HERO_COLS, spec: HERO_TABLE_SPEC },
];
