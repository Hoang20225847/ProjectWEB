import classNames from 'classnames/bind';
import styles from './Admin.module.scss';

const cx = classNames.bind(styles);

export default function AdminSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Tìm kiếm...',
  isSearching = false,
  onReset,
  showReset = false,
  inputId,
}) {
  return (
    <div className={cx('header-search')}>
      <form onSubmit={onSubmit} className={cx('search-form')}>
        <div className={cx('admin-search-bar')}>
          <div className={cx('admin-search-bar__field')}>
            <i className={`fa-solid fa-magnifying-glass ${cx('admin-search-bar__icon')}`} aria-hidden />
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={onChange}
              className={cx('admin-search-bar__input')}
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
          <button type="submit" className={cx('admin-search-bar__btn')} disabled={isSearching} aria-label="Tìm kiếm">
            {isSearching ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            ) : (
              <i className="fa-solid fa-magnifying-glass" aria-hidden />
            )}
          </button>
        </div>
      </form>
      {showReset && (
        <button type="button" onClick={onReset} className={cx('admin-search-bar__clear')}>
          <i className="fa-solid fa-xmark" aria-hidden />
          Bỏ lọc
        </button>
      )}
    </div>
  );
}
