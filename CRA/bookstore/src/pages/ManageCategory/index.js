import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../components/axios/axios.customize.js';
import { getCategoryList } from '../../app/api/siteApi.js';
import { toast } from 'react-toastify';
import AddCategoryModal from '../../components/modal/AddCategoryModal.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import { LS_CAT_COLS, CATEGORY_TABLE_SPEC } from '../../config/adminDashboardSpecs.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Link } from 'react-router-dom';

const cx = classNames.bind(styles);

function ManageCategory() {
  const [data, setData] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  const cols = useAdminTableColumns(LS_CAT_COLS, CATEGORY_TABLE_SPEC);
  const { isActive, gridTemplateColumns } = cols;
  const gridStyle = { gridTemplateColumns };

  const load = async () => {
    const json = await getCategoryList();
    setData(Array.isArray(json) ? json : []);
  };

  useEffect(() => {
    load();
  }, []);

  const sortedRows = useMemo(() => [...(data || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data]);

  const filteredRows = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q)
    );
  }, [sortedRows, nameFilter]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(filteredRows, listPrefs);

  const moveOrder = async (id, direction) => {
    const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((x) => x._id === id);
    if (idx < 0) return;
    const j = direction === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    const oa = a.order ?? 0;
    const ob = b.order ?? 0;
    try {
      await axios.put(`/api/categories/${a._id}`, { order: ob });
      await axios.put(`/api/categories/${b._id}`, { order: oa });
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không đổi được thứ tự');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa danh mục "${item.name}"?`)) return;
    try {
      await axios.delete(`/api/categories/${item._id}`);
      toast.success('Đã xóa danh mục');
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không xóa được (có thể còn sách dùng danh mục)';
      toast.error(msg);
    }
  };

  const handleResetFilters = () => {
    setNameFilter('');
  };

  if (!data) {
    return (
      <div className={cx('loading')}>
        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10, fontSize: '1.8rem' }} />
        Đang tải dữ liệu...
      </div>
    );
  }

  return (
    <div>
      <div className={cx('admin-nav')}>
        <div className={`${cx('logo-search')} admin-title`}>
          <div>
            <i className="fa-solid fa-tags" />
            <span className="admin-title-name">Quản Lý Danh Mục</span>
          </div>
        </div>

        <button onClick={() => setShowAddModal(true)} className={`btn btn--admin btn-add`}>
          <i className="fa-solid fa-plus" />
          Thêm Danh Mục
        </button>
      </div>

      <div className={cx('dashboardToolbar')}>
        <div className={cx('dashboardToolbarFilters')}>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Lọc tên / slug</span>
            <input
              type="search"
              className={cx('dashboardFilterSelect')}
              style={{ minWidth: 220 }}
              placeholder="Gõ để lọc..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
        </div>
        <div className={cx('dashboardToolbarActions')}>
          <button type="button" className={cx('dashboardSettingsBtn')} onClick={handleResetFilters}>
            <i className="fa-solid fa-rotate-left" />
            Reset filter
          </button>
          <Link to="/admin/Settings" className={cx('dashboardSettingsBtn')} style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-gear" />
            Cài đặt
          </Link>
          <button type="button" className={cx('dashboardSettingsBtn')} onClick={() => setShowColSettings(true)}>
            <i className="fa-solid fa-table-columns" />
            Cột bảng
          </button>
        </div>
      </div>

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-tags" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Danh Sách Danh Mục ({filteredRows.length}
            {filteredRows.length !== sortedRows.length ? ` / ${sortedRows.length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('category-table-header')} style={gridStyle}>
            {isActive('name') && <span className="col-name">Tên</span>}
            {isActive('slug') && <span>Slug</span>}
            {isActive('order') && <span>Thứ Tự</span>}
            {isActive('bookCount') && <span>Số Sách</span>}
            {isActive('action') && <span>Thao tác</span>}
          </div>

          {sortedRows.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-tags" />
              <p>Chưa có danh mục nào</p>
              <p className="empty-desc">Nhấn &quot;Thêm Danh Mục&quot; để tạo</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có danh mục khớp từ khóa</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => {
              const globalIdx = sortedRows.findIndex((x) => x._id === item._id);
              return (
              <div
                key={item._id}
                className={cx('category-table-row')}
                style={{ ...gridStyle, animationDelay: `${idx * 0.05}s` }}
              >
                {isActive('name') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(20,184,166,0.08))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '1.4rem',
                        color: '#2dd4bf',
                      }}
                    >
                      <i className="fa-solid fa-folder" />
                    </div>
                    <span className={cx('product-title')}>{item.name}</span>
                  </div>
                )}

                {isActive('slug') && (
                  <span
                    style={{
                      fontSize: '1.3rem',
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.slug || '—'}
                  </span>
                )}

                {isActive('order') && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className={cx('reorder-controls')}>
                      <button
                        type="button"
                        title="Đưa lên"
                        className={cx('reorder-btn')}
                        disabled={globalIdx <= 0}
                        onClick={() => moveOrder(item._id, 'up')}
                      >
                        <i className="fa-solid fa-chevron-up" style={{ fontSize: '1.1rem' }} />
                      </button>
                      <span className={cx('reorder-number')}>{item.order}</span>
                      <button
                        type="button"
                        title="Đưa xuống"
                        className={cx('reorder-btn')}
                        disabled={globalIdx < 0 || globalIdx >= sortedRows.length - 1}
                        onClick={() => moveOrder(item._id, 'down')}
                      >
                        <i className="fa-solid fa-chevron-down" style={{ fontSize: '1.1rem' }} />
                      </button>
                    </div>
                  </div>
                )}

                {isActive('bookCount') && (
                  <span style={{ fontSize: '1.4rem', fontWeight: 600, color: '#2dd4bf', textAlign: 'center' }}>
                    {item.bookCount ?? 0}
                  </span>
                )}

                {isActive('action') && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button
                      onClick={() => handleDelete(item)}
                      className={`${cx('btn-controll')} delete`}
                      title="Xóa"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                )}
              </div>
            );
            })
          )}
          {listPrefs.paginationEnabled && filteredRows.length > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              pageSize={listPrefs.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <AdminColumnSettingsPanel
        open={showColSettings}
        onClose={() => setShowColSettings(false)}
        title="Cột bảng — Quản lý danh mục"
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {showAddModal && (
        <AddCategoryModal onClose={() => setShowAddModal(false)} onAddSuccess={() => load()} />
      )}
    </div>
  );
}

export default ManageCategory;
