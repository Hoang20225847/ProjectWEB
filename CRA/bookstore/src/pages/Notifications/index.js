import { useContext, useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import styles from './Notifications.module.scss';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } from '../../app/api/NotificationApi';
import { AuthContext } from '../../components/context/auth.context';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const cx = classNames.bind(styles);

function Notifications() {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        // Chờ App.js fetchAccount hoàn tất trước khi quyết định gọi API hay điều hướng,
        // tránh trường hợp reload trang khiến email rỗng và bị đẩy sang /login.
        if (auth?.loading) return;
        if (!auth?.isAuthenticated || !auth?.user?.email) {
            // PrivateRoute đã đảm nhiệm chuyển hướng, ở đây chỉ là phòng hờ.
            return;
        }
        fetchNotifications();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth?.loading, auth?.isAuthenticated, auth?.user?.email, currentPage, filter]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await getNotifications(auth.user.email, currentPage, 20, 'user');
            let data = response.data || [];
            
            if (filter === 'unread') {
                data = data.filter(item => !item.isRead);
            } else if (filter === 'cart') {
                data = data.filter(item => item.type === 'cart');
            } else if (filter === 'order') {
                data = data.filter(item => item.type === 'order' || item.type === 'order_status' || item.type === 'review');
            }
            
            setNotifications(data);
            setTotalPages(response.totalPages || 1);
        } catch (error) {
            console.log('Lỗi fetch notifications:', error);
            toast.error('Không thể tải thông báo');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await markAsRead(id);
            toast.success('Đã đánh dấu là đã đọc');
            fetchNotifications();
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead(auth.user.email, 'user');
            toast.success('Đã đánh dấu tất cả là đã đọc');
            fetchNotifications();
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteNotification(id);
            toast.success('Đã xóa thông báo');
            fetchNotifications();
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleDeleteAll = async () => {
        if (window.confirm('Bạn có chắc muốn xóa tất cả thông báo?')) {
            try {
                await deleteAllNotifications(auth.user.email, 'user');
                toast.success('Đã xóa tất cả thông báo');
                fetchNotifications();
            } catch (error) {
                toast.error('Có lỗi xảy ra');
            }
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification._id);
        }
        if (notification.link) {
            navigate(notification.link);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'cart':
                return 'fa-solid fa-cart-shopping';
            case 'order':
                return 'fa-solid fa-receipt';
            case 'order_status':
                return 'fa-solid fa-truck-fast';
            case 'payment':
                return 'fa-solid fa-credit-card';
            case 'review':
                return 'fa-solid fa-star-half-stroke';
            default:
                return 'fa-solid fa-bell';
        }
    };

    const getNotificationTypeClass = (type) => {
        const allowed = ['cart', 'order', 'order_status', 'payment', 'review'];
        return allowed.includes(type) ? type : 'default';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Vừa xong';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
        return formatDate(dateString);
    };

    const unreadCount = notifications.filter(item => !item.isRead).length;

    return (
        <div className={cx('container')}>
            <div className="grid">
                <div className={cx('notifications-page')}>
                    <div className={cx('page-header')}>
                        <h1 className={cx('page-title')}>Thông Báo</h1>
                        <div className={cx('header-actions')}>
                            {unreadCount > 0 && (
                                <button className={cx('action-btn')} onClick={handleMarkAllRead}>
                                    <i className="fa-solid fa-check-double"></i> Đánh dấu tất cả đã đọc
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button className={cx('action-btn', 'delete-btn')} onClick={handleDeleteAll}>
                                    <i className="fa-solid fa-trash"></i> Xóa tất cả
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={cx('filter-tabs')}>
                        <button 
                            className={`${cx('filter-tab')} ${filter === 'all' ? cx('active') : ''}`}
                            onClick={() => { setFilter('all'); setCurrentPage(1); }}
                        >
                            Tất cả
                        </button>
                        <button 
                            className={`${cx('filter-tab')} ${filter === 'unread' ? cx('active') : ''}`}
                            onClick={() => { setFilter('unread'); setCurrentPage(1); }}
                        >
                            <i className="fa-regular fa-bell"></i> Chưa đọc
                        </button>
                        <button 
                            className={`${cx('filter-tab')} ${filter === 'order' ? cx('active') : ''}`}
                            onClick={() => { setFilter('order'); setCurrentPage(1); }}
                        >
                            <i className="fa-solid fa-receipt"></i> Đơn hàng
                        </button>
                        <button 
                            className={`${cx('filter-tab')} ${filter === 'cart' ? cx('active') : ''}`}
                            onClick={() => { setFilter('cart'); setCurrentPage(1); }}
                        >
                            <i className="fa-solid fa-cart-shopping"></i> Giỏ hàng
                        </button>
                    </div>

                    {loading ? (
                        <div className={cx('loading')}>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>Đang tải thông báo...</span>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className={cx('empty')}>
                            <i className="fa-regular fa-bell-slash"></i>
                            <span>Không có thông báo nào</span>
                        </div>
                    ) : (
                        <>
                            <div className={cx('notifications-list')}>
                                {notifications.map((notification) => (
                                    <div 
                                        key={notification._id}
                                        className={`${cx('notification-item')} ${!notification.isRead ? cx('unread') : ''}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        {notification.bookImage ? (
                                            <img src={notification.bookImage} alt="" className={cx('notification-image')}/>
                                        ) : (
                                            <div
                                                className={cx(
                                                    'notification-icon',
                                                    `notification-type--${getNotificationTypeClass(notification.type)}`
                                                )}
                                            >
                                                <i className={getNotificationIcon(notification.type)}></i>
                                            </div>
                                        )}
                                        <div className={cx('notification-content')}>
                                            {!notification.isRead && (
                                                <span className={cx('unread-pill')}>Chưa đọc</span>
                                            )}
                                            {notification.bookTitle && (
                                                <span className={cx('notification-book-title')}>{notification.bookTitle}</span>
                                            )}
                                            <h3 className={cx('notification-title')}>{notification.title}</h3>
                                            <p className={cx('notification-message')}>{notification.message}</p>
                                            <span className={cx('notification-time')}>{formatTimeAgo(notification.createdAt)}</span>
                                        </div>
                                        <div className={cx('notification-actions')}>
                                            <button 
                                                className={cx('action-icon')} 
                                                title="Xóa thông báo"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(notification._id); }}
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className={cx('pagination')}>
                                    <button 
                                        className={cx('page-btn')} 
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                    >
                                        <i className="fa-solid fa-chevron-left"></i>
                                    </button>
                                    <span className={cx('page-info')}>
                                        Trang {currentPage} / {totalPages}
                                    </span>
                                    <button 
                                        className={cx('page-btn')} 
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                    >
                                        <i className="fa-solid fa-chevron-right"></i>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Notifications;
