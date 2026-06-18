import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getAccount,
  getAdminAccounts,
  removeAccount,
  removeAdminAccount,
  searchCustomerAccounts,
  searchAdminAccounts,
  updateAdminAccount,
} from '../../app/api/AccountApi.js';
import { getOrder } from '../../app/api/OrderApi.js';
import { getAddressDefault } from '../../app/api/AddressApi.js';
import EditAccountModal from '../../components/modal/EditAccountModal.js';
import AddAdminModal from '../../components/modal/AddAdminModal.js';
import axios from '../../components/axios/axios.customize.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import {
  LS_USER_COLS,
  USER_TABLE_SPEC,
  LS_ADMIN_ACCOUNT_COLS,
  ADMIN_ACCOUNT_TABLE_SPEC,
} from '../../config/adminDashboardSpecs.js';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Link } from 'react-router-dom';
import AdminSearchBar from '../../components/Layout/AdminLayout/AdminSearchBar.js';
import { useConfirmDelete } from '../../hooks/useConfirmDelete.js';

const cx = classNames.bind(styles);

const ACCOUNT_TABS = [
  { id: 'customers', label: 'Khách hàng', icon: 'fa-user' },
  { id: 'admins', label: 'Quản trị viên', icon: 'fa-user-shield' },
];

/// <summary>
/// Lấy membershipTier id từ account (populated object hoặc raw ObjectId).
/// </summary>
function membershipTierIdFromAccount(account) {
  const t = account?.membershipTier;
  if (t == null) return null;
  if (typeof t === 'object' && t._id != null) return String(t._id);
  return String(t);
}

function formatDateVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

