import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useEffect, useMemo, useState } from 'react';
import { getAccount, removeAccount } from '../../app/api/AccountApi.js';
import { getOrder } from '../../app/api/OrderApi.js';
import { getAddressDefault } from '../../app/api/AddressApi.js';
import EditAccountModal from '../../components/modal/EditAccountModal.js';
import axios from '../../components/axios/axios.customize.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import { LS_USER_COLS, USER_TABLE_SPEC } from '../../config/adminDashboardSpecs.js';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Link } from 'react-router-dom';
import AdminSearchBar from '../../components/Layout/AdminLayout/AdminSearchBar.js';

const cx = classNames.bind(styles);

function membershipTierIdFromAccount(account) {
  const t = account?.membershipTier;
  if (t == null) return null;
  if (typeof t === 'object' && t._id != null) return String(t._id);
  return String(t);
}

function ManageUser() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState({});
  const [phones, setPhones] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [searchKey, setSearchKey] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterOrders, setFilterOrders] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [tierOptions, setTierOptions] = useState([]);

  const cols = useAdminTableColumns(LS_USER_COLS, USER_TABLE_SPEC);
  const { isActive, gridTemplateColumns } = cols;
  const gridStyle = { gridTemplateColumns };

  const openEditModal = (account) => {
    setEditingAccount(account);
    setShowEditModal(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = await axios.get('/api/membership/admin/tiers');
        setTierOptions(Array.isArray(rows) ? rows : []);
      } catch {
        setTierOptions([]);
      }
    })();
  }, []);

  const loadData = async () => {
    const json = await getAccount();
    setData(json);
    const orderMap = {};
    const phoneMap = {};
    for (const item of json) {
      try {
        const result = await getOrder(item.email);
        const address = await getAddressDefault(item.email);
        orderMap[item.email] = result.length;
        phoneMap[item.email] = address?.phone || '—';
      } catch {
        orderMap[item.email] = 0;
        phoneMap[item.email] = '—';
      }
    }
    setOrders(orderMap);
    setPhones(phoneMap);
  };

  const usersAfterRoleOrders = useMemo(() => {
    let rows = [...(data || [])];
    if (filterRole === 'admin') rows = rows.filter((u) => u.role === 'admin');
    if (filterRole === 'user') rows = rows.filter((u) => u.role !== 'admin');
    if (filterOrders === 'has') rows = rows.filter((u) => (orders[u.email] ?? 0) > 0);
    if (filterOrders === 'none') rows = rows.filter((u) => (orders[u.email] ?? 0) === 0);
    return rows;
  }, [data, filterRole, filterOrders, orders]);

  const membershipCounts = useMemo(() => {
    let withTier = 0;
    let regular = 0;
    for (const u of usersAfterRoleOrders) {
      if (membershipTierIdFromAccount(u)) withTier += 1;
      else regular += 1;
    }
    return { withTier, regular, total: usersAfterRoleOrders.length };
  }, [usersAfterRoleOrders]);

  const filteredUsers = useMemo(() => {
    let rows = [...usersAfterRoleOrders];
    if (filterTier === 'none') rows = rows.filter((u) => !membershipTierIdFromAccount(u));
    else if (filterTier !== 'all') rows = rows.filter((u) => membershipTierIdFromAccount(u) === filterTier);
    return rows;
  }, [usersAfterRoleOrders, filterTier]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(filteredUsers, listPrefs);

  const handleDelete = (account) => {
    if (!window.confirm(`Xóa tài khoản "${account.name}"?`)) return;
    removeAccount(account._id);
    setData((prev) => prev.filter((item) => item._id !== account._id));
    toast.success('Đã xóa tài khoản thành công');
  };

  const handleSave = async (updatedAccount) => {
    try {
      await axios.put('/api/account', { item: updatedAccount });
      toast.success('Cập nhật tài khoản thành công');
      await loadData();
    } catch {
      toast.error('Cập nhật tài khoản thất bại');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const key = searchKey.trim();
    if (!key) return;

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/account/search?key=${encodeURIComponent(key)}`);
      setData(response || []);
      toast.success(`Tìm thấy ${(response || []).length} kết quả`);
    } catch {
      toast.error('Tìm kiếm thất bại');
    }
    setIsSearching(false);
  };

  const handleResetSearch = () => {
    setSearchKey('');
    loadData();
  };

  const handleResetFilters = () => {
    setFilterRole('all');
    setFilterOrders('all');
    setFilterTier('all');
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
            <i className="fa-solid fa-users" />
            <span className="admin-title-name">Quản Lý Người Dùng</span>
          </div>

          <AdminSearchBar
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onSubmit={handleSearch}
            placeholder="Tìm kiếm người dùng..."
            isSearching={isSearching}
            showReset={!!searchKey}
            onReset={handleResetSearch}
          />
        </div>
      </div>

      <div className={cx('dashboardToolbar')}>
        <div className={cx('dashboardToolbarFilters')}>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Vai trò</span>
            <select className={cx('dashboardFilterSelect')} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="user">Khách / user</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Đơn hàng</span>
            <select className={cx('dashboardFilterSelect')} value={filterOrders} onChange={(e) => setFilterOrders(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="has">Đã có đơn</option>
              <option value="none">Chưa có đơn</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Hội viên</span>
            <select className={cx('dashboardFilterSelect')} value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="none">Tài khoản thường (chưa gán hạng)</option>
              {tierOptions.map((t) => (
                <option key={t._id} value={String(t._id)}>
                  Hạng: {t.name}
                </option>
              ))}
            </select>
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

      <div className={cx('userMembershipSummary')}>
        <span>
          Trong bộ lọc <strong>vai trò + đơn hàng</strong>: tổng <strong>{membershipCounts.total}</strong> tài khoản —{' '}
          <strong>{membershipCounts.withTier}</strong> đã gán hạng hội viên, <strong>{membershipCounts.regular}</strong> tài khoản thường
          (chưa gán hạng).
        </span>
      </div>

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-users" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Danh Sách Người Dùng ({filteredUsers.length}
            {filteredUsers.length !== data.length ? ` / ${data.length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('user-table-header')} style={gridStyle}>
            {isActive('name') && <span>Tên</span>}
            {isActive('email') && <span>Email</span>}
            {isActive('phone') && <span>Điện thoại</span>}
            {isActive('orders') && <span>Đơn hàng</span>}
            {isActive('membership') && <span>Hội viên</span>}
            {isActive('action') && <span>Thao tác</span>}
          </div>

          {data.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-users-slash" />
              <p>Chưa có người dùng nào</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có người dùng khớp bộ lọc</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => (
              <div
                key={item._id || idx}
                className={cx('user-table-row')}
                style={{ ...gridStyle, animationDelay: `${idx * 0.04}s` }}
              >
                {isActive('name') && (
                  <div className={cx('user-name-cell')}>
                    {item.avt ? (
                      <img
                        src={item.avt}
                        alt={item.name}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e2e8f0',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '1.4rem',
                          flexShrink: 0,
                        }}
                      >
                        {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    <span
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                )}

                {isActive('email') && (
                  <span
                    style={{
                      fontSize: '1.35rem',
                      color: '#64748b',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.email}
                  </span>
                )}

                {isActive('phone') && (
                  <span style={{ fontSize: '1.35rem', color: '#64748b' }}>{phones[item.email] || '—'}</span>
                )}

                {isActive('orders') && (
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2dd4bf', textAlign: 'center' }}>
                    {orders[item.email] ?? 0}
                  </span>
                )}

                {isActive('membership') && (
                  <span style={{ minWidth: 0 }}>
                    {item.membershipTier?.name ? (
                      <span className={cx('userTierBadge')} title={item.membershipTier.slug || ''}>
                        {item.membershipTier.name}
                      </span>
                    ) : (
                      <span className={cx('userTierPlain')}>Thường</span>
                    )}
                  </span>
                )}

                {isActive('action') && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button onClick={() => openEditModal(item)} className={cx('btn-controll')} title="Sửa">
                      <i className="fa-solid fa-pen-to-square" />
                    </button>
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
            ))
          )}
          {listPrefs.paginationEnabled && filteredUsers.length > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              pageSize={listPrefs.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <AdminColumnSettingsPanel
        open={showColSettings}
        onClose={() => setShowColSettings(false)}
        title="Cột bảng — Quản lý người dùng"
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {showEditModal && (
        <EditAccountModal account={editingAccount} onClose={() => setShowEditModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}

export default ManageUser;
