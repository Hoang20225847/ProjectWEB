import classNames from 'classnames/bind';
import styles from '../Layout/AdminLayout/Admin.module.scss';

const cx = classNames.bind(styles);

function AdminPaginationBar({ currentPage, totalPages, totalItems, pageSize, onPageChange, disabled }) {
  if (totalPages <= 1) return null;

  return (
    <div className={cx('adminPaginationBar')}>
      <button
        type="button"
        className={cx('adminPaginationBtn')}
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Trang trước"
      >
        <i className="fa-solid fa-chevron-left" />
      </button>
      <span className={cx('adminPaginationInfo')}>
        Trang {currentPage} / {totalPages}
        <span className={cx('adminPaginationMeta')}>
          ({totalItems} mục, {pageSize}/trang)
        </span>
      </span>
      <button
        type="button"
        className={cx('adminPaginationBtn')}
        disabled={disabled || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Trang sau"
      >
        <i className="fa-solid fa-chevron-right" />
      </button>
    </div>
  );
}

export default AdminPaginationBar;
