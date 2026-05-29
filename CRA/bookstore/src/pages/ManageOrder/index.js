import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getListOrder, removeOrder } from '../../app/api/OrderApi.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
import axios from '../../components/axios/axios.customize.js';
import EditOrderModal from '../../components/modal/EditOrderModal.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import { LS_ORDER_COLS, ORDER_TABLE_SPEC } from '../../config/adminDashboardSpecs.js';
import { toast } from 'react-toastify';
import { useSearchParams, Link } from 'react-router-dom';
import { formatVndDisplay } from '../../components/function/function.js';
import AdminSearchBar from '../../components/Layout/AdminLayout/AdminSearchBar.js';

const cx = classNames.bind(styles);

const STATUS_CONFIG = {
  'Chờ xử lý': { class: 'status-badge--pending', icon: 'fa-clock' },
  'Đang giao': { class: 'status-badge--shipping', icon: 'fa-truck-fast' },
  'Hoàn thành': { class: 'status-badge--completed', icon: 'fa-check-circle' },
  'Đã hủy': { class: 'status-badge--cancelled', icon: 'fa-xmark-circle' },
};

function displayOrderId(order, rowIdx) {
  if (order?._id != null && order._id !== '') return String(order._id);
  return String(rowIdx + 1);
}

function formatOrderDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getRecentDateKeys(days = 5) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(now.getDate() - i);
    keys.push(toLocalDateKey(d));
  }
  return keys.filter(Boolean);
}

function formatDateLineLabel(dateKey) {
  if (!dateKey) return '';
  const [yyyy, mm, dd] = dateKey.split('-');
  if (!yyyy || !mm || !dd) return dateKey;
  return `${Number(dd)}/${Number(mm)}/${yyyy}`;
}

