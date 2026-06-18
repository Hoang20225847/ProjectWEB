import { useEffect } from 'react';
import classNames from 'classnames/bind';
import '@fortawesome/fontawesome-free/css/all.min.css';
import styles from './ConfirmDeleteModal.module.scss';

const cx = classNames.bind(styles);

/// <summary>
/// Modal xác nhận xóa dùng chung admin; hỗ trợ message tùy chỉnh hoặc itemName mặc định.
/// </summary>
function ConfirmDeleteModal({
  open = false,
  title = 'Xác nhận xóa',
  message = '',
  itemName = '',
  warning = '',
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
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

  const bodyContent = message
    ? message
    : itemName
      ? (
          <>
            Bạn có chắc muốn xóa <span className={cx('highlight')}>&quot;{itemName}&quot;</span>? Hành động này không thể hoàn tác.
          </>
        )
      : 'Bạn có chắc muốn xóa mục này? Hành động này không thể hoàn tác.';

  return (
    <div className={cx('overlay')} role="presentation">
      <div
        className={cx('panel')}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-message"
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
          <i className="fa-solid fa-trash-can" />
        </div>

        <div className={cx('body')}>
          <h2 id="confirm-delete-title" className={cx('title')}>
            {title}
          </h2>
          <p id="confirm-delete-message" className={cx('message')}>
            {bodyContent}
          </p>
        </div>

        {warning ? (
          <div className={cx('warning')}>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden />
            <span>{warning}</span>
          </div>
        ) : null}

        <div className={cx('footer')}>
          <button type="button" className={`${cx('btn', 'btnCancel')}`} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`${cx('btn', 'btnConfirm')}`} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                Đang xóa...
              </>
            ) : (
              <>
                <i className="fa-solid fa-trash-can" aria-hidden />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
