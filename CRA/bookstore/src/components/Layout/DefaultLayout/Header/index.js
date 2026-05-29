import { getCategoryList } from '../../../../app/api/siteApi.js';
import '../../../assets/css/main.css'
import './header-theme.css'

import logo from '../../../assets/img/logo.png'
import {getCart, notifyCartRemovedFromCart} from '../../../../app/api/CartApi'
import { toast } from 'react-toastify';
import {getNotifications, markAsRead, markAllAsRead, deleteNotification} from '../../../../app/api/NotificationApi'
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useContext, useEffect, useState, useRef, useCallback } from 'react'
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  removeSearchHistoryItem,
} from '../../../../utils/searchHistory.js';
import { AuthContext } from '../../../context/auth.context'
import { ThemeContext } from '../../../context/theme.context';
import { useNavigate, Link } from 'react-router-dom';
import { formatVndDisplay } from '../../../function/function.js';
import shoppingno from '../../../assets/img/shopping.png'
import styles from '../../../../pages/Home/Home.module.scss';

function Header() {
    const navigate = useNavigate();
   const { auth, setAuth } = useContext(AuthContext);
   const { theme, setTheme } = useContext(ThemeContext);
   const [data, setData] = useState(null);
   const [notifications, setNotifications] = useState([]);
   const [unreadCount, setUnreadCount] = useState(0);
   const [categories, setCategories] = useState([]);
   const [searchKeyword, setSearchKeyword] = useState('');
   const [searchHistory, setSearchHistory] = useState([]);
   const [showSearchHistory, setShowSearchHistory] = useState(false);
   const searchWrapRef = useRef(null);

   useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSearchHistory(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

   useEffect(() => {
    async function fetchCategories() {
      try {
        const c = await getCategoryList();
        setCategories(Array.isArray(c) ? [...c].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []);
      } catch (error) {
        console.log('Lỗi fetch categories:', error);
      }
    }
    fetchCategories();
  }, []);

   useEffect(() => {
    async function fetchData(){
        try{
            const { items, removedFromCart } = await getCart(auth.user.email)
            notifyCartRemovedFromCart(removedFromCart, toast)
            setData(items)
        }
        catch(error)
        {
            console.log(error)
        }
    }
    if (auth.user?.email) {
        fetchData();
    }
  },[auth?.user?.email])
  
  useEffect(() => {
    if (auth?.user?.email) {
      fetchNotifications();
    }
  }, [auth?.user?.email]);
  
  useEffect(() => {
    const handleCartAdded = async () => {
      if (!auth?.user?.email) return;
      fetchNotifications();
      try {
        const { items, removedFromCart } = await getCart(auth.user.email);
        notifyCartRemovedFromCart(removedFromCart, toast);
        setData(items);
      } catch (e) {
        console.log(e);
      }
    };
    window.addEventListener('cart-added', handleCartAdded);
    return () => window.removeEventListener('cart-added', handleCartAdded);
  }, [auth?.user?.email]);
  
  const fetchNotifications = async () => {
    try {
        const response = await getNotifications(auth.user.email, 1, 10, 'user');
        setNotifications(response.data || []);
        setUnreadCount(response.unreadCount || 0);
    } catch (error) {
        console.log('Lỗi fetch notifications:', error);
    }
  };
  
  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
        await markAsRead(notificationId);
        fetchNotifications();
    } catch (error) {
        console.log('Lỗi mark as read:', error);
    }
  };
  
  const handleMarkAllRead = async () => {
    try {
        await markAllAsRead(auth.user.email, 'user');
        fetchNotifications();
    } catch (error) {
        console.log('Lỗi mark all read:', error);
    }
  };
  
  const handleNotificationClick = (notification, e) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id, { stopPropagation: () => {} });
    }
    if (notification.link) {
      navigate(notification.link);
    }
    // Không cần đóng dropdown vì đã dùng CSS hover
  };

  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      fetchNotifications();
    } catch (error) {
      console.log('Lỗi xóa notification:', error);
    }
  };
  
  const getNotificationIcon = (type) => {
    switch (type) {
        case 'cart': return 'fa-solid fa-cart-shopping';
        case 'order': return 'fa-solid fa-receipt';
        case 'order_status': return 'fa-solid fa-truck-fast';
        case 'payment': return 'fa-solid fa-credit-card';
        case 'review': return 'fa-solid fa-star-half-stroke';
        default: return 'fa-solid fa-bell';
    }
  };

  const getNotificationTypeClass = (type) => {
    const allowed = ['cart', 'order', 'order_status', 'payment', 'review'];
    return allowed.includes(type) ? type : 'default';
  };
  
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const goSearch = useCallback((keyword) => {
    const q = (keyword ?? searchKeyword).trim();
    if (!q) return;
    const next = addSearchHistory(q);
    setSearchHistory(next);
    setShowSearchHistory(false);
    navigate(`/search?keysearch=${encodeURIComponent(q)}`);
  }, [navigate, searchKeyword]);

  const handleSearch = (e) => {
    e.preventDefault();
    goSearch(searchKeyword);
  };

  const handleHistorySelect = (term) => {
    setSearchKeyword(term);
    goSearch(term);
  };

  const handleClearHistory = (e) => {
    e.stopPropagation();
    setSearchHistory(clearSearchHistory());
  };

  const handleRemoveHistoryItem = (e, term) => {
    e.stopPropagation();
    setSearchHistory(removeSearchHistoryItem(term));
  };
  
  if (auth.loading) {
    return <div>Đang kiểm tra đăng nhập...</div>;
  } 
  
  const isAdmin = auth.user.role === "admin";
  const isMember = !!auth?.user?.isMember;
  const memberTierName = auth?.user?.membershipTierName;
  const membershipLabel = isMember
    ? `Hội viên${memberTierName ? ` - ${memberTierName}` : ''}`
    : 'Chưa là hội viên';

    return (
      <header className="header">
        <div className="grid">
          {/* Top Row: Logo + Search + Navbar Items */}
          <div className="header__top-row">
            <div className="header__logo">
              <a href="/" className="header__logo-link">
                <img src={logo} alt="" className="header__logo-img"/>
                <h3 className="header__logo-name">BookStore</h3>
              </a>
            </div>
            
            <form className="header__search" onSubmit={handleSearch} ref={searchWrapRef}>
              <div className="header__search-input-wrap">
                <input
                  id="searchInput"
                  type="search"
                  className="header__search-input"
                  placeholder="Tìm kiếm sản phẩm..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onFocus={() => setShowSearchHistory(true)}
                  autoComplete="off"
                />
                <div
                  className={`header__search-history ${showSearchHistory ? 'header__search-history--open' : ''}`}
                  role="listbox"
                  aria-label="Lịch sử tìm kiếm"
                >
                  <div className="header__search-history-header">
                    <h4 className="header__search-history-heading">Lịch sử tìm kiếm</h4>
                    {searchHistory.length > 0 && (
                      <button
                        type="button"
                        className="header__search-history-clear"
                        onClick={handleClearHistory}
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>
                  {searchHistory.length === 0 ? (
                    <p className="header__search-history-empty">Chưa có từ khóa nào</p>
                  ) : (
                    <ul className="header__search-history-list">
                      {searchHistory.map((term) => (
                        <li key={term} className="header__search-history-item">
                          <button
                            type="button"
                            className="header__search-history-item-btn"
                            onClick={() => handleHistorySelect(term)}
                          >
                            <i className="fa-solid fa-clock-rotate-left" aria-hidden />
                            <span>{term}</span>
                          </button>
                          <button
                            type="button"
                            className="header__search-history-item-remove"
                            aria-label={`Xóa ${term}`}
                            onClick={(e) => handleRemoveHistoryItem(e, term)}
                          >
                            <i className="fa-solid fa-xmark" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button type="submit" className="header__search-btn" aria-label="Tìm kiếm">
                <i className="header__search-btn-icon fa-solid fa-magnifying-glass" aria-hidden />
              </button>
            </form>
            
            {/* Navbar items bên phải */}
            <div className="header__navbar-right">
              <ul className="header__navbar-list">
                <li className="header__navbar-item header__navbar-item--has-notify">
                  <a href="" className="header__navbar-item-link">
                    <i className="header__navbar-icon fa-solid fa-bell"></i>
                    {unreadCount > 0 && <span className="header__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                  </a>
                  <div className="header__notify">
                    <header className="header_notify-header">
                      <h3>Thông báo mới</h3>
                      {unreadCount > 0 && (
                        <button className="mark-all-read-btn" onClick={handleMarkAllRead}>Đánh dấu tất cả</button>
                      )}
                    </header>
                    <ul className="header__notify-list">
                      {notifications.length === 0 ? (
                        <li className="header__notify-item">
                          <div className="header__notify-info">
                            <span className="header__notify-name">Không có thông báo</span>
                          </div>
                        </li>
                      ) : (
                        notifications.map((notification) => (
                          <li key={notification._id} className={`header__notify-item ${!notification.isRead ? 'header__notify-item--unread' : ''}`} onClick={(e) => handleNotificationClick(notification, e)}>
                            <a href="" className="header__notify-link">
                              {notification.bookImage ? (
                                <img src={notification.bookImage} alt="" className="header__notify-img"/>
                              ) : (
                                <div className={`header__notify-icon header__notify-icon--${getNotificationTypeClass(notification.type)}`}>
                                  <i className={getNotificationIcon(notification.type)}></i>
                                </div>
                              )}
                              <div className="header__notify-info">
                                {notification.bookTitle && (
                                  <span className="header__notify-book-title">{notification.bookTitle}</span>
                                )}
                                <span className="header__notify-name">{notification.title}</span>
                                <span className="header__notify-description">{notification.message}</span>
                                <span className="header__notify-time">{formatTimeAgo(notification.createdAt)}</span>
                              </div>
                            </a>
                            <div className="header__notify-actions">
                              <button className="header__notify-delete-btn" onClick={(e) => handleDeleteNotification(notification._id, e)}>
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                    <footer className="header__notify-footer">
                      <Link to="/notifications" className="header__notify-footer-btn">Xem tất cả</Link>
                    </footer>    
                  </div>
                </li>
                
                <li className="header__navbar-item header__navbar-item--has-cart">
                  <a href="/cart" className="header__navbar-item-link">
                    <i className="header__navbar-icon fa-solid fa-cart-shopping"></i>
                    <span className="header__badge">{data ? data.length : 0}</span>
                  </a>
                  <div className="header__cart-dropdown">
                    { !data || data.length === 0 ? (
                      <div className="header__cart-empty">
                        <img src={shoppingno} className="header__cart-no-cart-img" alt=""/>
                        <span>Chưa có sản phẩm</span>
                      </div>
                    ) : (
                      <div className="header__cart-content">
                        <h4 className="header__cart-heading">Sản Phẩm Trong Giỏ</h4>
                        <ul className="header__cart-list-item">
                          {data.map((item, idx) => {
                            const bc = item.bookId && item.bookId.category;
                            const categoryName = bc && typeof bc === 'object' ? bc.name : 'Không rõ';
                            return (
                              <li key={idx} className="header__cart-item">
                                <img src={item.bookId.img} alt="" className="header__cart-img"/>
                                <div className="header__cart-item-info">
                                  <h5 className="header__cart-item-name">{item.bookId.name}</h5>
                                  <div className="header__cart-item-price-wrap">
                                    <span className="header__cart-item-price">{formatVndDisplay(item.price)}</span>
                                    <span className="header__cart-item-multiply">x</span>
                                    <span className="header__cart-item-qnt">{item.quantity}</span>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <a href="/cart" className="header__cart-view-cart">Xem giỏ hàng</a>
                      </div>
                    )}
                  </div>
                </li>
                
                <li className="header__navbar-item header__navbar-item--has-user">
                  {auth.isAuthenticated ? (
                    <div className="header__user-menu-wrap">
                      <img src={auth.user.avt} alt="" className="header__navbar-user-img"/>
                      <div className="header__navbar-user-meta">
                        <span className="header__navbar-user-name">{auth.user.name}</span>
                        <span className={`header__membership-chip ${isMember ? 'header__membership-chip--active' : ''}`}>
                          {membershipLabel}
                        </span>
                      </div>
                      <ul className="header__navbar-user-menu">
                        {isAdmin && (
                          <li><a href="/admin">Trang Quản lý</a></li>
                        )}
                        <li><a href="/profile">Tài khoản</a></li>
                        <li><a href="/profile/address">Địa chỉ</a></li>
                        <li><a href="/profile/purchase">Đơn hàng</a></li>
                        <li><a href="/statistics">Thống kê</a></li>
                        <li className="header__theme-switcher">
                          <span className="header__theme-label">Giao diện</span>
                          <div className="header__theme-options">
                            <button
                              type="button"
                              className={`header__theme-btn ${theme === 'light' ? 'header__theme-btn--active' : ''}`}
                              onClick={() => setTheme('light')}
                            >
                              Light
                            </button>
                            <button
                              type="button"
                              className={`header__theme-btn ${theme === 'dark' ? 'header__theme-btn--active' : ''}`}
                              onClick={() => setTheme('dark')}
                            >
                              Dark
                            </button>
                          </div>
                        </li>
                        <li className="header__navbar-user-item--separate">
                          <a onClick={(e) => {
                            e.preventDefault();
                            setAuth({ isAuthenticated: false, user: { email: "", name: "", role: "" } });
                            localStorage.clear("access_token");
                            navigate('/login');
                          }} href="">Đăng xuất</a>
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <div className="header__auth-btns">
                      <a href="/regis" className="header__auth-btn header__auth-btn--outline">Đăng ký</a>
                      <a href="/login" className="header__auth-btn header__auth-btn--primary">Đăng nhập</a>
                    </div>
                  )}
                </li>
              </ul>
            </div>
          </div>
          {/* Danh mục sách - sticky nav dưới header */}
          <div className={styles.homeNav}>
            <div className={styles.homeNavInner}>
              <a href="/" className={styles.homeNavLink}>
                <i className="fa-solid fa-home"></i>
                Trang chủ
              </a>
              <a href="/search" className={styles.homeNavLink}>
                <i className="fa-solid fa-book"></i>
                Tất cả sách
              </a>
              {categories.slice(0, 5).map((c) => (
                <a key={c._id} href={`/search?category=${encodeURIComponent(c.slug)}`} className={styles.homeNavLink}>
                  {c.name}
                </a>
              ))}
              <a href="/search" className={styles.homeNavLink}>
                <i className="fa-solid fa-arrow-right"></i>
                Xem thêm
              </a>
            </div>
          </div>
        </div>
      </header>
    );
}

export default Header;