function AccountAvatar({ name, avt }) {
  if (avt) {
    return (
      <img
        src={avt}
        alt={name}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid #e2e8f0',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
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
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );
}

function ManageUser() {
  const { confirmDelete, ConfirmDeleteDialog } = useConfirmDelete();
  const [activeTab, setActiveTab] = useState('customers');
  const [customerData, setCustomerData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [orders, setOrders] = useState({});
  const [phones, setPhones] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [searchKey, setSearchKey] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [filterOrders, setFilterOrders] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [tierOptions, setTierOptions] = useState([]);

  const isCustomerTab = activeTab === 'customers';
  const tableSpec = isCustomerTab ? USER_TABLE_SPEC : ADMIN_ACCOUNT_TABLE_SPEC;
  const tableLsKey = isCustomerTab ? LS_USER_COLS : LS_ADMIN_ACCOUNT_COLS;
  const cols = useAdminTableColumns(tableLsKey, tableSpec);
  const { isActive, gridTemplateColumns } = cols;
  const gridStyle = { gridTemplateColumns };

  const data = isCustomerTab ? customerData : adminData;
  const setData = isCustomerTab ? setCustomerData : setAdminData;

  const openEditModal = (account) => {
    setEditingAccount(account);
    setShowEditModal(true);
  };

  useEffect(() => {
    loadCustomers();
    loadAdmins();
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

  const enrichCustomerMeta = async (rows) => {
    const orderMap = {};
    const phoneMap = {};
    for (const item of rows || []) {
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

  const loadCustomers = async () => {
    const json = await getAccount();
    setCustomerData(json || []);
    await enrichCustomerMeta(json || []);
  };

  const loadAdmins = async () => {
    const json = await getAdminAccounts();
    setAdminData(json || []);
  };

  const loadData = async () => {
    if (isCustomerTab) await loadCustomers();
    else await loadAdmins();
  };

  const usersAfterOrders = useMemo(() => {
    if (!isCustomerTab) return [...(data || [])];
    let rows = [...(data || [])];
    if (filterOrders === 'has') rows = rows.filter((u) => (orders[u.email] ?? 0) > 0);
    if (filterOrders === 'none') rows = rows.filter((u) => (orders[u.email] ?? 0) === 0);
    return rows;
  }, [data, filterOrders, orders, isCustomerTab]);

  const membershipCounts = useMemo(() => {
    if (!isCustomerTab) return { withTier: 0, regular: 0, total: (data || []).length };
    let withTier = 0;
    let regular = 0;
    for (const u of usersAfterOrders) {
      if (membershipTierIdFromAccount(u)) withTier += 1;
      else regular += 1;
    }
    return { withTier, regular, total: usersAfterOrders.length };
  }, [usersAfterOrders, isCustomerTab, data]);

  const filteredUsers = useMemo(() => {
    if (!isCustomerTab) return [...(data || [])];
    let rows = [...usersAfterOrders];
    if (filterTier === 'none') rows = rows.filter((u) => !membershipTierIdFromAccount(u));
    else if (filterTier !== 'all') rows = rows.filter((u) => membershipTierIdFromAccount(u) === filterTier);
    return rows;
  }, [usersAfterOrders, filterTier, isCustomerTab, data]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(filteredUsers, listPrefs);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchKey('');
    setFilterOrders('all');
    setFilterTier('all');
    setPage(1);
  };

  /// <summary>
  /// Xóa khách hoặc admin; gọi removeAccount / removeAdminAccount tương ứng.
  /// </summary>
  const handleDelete = async (account) => {
    const isAdminAccount = account.accountKind === 'admin';
    const ok = await confirmDelete({
      title: isAdminAccount ? 'Xóa quản trị viên' : 'Xóa tài khoản khách',
      itemName: account.name,
      message: isAdminAccount
        ? 'Tài khoản quản trị sẽ bị xóa khỏi hệ thống. Bạn không thể xóa chính mình hoặc quản trị viên cuối cùng.'
        : undefined,
    });
    if (!ok) return;

    try {
      if (isAdminAccount) {
        await removeAdminAccount(account._id);
        setAdminData((prev) => (prev || []).filter((item) => item._id !== account._id));
        toast.success('Đã xóa quản trị viên');
      } else {
        await removeAccount(account._id);
        setCustomerData((prev) => (prev || []).filter((item) => item._id !== account._id));
        toast.success('Đã xóa tài khoản khách');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Xóa thất bại';
      toast.error(msg);
    }
  };

  const handleSave = async (updatedAccount) => {
    const isAdminAccount = updatedAccount.accountKind === 'admin';
    try {
      if (isAdminAccount) {
        await updateAdminAccount(updatedAccount._id, updatedAccount);
        toast.success('Cập nhật quản trị viên thành công');
        await loadAdmins();
      } else {
        await axios.put('/api/account', { item: updatedAccount });
        toast.success('Cập nhật khách hàng thành công');
        await loadCustomers();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Cập nhật thất bại';
      toast.error(msg);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const key = searchKey.trim();
    if (!key) return;

    setIsSearching(true);
    try {
      const response = isCustomerTab ? await searchCustomerAccounts(key) : await searchAdminAccounts(key);
      setData(response || []);
      if (isCustomerTab) await enrichCustomerMeta(response || []);
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
    setFilterOrders('all');
    setFilterTier('all');
  };

  if (customerData === null || adminData === null) {
    return (
      <div className={cx('loading')}>
        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10, fontSize: '1.8rem' }} />
        Đang tải dữ liệu...
      </div>
    );
  }

  const customerCount = customerData.length;
  const adminCount = adminData.length;

  return (
    <div>
      <div className={cx('admin-nav')}>
        <div className={`${cx('logo-search')} admin-title`}>
          <div>
            <i className="fa-solid fa-users" />
            <span className="admin-title-name">Quản Lý Tài Khoản</span>
          </div>

          <AdminSearchBar
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onSubmit={handleSearch}
            placeholder={isCustomerTab ? 'Tìm kiếm khách hàng...' : 'Tìm kiếm quản trị viên...'}
            isSearching={isSearching}
            showReset={!!searchKey}
            onReset={handleResetSearch}
          />
        </div>
      </div>

      <div className={cx('accountKindTabs')}>
        {ACCOUNT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cx('accountKindTab', { accountKindTabActive: activeTab === tab.id })}
            onClick={() => handleTabChange(tab.id)}
          >
            <i className={`fa-solid ${tab.icon}`} style={{ marginRight: 8 }} />
            {tab.label}
            <span className={cx('accountKindTabCount')}>
              {tab.id === 'customers' ? customerCount : adminCount}
            </span>
          </button>
        ))}
      </div>

      {isCustomerTab ? (
        <div className={cx('dashboardToolbar')}>
          <div className={cx('dashboardToolbarFilters')}>
            <div className={cx('dashboardFilterGroup')}>
              <span className={cx('dashboardFilterLabel')}>Đơn hàng</span>
              <select
                className={cx('dashboardFilterSelect')}
                value={filterOrders}
                onChange={(e) => setFilterOrders(e.target.value)}
              >
                <option value="all">Tất cả</option>
                <option value="has">Đã có đơn</option>
                <option value="none">Chưa có đơn</option>
              </select>
            </div>
            <div className={cx('dashboardFilterGroup')}>
              <span className={cx('dashboardFilterLabel')}>Hội viên</span>
              <select
                className={cx('dashboardFilterSelect')}
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              >
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
      ) : (
        <div className={cx('dashboardToolbar')}>
          <div className={cx('adminAccountHint')}>
            
          </div>
          <div className={cx('dashboardToolbarActions')}>
            <button type="button" className="btn btn--admin btn-add" onClick={() => setShowAddAdminModal(true)}>
              <i className="fa-solid fa-user-plus" style={{ marginRight: 6 }} />
              Tạo quản trị viên
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
      )}

      {isCustomerTab && (
        <div className={cx('userMembershipSummary')}>
          <span>
            Khách hàng trong bộ lọc: tổng <strong>{membershipCounts.total}</strong> —{' '}
            <strong>{membershipCounts.withTier}</strong> đã gán hạng hội viên,{' '}
            <strong>{membershipCounts.regular}</strong> tài khoản thường.
          </span>
        </div>
      )}

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i
              className={`fa-solid ${isCustomerTab ? 'fa-user' : 'fa-user-shield'}`}
              style={{ marginRight: 8, color: isCustomerTab ? '#2dd4bf' : '#6366f1' }}
            />
            {isCustomerTab ? 'Danh Sách Khách Hàng' : 'Danh Sách Quản Trị Viên'} ({filteredUsers.length}
            {filteredUsers.length !== (data || []).length ? ` / ${(data || []).length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('user-table-header')} style={gridStyle}>
            {isActive('name') && <span>Tên</span>}
            {isActive('email') && <span>Email</span>}
            {isCustomerTab && isActive('phone') && <span>Điện thoại</span>}
            {isCustomerTab && isActive('orders') && <span>Đơn hàng</span>}
            {isCustomerTab && isActive('membership') && <span>Hội viên</span>}
            {!isCustomerTab && isActive('createdAt') && <span>Ngày tạo</span>}
            {isActive('action') && <span>Thao tác</span>}
          </div>

          {(data || []).length === 0 ? (
            <div className={cx('emptyState')}>
              <i className={`fa-solid ${isCustomerTab ? 'fa-users-slash' : 'fa-user-shield'}`} />
              <p>{isCustomerTab ? 'Chưa có khách hàng nào' : 'Chưa có quản trị viên nào'}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có tài khoản khớp bộ lọc</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => (
              <div
                key={item._id || idx}
                className={cx('user-table-row', { userTableRowAdmin: !isCustomerTab })}
                style={{ ...gridStyle, animationDelay: `${idx * 0.04}s` }}
              >
                {isActive('name') && (
                  <div className={cx('user-name-cell')}>
                    <AccountAvatar name={item.name} avt={item.avt} />
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
                    {!isCustomerTab && <span className={cx('adminRoleBadge')}>Admin</span>}
                    {isCustomerTab && item.deletedAt && (
                      <span className={cx('accountDisabledBadge')} title="Tài khoản đã vô hiệu hóa">
                        Đã khóa
                      </span>
                    )}
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

                {isCustomerTab && isActive('phone') && (
                  <span style={{ fontSize: '1.35rem', color: '#64748b' }}>{phones[item.email] || '—'}</span>
                )}

                {isCustomerTab && isActive('orders') && (
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2dd4bf', textAlign: 'center' }}>
                    {orders[item.email] ?? 0}
                  </span>
                )}

                {isCustomerTab && isActive('membership') && (
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

                {!isCustomerTab && isActive('createdAt') && (
                  <span style={{ fontSize: '1.35rem', color: '#64748b' }}>{formatDateVi(item.createdAt)}</span>
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
        title={isCustomerTab ? 'Cột bảng — Khách hàng' : 'Cột bảng — Quản trị viên'}
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {showEditModal && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}
      {showAddAdminModal && (
        <AddAdminModal
          onClose={() => setShowAddAdminModal(false)}
          onAddSuccess={loadAdmins}
        />
      )}
      <ConfirmDeleteDialog />
    </div>
  );
}

export default ManageUser;
