import styles from '../Admin.module.scss'
import classNames from 'classnames/bind'
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
const cx = classNames.bind(styles);

const navItems = [
  { to: '/admin', icon: 'fa-solid fa-book-open', label: 'Quản Lý Sách', end: true },
  { to: '/admin/Users', icon: 'fa-solid fa-users', label: 'Quản Lý Người Dùng' },
  { to: '/admin/Membership', icon: 'fa-solid fa-crown', label: 'Hội viên' },
  { to: '/admin/Vouchers', icon: 'fa-solid fa-ticket', label: 'Voucher' },
  { to: '/admin/Publishers', icon: 'fa-solid fa-building', label: 'Nhà xuất bản' },
  { to: '/admin/Suppliers', icon: 'fa-solid fa-truck', label: 'Nhà cung cấp' },
  { to: '/admin/FlashSale', icon: 'fa-solid fa-bolt', label: 'Flash Sale' },
  { to: '/admin/Orders', icon: 'fa-solid fa-receipt', label: 'Quản Lý Đơn Hàng' },
  { to: '/admin/Statistics', icon: 'fa-solid fa-chart-line', label: 'Thống kê' },
  { to: '/admin/Chatbot', icon: 'fa-solid fa-robot', label: 'Chatbot' },
  { to: '/admin/Inventory', icon: 'fa-solid fa-warehouse', label: 'Kho hàng & Nhập hàng' },
  { to: '/admin/Categories', icon: 'fa-solid fa-tags', label: 'Quản Lý Danh Mục' },
  { to: '/admin/Series', icon: 'fa-solid fa-layer-group', label: 'Bộ sách (Series)' },
  { to: '/admin/Authors', icon: 'fa-solid fa-pen-nib', label: 'Tác giả' },
  { to: '/admin/HeroImages', icon: 'fa-solid fa-images', label: 'Hero Slider' },
  { to: '/admin/Settings', icon: 'fa-solid fa-gear', label: 'Cài đặt' },
];

function Sidebar() {
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const idx = navItems.findIndex((item) => {
      if (item.end) return location.pathname === item.to;
      return location.pathname.startsWith(item.to);
    });
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [location.pathname]);

  return (
    <div className={`${cx('sidebar')} grid__column-2`}>
      <Link to="/" className={cx('sidebar-brand')}>
        <div className={cx('sidebar-brand-icon')}>
          <i className="fa-solid fa-book-open" />
        </div>
        <span className={cx('sidebar-brand-text')}>BookStore</span>
      </Link>

      <nav className={cx('sidebar-content')}>
        <div className={cx('sidebar-section-label')}>Menu</div>
        <ul className={cx('category-list')}>
          {navItems.map((item, idx) => (
            <Link
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setActiveIndex(idx)}
              className={cx(
                'category-item',
                activeIndex === idx ? 'category-item--primary' : ''
              )}
            >
              <i className={item.icon} />
              <span className={cx('category-title')}>{item.label}</span>
            </Link>
          ))}
        </ul>
      </nav>

      <div className={cx('sidebar-footer')}>
        <Link
          to="/"
          className={cx('category-item')}
          title="Quay về trang chủ"
        >
          <i className="fa-solid fa-house" />
          <span className={cx('category-title')}>Về Trang Chủ</span>
        </Link>
      </div>
    </div>
  );
}

export default Sidebar;
