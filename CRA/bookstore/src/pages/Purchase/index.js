import { useContext, useEffect, useMemo, useState } from 'react';
import { getOrder, statusOrder, reviewOrder } from '../../app/api/OrderApi';
import styles from './Purchase.module.scss';
import classNames from 'classnames/bind';
import book1 from '../../components/assets/img/book1.PNG';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';
import AddReviewModal from '../../components/modal/AddReviewModal';
import { AuthContext } from '../../components/context/auth.context';
import { formatVndDisplay } from '../../components/function/function.js';
import { getCart, updateCart } from '../../app/api/CartApi';

const cx = classNames.bind(styles);
const DEFAULT_POINTS_PER_1000 = 10;
const STATUS_TABS = [
  { value: 0, label: 'Tất cả' },
  { value: 1, label: 'Chờ xử lý' },
  { value: 2, label: 'Vận chuyển' },
  { value: 3, label: 'Hoàn thành' },
  { value: 4, label: 'Đã hủy' },
];

function formatPurchaseDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function Purchase() {
  const { auth } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [currentIndex, setcurrentIndex] = useState(0);
  const [currentOrderId, setcurrentOrderId] = useState(null);
  const queryParams = new URLSearchParams(location.search);
  const status = Number(queryParams.get('status') || 0);
  const [filter, setFilter] = useState(0);
  const navigate = useNavigate();

  const statusClassName = (statusValue) => {
    if (statusValue === 'Chờ xử lý') return 'statusPending';
    if (statusValue === 'Đang giao') return 'statusShipping';
    if (statusValue === 'Hoàn thành') return 'statusCompleted';
    if (statusValue === 'Đã hủy') return 'statusCancelled';
    return '';
  };

  const applyOrderFilter = (orders, selectedStatus) => {
    if (!Array.isArray(orders)) return [];
    if (!selectedStatus || selectedStatus === 0) return orders;
    if (selectedStatus === 1) return orders.filter((item) => item.status === 'Chờ xử lý');
    if (selectedStatus === 2) return orders.filter((item) => item.status === 'Đang giao');
    if (selectedStatus === 3) return orders.filter((item) => item.status === 'Hoàn thành');
    if (selectedStatus === 4) return orders.filter((item) => item.status === 'Đã hủy');
    return orders;
  };

  const computeEarnedPoints = (order) => {
    const explicitPoints = Number(order?.earnedPoints ?? order?.rewardPoints);
    if (Number.isFinite(explicitPoints) && explicitPoints > 0) {
      return Math.round(explicitPoints);
    }
    if (order?.status !== 'Hoàn thành') return 0;
    const baseDong = Number(order?.goodsSubtotalDong ?? order?.totalAmount ?? 0);
    if (!Number.isFinite(baseDong) || baseDong <= 0) return 0;
    return Math.floor((baseDong / 1000) * DEFAULT_POINTS_PER_1000);
  };

  const loadOrders = async () => {
    if (!auth?.user?.email) return;
    setLoading(true);
    try {
      const orders = await getOrder(auth.user.email);
      setData(applyOrderFilter(orders, status));
    } catch (err) {
      console.log(err);
      toast.error('Không thể tải danh sách đơn hàng');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFilter(status || 0);
  }, [status]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const payment = q.get('payment');
    const method = q.get('method');

    const finishRedirect = () => {
      navigate('/profile/purchase', { replace: true });
    };

    (async () => {
      if (payment === 'success') {
        const clearKey = sessionStorage.getItem('checkout_vnpay_clear_cart');
        if (clearKey && auth?.user?.email && clearKey === auth.user.email) {
          try {
            const { items } = await getCart(auth.user.email);
            const remainingItems = (items || []).filter((item) => !item.selected);
            await updateCart(auth.user.email, remainingItems);
          } catch (e) {
            console.log(e);
          }
          sessionStorage.removeItem('checkout_vnpay_clear_cart');
        }
        toast.success(
          method === 'vnpay'
            ? 'Thanh toán VNPay thành công — đơn hàng đã được ghi nhận'
            : 'Thanh toán thành công',
        );
        finishRedirect();
      }
      if (payment === 'failed') {
        sessionStorage.removeItem('checkout_vnpay_clear_cart');
        const reason = q.get('reason');
        toast.error(
          method === 'vnpay'
            ? reason === 'checksum'
              ? 'VNPay: dữ liệu không hợp lệ, vui lòng thử lại'
              : 'Thanh toán VNPay không thành công hoặc đã hủy'
            : 'Thanh toán thất bại',
        );
        finishRedirect();
      }
      await loadOrders();
    })();
  }, [auth?.user?.email, status, location.search, navigate]);

  const handleUpdate = async (e, _id, action) => {
    e.preventDefault();

    confirmAlert({
      title: action === 'cancel' ? 'Xác Nhận Hủy Đơn' : 'Xác nhận giao hàng thành công',
      message:
        action === 'cancel'
          ? 'Bạn có chắc chắn muốn hủy đơn hàng này không'
          : 'Bạn có chắc đã nhận hàng thành công ?',
      buttons: [
        {
          label: 'Đồng ý',
          onClick: async () => {
          try {
            await statusOrder(_id, action);
            await loadOrders();
            toast.success(action === 'cancel' ? 'Hủy đơn hàng thành công!' : 'Xác nhận giao hàng thành công');
          } catch (error) {
            toast.error(action === 'cancel' ? 'Hủy đơn hàng thất bại!' : 'Xác nhận giao hàng chưa thành công');
          }
          },
        },
        {
          label: 'Không',
          onClick: () => {},
        },
      ],
    });
  };

  const hasData = useMemo(() => Array.isArray(data) && data.length > 0, [data]);

  return (
    <div className={cx('Purchase-container')}>
      <div className={cx('Purchase-title')}>
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            to={`/profile/purchase?status=${tab.value}`}
            className={cx('Purchase-category', { 'filter-primary': filter === tab.value })}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className={cx('Purchase-products')}>
        {loading && <p className={cx('emptyState')}>Đang tải đơn hàng...</p>}

        {!loading && !hasData && <p className={cx('emptyState')}>Chưa có đơn hàng nào ở trạng thái này.</p>}

        {hasData &&
          data.map((item, idx) => {
            const pointsRedeemed = Math.max(0, Number(item?.pointsRedeemed) || 0);
            const pointsDiscountDong = Math.max(0, Number(item?.pointsDiscountDong) || 0);
            const voucherCode = String(item?.voucherCode || '').trim();
            const voucherDiscountDong = Math.max(0, Number(item?.voucherDiscountDong) || 0);
            const earnedPoints = computeEarnedPoints(item);
            const canReview = !item.review;
            const orderItems = Array.isArray(item.items) ? item.items : [];

            return (
              <article key={item._id || idx} className={cx('Purchase-product')} style={{ '--card-index': idx + 1 }}>
                <div className={cx('Purchase-product-header')}>
                  <div className={cx('Purchase-product-status', statusClassName(item.status))}>{item.status}</div>
                  <div className={cx('flex-space')}>
                    <span className={cx('metaTag')}>
                      Trạng thái thanh toán:
                      {item.isPay ? (
                        <span className={cx('valid')}>Đã Thanh Toán</span>
                      ) : (
                        <span className={cx('invalid')}>Chưa thanh toán</span>
                      )}
                    </span>
                    <span className={cx('metaTag')}>Mã đơn hàng: {item._id}</span>
                    {formatPurchaseDate(item.createdAt) && (
                      <span className={cx('metaTag')}>Ngày đặt: {formatPurchaseDate(item.createdAt)}</span>
                    )}
                    <span className={cx('metaTag')}>
                      Voucher:
                      {voucherCode ? (
                        <strong className={cx('voucherApplied')}>
                          {' '}
                          {voucherCode}
                          {voucherDiscountDong > 0 ? ` (-${formatVndDisplay(voucherDiscountDong)})` : ''}
                        </strong>
                      ) : (
                        <strong className={cx('voucherNone')}> Không sử dụng</strong>
                      )}
                    </span>
                  </div>
                </div>

                {orderItems.map((product, idx2) => {
                  const book = product?.bookId && typeof product.bookId === 'object' ? product.bookId : null;
                  const bookName = book?.name || 'Sản phẩm không còn tồn tại';
                  const bookImg = book?.img || book1;
                  const detailHref = book?.name ? `/details/${encodeURIComponent(book.name)}` : '/';
                  return (
                    <div key={`${item._id}-${idx2}`} className={cx('Purchase-product-info')}>
                      <Link to={detailHref} className={cx('purchase-product-text')}>
                        <div className={cx('Purchase-product-intro')}>
                          <img className={cx('Purchase-product-img')} src={bookImg} alt={bookName} />
                          <div className={cx('Purchase-product-title')}>
                            <h3 className={cx('Purchase-product-name')}>{bookName}</h3>
                            <span className={`${cx('Purchase-product-category')} text-blur`}>Sản phẩm trong đơn</span>
                            <span className={cx('Purchase-product-quantity')}>x{product?.quantity || 0}</span>
                          </div>
                        </div>
                      </Link>
                      <span className={cx('Purchase-total-cost')}>{formatVndDisplay(product?.totalPrice || 0)}</span>
                    </div>
                  );
                })}

                <div className={cx('orderSummary')}>
                  <div className={cx('pointsBox')}>
                    <span className={cx('pointsTitle')}>Điểm thưởng</span>
                    <span className={cx('pointsLine')}>
                      Nhận từ đơn này:
                      <strong className={cx('pointsEarned')}> +{earnedPoints.toLocaleString('vi-VN')} điểm</strong>
                    </span>
                    <span className={cx('pointsLine')}>
                      Điểm đã dùng:
                      {pointsRedeemed > 0 ? (
                        <strong className={cx('pointsUsed')}>
                          {' '}
                          -{pointsRedeemed.toLocaleString('vi-VN')} điểm
                          {pointsDiscountDong > 0 ? ` (${formatVndDisplay(pointsDiscountDong)})` : ''}
                        </strong>
                      ) : (
                        <strong className={cx('pointsUnused')}> Không dùng điểm</strong>
                      )}
                    </span>
                  </div>
                  <div className={cx('Purchase-product-total')}>
                    <span className={cx('Purchase-product-total-text')}>Thành tiền:</span>
                    <span className={cx('Purchase-product-total-cost')}>{formatVndDisplay(item.totalAmount)}</span>
                  </div>
                </div>

                {item.status === 'Chờ xử lý' && (
                  <div onClick={(e) => handleUpdate(e, item._id, 'cancel')} className={cx('Purchase-btn')}>
                    <button type="button" className={cx('purchaseActionBtn', 'purchaseActionBtn--danger')}>
                      Hủy
                    </button>
                  </div>
                )}
                {item.status === 'Đang giao' && (
                  <div onClick={(e) => handleUpdate(e, item._id, 'Nhận đơn')} className={cx('Purchase-btn')}>
                    <button type="button" className={cx('purchaseActionBtn', 'purchaseActionBtn--success')}>
                      Đã nhận đơn hàng
                    </button>
                    <button type="button" disabled className={cx('purchaseActionBtn', 'purchaseActionBtn--muted')}>
                      Đang vận chuyển
                    </button>
                  </div>
                )}
                {item.status === 'Hoàn thành' && (
                  <div className={cx('Purchase-btn')}>
                    <Link to="/" className={cx('purchaseActionBtn', 'purchaseActionBtn--accent')}>
                      Tiếp tục mua hàng
                    </Link>
                    <button type="button" disabled className={cx('purchaseActionBtn', 'purchaseActionBtn--muted')}>
                      Hoàn thành
                    </button>
                    {!canReview ? (
                      <button type="button" disabled className={cx('purchaseActionBtn', 'purchaseActionBtn--muted')}>
                        Đánh giá
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setcurrentOrderId(item._id);
                          setReviewItems(orderItems);
                          setShowAddModal(true);
                        }}
                        className={cx('purchaseActionBtn', 'purchaseActionBtn--accent')}
                      >
                        Đánh giá
                      </button>
                    )}
                  </div>
                )}
                {item.status === 'Đã hủy' && (
                  <div className={cx('Purchase-btn')}>
                    <Link to="/" className={cx('purchaseActionBtn', 'purchaseActionBtn--accent')}>
                      Tiếp tục mua hàng
                    </Link>
                    <button type="button" disabled className={cx('purchaseActionBtn', 'purchaseActionBtn--muted')}>
                      Đã hủy
                    </button>
                  </div>
                )}
              </article>
            );
          })}
      </div>

      {reviewItems.length > 0 && showAddModal && (
        <AddReviewModal
          onClose={() => {
            setReviewItems([]);
            setShowAddModal(false);
          }}
          userId={auth.user.id}
          product={reviewItems[currentIndex]}
          onNext={async () => {
            if (currentIndex < reviewItems.length - 1) {
              setcurrentIndex((prev) => prev + 1);
            } else {
              await reviewOrder(currentOrderId);
              setReviewItems([]);
              setcurrentIndex(0);
              setcurrentOrderId(null);
              setShowAddModal(false);
              await loadOrders();
            }
          }}
        />
      )}
    </div>
  );
}

export default Purchase;