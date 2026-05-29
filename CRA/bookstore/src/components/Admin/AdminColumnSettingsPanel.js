import classNames from 'classnames/bind';
import styles from '../Layout/AdminLayout/Admin.module.scss';
import AdminColumnSettingsForm from './AdminColumnSettingsForm.js';

const cx = classNames.bind(styles);

/**
 * Panel cài đặt cột: ẩn/hiện (toggle) và gỡ cột khỏi bảng (purged — khôi phục ở cuối).
 */
function AdminColumnSettingsPanel({
  open,
  onClose,
  title = 'Cột bảng dữ liệu',
  optionalColumns,
  purgedColumns,
  isActive,
  toggleVisible,
  purgeColumn,
  restorePurged,
  resetDefaults,
}) {
  if (!open) return null;

  return (
    <div className={cx('columnSettingsOverlay')} role="dialog" aria-modal="true" aria-labelledby="column-settings-title">
      <div className={cx('columnSettingsBackdrop')} onClick={onClose} />
      <div className={cx('columnSettingsModal')}>
        <div className={cx('columnSettingsHeader')}>
          <h3 id="column-settings-title">
            <i className="fa-solid fa-table-columns" style={{ marginRight: 8, color: '#2dd4bf' }} />
            {title}
          </h3>
          <button type="button" className={cx('columnSettingsClose')} onClick={onClose} aria-label="Đóng">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <AdminColumnSettingsForm
          optionalColumns={optionalColumns}
          purgedColumns={purgedColumns}
          isActive={isActive}
          toggleVisible={toggleVisible}
          purgeColumn={purgeColumn}
          restorePurged={restorePurged}
          resetDefaults={resetDefaults}
          footerRight={
            <button type="button" className={`btn btn--admin`} onClick={onClose}>
              Đóng
            </button>
          }
        />
      </div>
    </div>
  );
}

export default AdminColumnSettingsPanel;