function ManageOrder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openedOrderIdRef = useRef(null);
  const [data, setData] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPay, setFilterPay] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [selectedDateLine, setSelectedDateLine] = useState('all');
  const recentDateKeys = useMemo(() => getRecentDateKeys(5), []);

  const cols = useAdminTableColumns(LS_ORDER_COLS, ORDER_TABLE_SPEC);
  const { isActive, gridTemplateColumns } = cols;
  const gridStyle = { gridTemplateColumns };

  const openEditModal = (order) => {
    setEditOrder(order);
    setShowEditModal(true);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const oid = searchParams.get('orderId');
    if (!oid || !Array.isArray(data)) return;
    if (openedOrderIdRef.current === oid) return;
    const order = data.find((o) => String(o._id) === oid);
    if (order) {
      setEditOrder(order);
      setShowEditModal(true);
      openedOrderIdRef.current = oid;
    }
  }, [data, searchParams]);

  const loadOrders = async () => {
    const json = await getListOrder();
    setData(json);
  };

  const statusOptions = useMemo(() => {
    const s = new Set();
    for (const o of data || []) {
      if (o.status) s.add(o.status);
    }
    return ['', ...[...s]];
  }, [data]);

  const filteredOrders = useMemo(() => {
    let rows = [...(Array.isArray(data) ? data : [])];
    if (filterStatus) rows = rows.filter((o) => o.status === filterStatus);
    if (filterPay === 'paid') rows = rows.filter((o) => o.isPay);
    if (filterPay === 'unpaid') rows = rows.filter((o) => !o.isPay);
    if (filterDateFrom) rows = rows.filter((o) => toLocalDateKey(o.createdAt) >= filterDateFrom);
    if (filterDateTo) rows = rows.filter((o) => toLocalDateKey(o.createdAt) <= filterDateTo);
    if (sortBy === 'dateDesc') {
      rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === 'dateAsc') {
      rows.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortBy === 'totalDesc') {
      rows.sort((a, b) => Number(b.totalAmount || 0) - Number(a.totalAmount || 0));
    }
    return rows;
  }, [data, filterStatus, filterPay, filterDateFrom, filterDateTo, sortBy]);

  const dateLineOrders = useMemo(() => {
    if (selectedDateLine === 'all') return filteredOrders;
    return filteredOrders.filter((o) => toLocalDateKey(o.createdAt) === selectedDateLine);
  }, [filteredOrders, selectedDateLine]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(dateLineOrders, listPrefs);

  useEffect(() => {
    setPage(1);
  }, [selectedDateLine, setPage]);

  const closeEditModal = () => {
    setShowEditModal(false);
    const next = new URLSearchParams(searchParams);
    if (next.has('orderId')) {
      next.delete('orderId');
      setSearchParams(next, { replace: true });
    }
    openedOrderIdRef.current = null;
  };

  const handleDelete = (order) => {
    if (!window.confirm(`Xóa đơn hàng "${order._id}"?`)) return;
    removeOrder(order._id);
    setData((prev) => prev.filter((item) => item._id !== order._id));
    toast.success('Đã xóa đơn hàng');
  };

  const handleSave = async (updatedOrder) => {
    try {
      await axios.put('/api/order', updatedOrder);
      toast.success('Cập nhật đơn hàng thành công');
      await loadOrders();
    } catch {
      toast.error('Cập nhật đơn hàng thất bại');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const key = searchKey.trim();
    if (!key) return;

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/order/search?key=${encodeURIComponent(key)}`);
      setData(response || []);
      toast.success(`Tìm thấy ${(response || []).length} kết quả`);
    } catch {
      toast.error('Tìm kiếm thất bại');
    }
    setIsSearching(false);
  };

  const handleResetSearch = () => {
    setSearchKey('');
    loadOrders();
  };

  const handleResetFilters = () => {
    setFilterStatus('');
    setFilterPay('all');
    setSortBy('dateDesc');
    setFilterDateFrom('');
    setFilterDateTo('');
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
            <i className="fa-solid fa-receipt" />
            <span className="admin-title-name">Quản Lý Đơn Hàng</span>
          </div>

          <AdminSearchBar
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onSubmit={handleSearch}
            placeholder="Tìm kiếm đơn hàng..."
            isSearching={isSearching}
            showReset={!!searchKey}
            onReset={handleResetSearch}
          />
        </div>
      </div>

      <div className={cx('dashboardToolbar')}>
        <div className={cx('dashboardToolbarFilters')}>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Trạng thái</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tất cả</option>
              {statusOptions.filter(Boolean).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Thanh toán</span>
            <select className={cx('dashboardFilterSelect')} value={filterPay} onChange={(e) => setFilterPay(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="paid">Đã thanh toán</option>
              <option value="unpaid">Chưa thanh toán</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Sắp xếp</span>
            <select className={cx('dashboardFilterSelect')} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="dateDesc">Mới nhất</option>
              <option value="dateAsc">Cũ nhất</option>
              <option value="totalDesc">Tổng tiền cao nhất</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Ngày tạo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Từ</span>
              <input
                type="date"
                className={cx('dashboardFilterSelect')}
                value={filterDateFrom}
                max={filterDateTo || undefined}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
              <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Đến</span>
              <input
                type="date"
                className={cx('dashboardFilterSelect')}
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
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
            <i className="fa-solid fa-receipt" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Danh Sách Đơn Hàng ({dateLineOrders.length}
            {dateLineOrders.length !== data.length ? ` / ${data.length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('orderDateLine')}>
            <span className={cx('orderDateLineLabel')}></span>
            {recentDateKeys.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                className={cx('orderDateLineBtn', selectedDateLine === dateKey && 'orderDateLineBtn--active')}
                onClick={() => setSelectedDateLine(dateKey)}
              >
                {formatDateLineLabel(dateKey)}
              </button>
            ))}
            <button
              type="button"
              className={cx('orderDateLineBtn', selectedDateLine === 'all' && 'orderDateLineBtn--active')}
              onClick={() => setSelectedDateLine('all')}
            >
              Xem tất cả
            </button>
          </div>

          <div className={cx('order-table-header')} style={gridStyle}>
            {isActive('orderCode') && <span>Mã Đơn</span>}
            {isActive('createdAt') && <span>Ngày tạo</span>}
            {isActive('products') && <span style={{ textAlign: 'left' }}>Sản Phẩm</span>}
            {isActive('email') && <span>Email</span>}
            {isActive('address') && <span>Địa chỉ</span>}
            {isActive('payment') && <span>Thanh toán</span>}
            {isActive('total') && <span>Tổng tiền</span>}
            {isActive('status') && <span>Tình trạng</span>}
            {isActive('action') && <span style={{ textAlign: 'right' }}>Thao tác</span>}
          </div>

          {!Array.isArray(data) || data.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-receipt" />
              <p>Chưa có đơn hàng nào</p>
              <p className="empty-desc">Đơn hàng sẽ xuất hiện tại đây khi có khách đặt</p>
            </div>
          ) : dateLineOrders.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có đơn khớp bộ lọc</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => {
              const statusCfg = STATUS_CONFIG[item.status] || { class: 'status-badge--pending', icon: 'fa-clock' };
              return (
                <div
                  key={item._id || idx}
                  className={cx('order-table-row')}
                  style={{ ...gridStyle, animationDelay: `${idx * 0.04}s` }}
                >
                  {isActive('orderCode') && (
                    <span
                      className={cx('orderTableCell', 'orderTableCell--mono')}
                      title={displayOrderId(item, idx)}
                    >
                      {displayOrderId(item, idx)}
                    </span>
                  )}

                  {isActive('createdAt') && (
                    <span
                      style={{
                        fontSize: '1.2rem',
                        color: '#64748b',
                        textAlign: 'center',
                        lineHeight: 1.35,
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                      title={item.createdAt ? String(item.createdAt) : ''}
                    >
                      {formatOrderDate(item.createdAt)}
                    </span>
                  )}

                  {isActive('products') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      {item.items &&
                        item.items.slice(0, 2).map((book, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '1.3rem',
                              color: '#475569',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`${book.quantity}x ${book.bookId?.name || 'Sản phẩm'}`}
                          >
                            <i className="fa-solid fa-book" style={{ marginRight: 4, color: '#94a3b8', fontSize: '1.1rem' }} />
                            {book.quantity}x {book.bookId?.name || 'Sản phẩm'}
                          </span>
                        ))}
                      {item.items && item.items.length > 2 && (
                        <span style={{ fontSize: '1.2rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          +{item.items.length - 2} sản phẩm khác
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
                      title={item.email}
                    >
                      {item.email}
                    </span>
                  )}

                  {isActive('address') && (
                    <span
                      style={{
                        fontSize: '1.35rem',
                        color: '#64748b',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={`${item.address?.details || ''}, ${item.address?.province || ''}`}
                    >
                      {item.address?.details ? `${item.address.details}, ` : ''}
                      {item.address?.province || '—'}
                    </span>
                  )}

                  {isActive('payment') && (
                    <span style={{ textAlign: 'center' }}>
                      {item.isPay ? (
                        <span
                          style={{
                            color: '#10b981',
                            fontWeight: 600,
                            fontSize: '1.2rem',
                            background: 'rgba(16,185,129,0.1)',
                            padding: '3px 8px',
                            borderRadius: 20,
                            display: 'inline-block',
                          }}
                        >
                          <i className="fa-solid fa-check" style={{ marginRight: 3 }} />
                          Đã TT
                        </span>
                      ) : (
                        <span
                          style={{
                            color: '#ef4444',
                            fontWeight: 600,
                            fontSize: '1.2rem',
                            background: 'rgba(239,68,68,0.08)',
                            padding: '3px 8px',
                            borderRadius: 20,
                            display: 'inline-block',
                          }}
                        >
                          <i className="fa-solid fa-xmark" style={{ marginRight: 3 }} />
                          Chưa TT
                        </span>
                      )}
                    </span>
                  )}

                  {isActive('total') && (
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2dd4bf', textAlign: 'center' }}>
                      {formatVndDisplay(item.totalAmount)}
                    </span>
                  )}

                  {isActive('status') && (
                    <span style={{ textAlign: 'center' }}>
                      <span className={`${cx('status-badge')} ${cx(statusCfg.class)}`}>
                        <i className={`fa-solid ${statusCfg.icon}`} />
                        {item.status || 'Chờ xử lý'}
                      </span>
                    </span>
                  )}

                  {isActive('action') && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
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
              );
            })
          )}
          {listPrefs.paginationEnabled && dateLineOrders.length > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalItems={dateLineOrders.length}
              pageSize={listPrefs.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <AdminColumnSettingsPanel
        open={showColSettings}
        onClose={() => setShowColSettings(false)}
        title="Cột bảng — Quản lý đơn hàng"
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {showEditModal && (
        <EditOrderModal order={editOrder} onClose={closeEditModal} onSave={handleSave} />
      )}
    </div>
  );
}

export default ManageOrder;
