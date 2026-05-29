import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminColumnSettingsForm from '../../components/Admin/AdminColumnSettingsForm.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { ADMIN_DASHBOARD_TABLES } from '../../config/adminDashboardSpecs.js';
import '@fortawesome/fontawesome-free/css/all.min.css';

const cx = classNames.bind(styles);

function DashboardColumnSection({ meta }) {
  const cols = useAdminTableColumns(meta.lsKey, meta.spec);

  return (
    <div className={cx('adminSettingsColumnCard')}>
      <div className={cx('adminSettingsColumnCardHead')}>
        <h3>{meta.label}</h3>
        <Link to={meta.path} className={cx('adminSettingsGoLink')}>
          Mở trang <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} />
        </Link>
      </div>
      <AdminColumnSettingsForm
        embedded
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
        footerRight={null}
      />
    </div>
  );
}

function AdminSettings() {
  const listPrefs = useAdminListPreferences();
  const [activeTable, setActiveTable] = useState(ADMIN_DASHBOARD_TABLES[0].id);
  const activeMeta = ADMIN_DASHBOARD_TABLES.find((t) => t.id === activeTable) || ADMIN_DASHBOARD_TABLES[0];

  return (
    <div>
      <div className={cx('admin-nav')}>
        <div className={`${cx('logo-search')} admin-title`}>
          <div>
            <i className="fa-solid fa-gear" />
            <span className="admin-title-name">Cài đặt dashboard</span>
          </div>
        </div>
      </div>

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-sliders" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Phân trang &amp; danh sách
          </h3>
        </div>
        <div className={cx('adminSettingsSection')}>
          <p className={cx('adminSettingsIntro')}>
            Áp dụng cho các bảng quản lý (sách, đơn, người dùng, danh mục, hero). Dữ liệu được lọc trước, sau đó mới chia trang.
          </p>
          <div className={cx('adminSettingsRow')}>
            <label className={cx('adminSettingsSwitchBlock')}>
              <input
                type="checkbox"
                checked={listPrefs.paginationEnabled}
                onChange={(e) => listPrefs.setPaginationEnabled(e.target.checked)}
              />
              <span>Bật phân trang cho danh sách</span>
            </label>
          </div>
          <div className={cx('adminSettingsRow')}>
            <span className={cx('adminSettingsLabel')}>Số mục mỗi trang</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={listPrefs.pageSize}
              onChange={(e) => listPrefs.setPageSize(e.target.value)}
              disabled={!listPrefs.paginationEnabled}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className={cx('data-card')} style={{ marginTop: 20 }}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-table-columns" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Cột bảng theo màn hình
          </h3>
        </div>
        <div className={cx('adminSettingsTabs')}>
          {ADMIN_DASHBOARD_TABLES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cx('adminSettingsTab', { adminSettingsTabActive: activeTable === t.id })}
              onClick={() => setActiveTable(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={cx('adminSettingsSection')}>
          <DashboardColumnSection key={activeMeta.id} meta={activeMeta} />
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;
