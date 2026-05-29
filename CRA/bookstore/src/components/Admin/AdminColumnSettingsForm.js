import classNames from 'classnames/bind';
import styles from '../Layout/AdminLayout/Admin.module.scss';

const cx = classNames.bind(styles);

/**
 * Nội dung form chọn cột (dùng trong modal hoặc trang Settings nhúng).
 */
function AdminColumnSettingsForm({
  optionalColumns,
  purgedColumns,
  isActive,
  toggleVisible,
  purgeColumn,
  restorePurged,
  resetDefaults,
  hint = 'Tắt công tắc để ẩn cột tạm thời. «Gỡ cột» loại cột khỏi bảng cho gọn; khôi phục ở mục bên dưới.',
  footerRight = null,
  embedded = false,
}) {
  return (
    <div className={embedded ? cx('columnSettingsFormEmbedded') : undefined}>
      <div className={cx('columnSettingsBody')}>
        <p className={cx('columnSettingsHint')}>{hint}</p>
        <ul className={cx('columnSettingsList')}>
          {optionalColumns
            .filter((c) => !purgedColumns.some((p) => p.id === c.id))
            .map((col) => {
              const on = isActive(col.id);
              return (
                <li key={col.id} className={cx('columnSettingsRow')}>
                  <span className={cx('columnSettingsLabel')}>{col.label}</span>
                  <label className={cx('columnSettingsSwitch')}>
                    <input type="checkbox" checked={on} onChange={() => toggleVisible(col.id)} />
                    <span>Hiển thị</span>
                  </label>
                  <button
                    type="button"
                    className={cx('columnSettingsPurgeBtn')}
                    onClick={() => purgeColumn(col.id)}
                    title="Gỡ cột khỏi bảng"
                  >
                    <i className="fa-solid fa-ban" /> Gỡ cột
                  </button>
                </li>
              );
            })}
        </ul>
        {purgedColumns.length > 0 && (
          <div className={cx('columnSettingsPurgedBlock')}>
            <h4>Cột đã gỡ khỏi bảng</h4>
            <ul className={cx('columnSettingsPurgedList')}>
              {purgedColumns.map((col) => (
                <li key={col.id}>
                  <span>{col.label}</span>
                  <button type="button" className={cx('columnSettingsRestoreBtn')} onClick={() => restorePurged(col.id)}>
                    <i className="fa-solid fa-rotate-left" /> Thêm lại
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={cx('columnSettingsFooter')}>
        <button type="button" className={cx('columnSettingsResetBtn')} onClick={resetDefaults}>
          <i className="fa-solid fa-rotate" style={{ marginRight: 6 }} />
          Khôi phục mặc định
        </button>
        {footerRight}
      </div>
    </div>
  );
}

export default AdminColumnSettingsForm;
