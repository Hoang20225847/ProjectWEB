import styles from '../Admin.module.scss';
import classNames from 'classnames/bind';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../../context/auth.context';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAsRead } from '../../../../app/api/NotificationApi.js';

const cx = classNames.bind(styles);

function formatNotifTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return 'Vừa xong';
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function notifIconClass(type) {
  switch (type) {
    case 'order':
      return 'fa-solid fa-box';
    case 'order_status':
      return 'fa-solid fa-truck-fast';
    case 'review':
      return 'fa-solid fa-star';
    case 'cart':
      return 'fa-solid fa-cart-shopping';
    case 'payment':
      return 'fa-solid fa-credit-card';
    default:
      return 'fa-solid fa-bell';
  }
}

function Header() {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);
  const [showNotify, setShowNotify] = useState(false);
  const [notifList, setNotifList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifyWrapRef = useRef(null);

  const fetchAdminNotifications = useCallback(async () => {
    const email = auth?.user?.email;
    if (!email) return;
    setNotifLoading(true);
    try {
      const res = await getNotifications(email, 1, 15, 'admin');
      const list = Array.isArray(res?.data) ? res.data : [];
      setNotifList(list);
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      } else {
        setUnreadCount(list.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Admin notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [auth?.user?.email]);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated || !auth?.user?.email) return;
    fetchAdminNotifications();
  }, [auth.loading, auth.isAuthenticated, auth?.user?.email, fetchAdminNotifications]);

  useEffect(() => {
    if (!showNotify) return undefined;
    const onDocDown = (e) => {
      if (notifyWrapRef.current && !notifyWrapRef.current.contains(e.target)) {
        setShowNotify(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [showNotify]);

  if (auth.loading) {
    return (
      <header className={cx('header')}>
        <nav className={cx('header-navbar')}>
          <div className={cx('header-logo-name')}>Đang kiểm tra đăng nhập...</div>
        </nav>
      </header>
    );
  }

  const handleLogout = (e) => {
    e.preventDefault();
    setAuth({
      isAuthenticated: false,
      user: { email: '', name: '', role: '' },
    });
    localStorage.clear('access_token');
    navigate('/admin/login');
  };

  const toggleNotifyPanel = (e) => {
    e.stopPropagation();
    setShowNotify((v) => {
      if (!v) fetchAdminNotifications();
      return !v;
    });
  };

  const handleNotifClick = async (n) => {
    try {
      if (!n.isRead && n._id) await markAsRead(n._id);
    } catch (err) {
      console.error(err);
    }
    await fetchAdminNotifications();
    setShowNotify(false);
    if (n.link) navigate(n.link);
  };

  return (
    <header className={cx('header')}>
      <nav className={cx('header-navbar')}>
        <div className={cx('header-logo-name')}>
          <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f1f5f9' }}>
            Trang Quản Trị
          </span>
        </div>

        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0,
            padding: 0,
          }}
        >
          {/* Notification */}
          <li ref={notifyWrapRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={toggleNotifyPanel}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '10px',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '1.5rem',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              title="Thông báo"
              aria-expanded={showNotify}
            >
              <i className="fa-solid fa-bell" />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 16,
                    height: 16,
                    background: '#ef4444',
                    borderRadius: '50%',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #0f172a',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotify && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  right: 0,
                  width: 360,
                  background: '#1e293b',
                  borderRadius: '14px',
                  border: '1px solid rgba(148,163,184,0.15)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                  zIndex: 200,
                  overflow: 'hidden',
                  animation: 'fadeInDown 0.2s ease',
                }}
              >
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(148,163,184,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>
                    Thông báo
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: '1.1rem',
                        color: '#2dd4bf',
                        fontWeight: 600,
                      }}
                    >
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                {notifLoading && (
                  <div style={{ padding: '16px 18px', color: '#94a3b8', fontSize: '1.3rem' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
                    Đang tải…
                  </div>
                )}
                {!notifLoading && notifList.length === 0 && (
                  <div style={{ padding: '20px 18px', color: '#94a3b8', fontSize: '1.3rem', textAlign: 'center' }}>
                    Chưa có thông báo
                  </div>
                )}
                {!notifLoading &&
                  notifList.map((n) => (
                    <div
                      key={n._id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotifClick(n);
                        }
                      }}
                      style={{
                        padding: '12px 18px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        background: !n.isRead ? 'rgba(45,212,191,0.04)' : 'transparent',
                        borderBottom: '1px solid rgba(148,163,184,0.06)',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(45,212,191,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = !n.isRead ? 'rgba(45,212,191,0.04)' : 'transparent';
                      }}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          background: !n.isRead ? 'rgba(45,212,191,0.15)' : 'rgba(100,116,139,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '1.3rem',
                          color: !n.isRead ? '#2dd4bf' : '#64748b',
                        }}
                      >
                        <i className={notifIconClass(n.type)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '1.35rem',
                            color: '#f1f5f9',
                            lineHeight: 1.35,
                            fontWeight: !n.isRead ? 600 : 500,
                          }}
                        >
                          {n.title}
                        </div>
                        {n.message && (
                          <div
                            style={{
                              fontSize: '1.25rem',
                              color: '#94a3b8',
                              lineHeight: 1.4,
                              marginTop: 4,
                            }}
                          >
                            {n.message}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: '1.1rem',
                            color: '#64748b',
                            marginTop: 4,
                          }}
                        >
                          {formatNotifTime(n.createdAt)}
                        </div>
                      </div>
                      {!n.isRead && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#2dd4bf',
                            flexShrink: 0,
                            marginTop: 4,
                          }}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}
          </li>

          {/* Divider */}
          <li
            style={{
              width: 1,
              height: 24,
              background: 'rgba(148,163,184,0.15)',
              margin: '0 4px',
            }}
          />

          {/* User */}
          {auth.isAuthenticated && (
            <li
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px 4px 4px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(148,163,184,0.1)',
              }}
            >
              {auth.user.avt ? (
                <img
                  src={auth.user.avt}
                  alt={auth.user.name}
                  className={cx('user-avt')}
                  style={{ width: 32, height: 32 }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '1.3rem',
                  }}
                >
                  {auth.user.name ? auth.user.name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '1.3rem',
                    fontWeight: 600,
                    color: '#f1f5f9',
                    lineHeight: 1.2,
                  }}
                >
                  {auth.user.name || 'Admin'}
                </span>
                <span
                  style={{
                    fontSize: '1.1rem',
                    color: '#2dd4bf',
                    fontWeight: 500,
                    lineHeight: 1.2,
                  }}
                >
                  {auth.user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                </span>
              </div>
            </li>
          )}

          {/* Logout */}
          <li>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: '1.4rem',
                transition: 'all 0.2s ease',
              }}
              title="Đăng xuất"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </li>
        </ul>
      </nav>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </header>
  );
}

export default Header;
