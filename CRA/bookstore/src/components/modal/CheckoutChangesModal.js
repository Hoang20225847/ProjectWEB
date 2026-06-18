import { useEffect } from 'react';
import classNames from 'classnames/bind';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { formatVndDisplay } from '../function/function.js';
import styles from './CheckoutChangesModal.module.scss';

const cx = classNames.bind(styles);

/// <summary>
/// Chuyển mã reason từ validate-checkout thành mô tả hiển thị cho người dùng.
/// </summary>
function describeChange(change) {
  switch (change.reason) {
    case 'priceChanged':
      return `Giá: ${formatVndDisplay(change.oldPrice)} → ${formatVndDisplay(change.newPrice)}`;
    case 'quantityClamped':
      return `Số lượng: ${change.previousQty} → ${change.newQty} (theo tồn kho)`;
    case 'outOfStock':
      return 'Đã hết hàng — gỡ khỏi đơn';
    case 'notOrderable':
      return 'Không còn bán trên web — gỡ khỏi đơn';
    case 'notFound':
      return 'Không tìm thấy sách — gỡ khỏi đơn';
    default:
      return 'Đã thay đổi';
  }
}

/// <summary>
/// Dialog xác nhận tiếp tục đặt hàng khi giá/tồn kho sách đã thay đổi so với client.
/// </summary>
function CheckoutChangesModal({
  open = false,
  changes = [],
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className={cx('overlay')} role="presentation">
      <div
        className={cx('panel')}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="checkout-changes-title"
      >
        <button
          type="button"
          className={cx('closeBtn')}
          onClick={onCancel}
          disabled={loading}
          aria-label="Đóng"
        >
          <i className="fa-solid fa-xmark" aria-hidden />
        </button>

        <div className={cx('iconWrap')} aria-hidden>
          <i className="fa-solid fa-triangle-exclamation" />
        </div>

        <div className={cx('body')}>
          <h2 id="checkout-changes-title" className={cx('title')}>
            Sách trong đơn đã thay đổi
          </h2>
          <p className={cx('message')}>
            Một số thông tin sách đã được cập nhật. Vui lòng xem lại trước khi tiếp tục đặt hàng.
          </p>
        </div>

        <ul className={cx('changeList')}>
          {changes.map((change, idx) => (
            <li key={`${change.bookId || change.name}-${change.reason}-${idx}`} className={cx('changeItem')}>
              <span className={cx('changeName')}>{change.name || 'Sản phẩm'}</span>
              <span className={cx('changeDetail')}>{describeChange(change)}</span>
            </li>
          ))}
        </ul>

        <div className={cx('footer')}>
          <button type="button" className={cx('btn', 'btnCancel')} onClick={onCancel} disabled={loading}>
            Hủy đặt hàng
          </button>
          <button type="button" className={cx('btn', 'btnConfirm')} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                Đang xử lý...
              </>
            ) : (
              'Tiếp tục đặt hàng'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutChangesModal;
