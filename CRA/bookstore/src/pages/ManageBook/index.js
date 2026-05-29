import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import axios from '../../components/axios/axios.customize.js';
import React, { useEffect, useMemo, useState } from 'react';
import { getBookList, removeBook } from '../../app/api/siteApi.js';
import BookFormModal from '../../components/modal/BookFormModal.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import { LS_BOOK_COLS, BOOK_TABLE_SPEC } from '../../config/adminDashboardSpecs.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import { formatVndDisplay, listPriceVnd } from '../../components/function/function.js';
import AdminSearchBar from '../../components/Layout/AdminLayout/AdminSearchBar.js';
import { matchesVietnameseSearch } from '../../utils/vietnameseSearch.js';

const cx = classNames.bind(styles);

const LISTING_LABELS = {
  draft: 'Soạn thảo',
  published: 'Đang hiển thị',
  unlisted: 'Ẩn danh mục',
  archived: 'Ngừng KD',
};

function listingLabel(status) {
  if (status == null || status === '') return LISTING_LABELS.published;
  return LISTING_LABELS[status] || String(status);
}

function ManageBook() {
  const [data, setData] = useState(null);
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [searchKey, setSearchKey] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSale, setFilterSale] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [filterPublisher, setFilterPublisher] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterProductionYear, setFilterProductionYear] = useState('');
  const [filterSeriesId, setFilterSeriesId] = useState('');
  const [filterAuthorId, setFilterAuthorId] = useState('');

  const cols = useAdminTableColumns(LS_BOOK_COLS, BOOK_TABLE_SPEC);
  const { isActive, gridTemplateColumns } = cols;

  const openAddModal = () => {
    setEditingBook(null);
    setBookFormOpen(true);
  };
  const openEditModal = (book) => {
    setEditingBook(book);
    setBookFormOpen(true);
  };
  const closeBookForm = () => {
    setBookFormOpen(false);
    setEditingBook(null);
  };

  useEffect(() => {
    async function fetchData() {
      const json = await getBookList();
      setData(json);
    }
    fetchData();
  }, []);

  const productionYearOptions = useMemo(() => {
    const ys = new Set();
    for (const b of data || []) {
      if (b.productionYear != null && !Number.isNaN(Number(b.productionYear))) ys.add(Number(b.productionYear));
    }
    return ['', ...[...ys].sort((a, b) => b - a)];
  }, [data]);

  const categoryOptions = useMemo(() => {
    const names = new Set();
    for (const b of data || []) {
      const n = b.category && typeof b.category === 'object' ? b.category.name : '';
      if (n) names.add(n);
    }
    return ['', ...[...names].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [data]);

  const seriesOptions = useMemo(() => {
    const map = new Map();
    for (const b of data || []) {
      const s = b.series;
      if (!s) continue;
      const id = typeof s === 'object' && s._id != null ? String(s._id) : String(s);
      const name = typeof s === 'object' && s.name ? String(s.name) : id;
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [data]);

  const authorOptions = useMemo(() => {
    const map = new Map();
    for (const b of data || []) {
      const a = b.authorRef;
      if (!a) continue;
      const id = typeof a === 'object' && a._id != null ? String(a._id) : String(a);
      const name =
        typeof a === 'object' && a.name
          ? String(a.name)
          : (b.author && String(b.author).trim()) || id;
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [data]);

  const filteredBooks = useMemo(() => {
    let rows = [...(data || [])];
    if (filterCategory) {
      rows = rows.filter(
        (b) => (b.category && typeof b.category === 'object' ? b.category.name : '') === filterCategory
      );
    }
    if (filterSale === 'yes') rows = rows.filter((b) => (Number(b.discount) || 0) > 0);
    if (filterSale === 'no') rows = rows.filter((b) => !b.discount || Number(b.discount) <= 0);
    const pubQ = filterPublisher.trim();
    if (pubQ) {
      rows = rows.filter((b) => matchesVietnameseSearch(b.publisher, pubQ));
    }
    if (filterFormat) {
      rows = rows.filter((b) => String(b.format || '') === filterFormat);
    }
    if (filterProductionYear) {
      const y = Number(filterProductionYear);
      rows = rows.filter((b) => Number(b.productionYear) === y);
    }
    if (filterSeriesId) {
      rows = rows.filter((b) => {
        const s = b.series;
        const id = s && typeof s === 'object' && s._id != null ? String(s._id) : s != null ? String(s) : '';
        return id === filterSeriesId;
      });
    }
    if (filterAuthorId) {
      rows = rows.filter((b) => {
        const a = b.authorRef;
        const id = a && typeof a === 'object' && a._id != null ? String(a._id) : a != null ? String(a) : '';
        return id === filterAuthorId;
      });
    }
    if (sortBy === 'priceAsc') rows.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'priceDesc') rows.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === 'soldDesc') rows.sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0));
    return rows;
  }, [
    data,
    filterCategory,
    filterSale,
    sortBy,
    filterPublisher,
    filterFormat,
    filterProductionYear,
    filterSeriesId,
    filterAuthorId,
  ]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(filteredBooks, listPrefs);

  const gridStyle = { gridTemplateColumns };

  const handleDelete = (book) => {
    if (!window.confirm(`Xóa sách "${book.name}"?`)) return;
    removeBook(book._id);
    setData((prev) => prev.filter((item) => item._id !== book._id));
    toast.success('Đã xóa sách thành công');
  };

  const handleBookFormSuccess = (saved) => {
    setData((prev) => {
      const list = prev || [];
      const exists = list.some((b) => b._id === saved._id);
      if (exists) {
        return list.map((b) => (b._id === saved._id ? { ...b, ...saved } : b));
      }
      return [saved, ...list];
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const key = searchKey.trim();
    if (!key) return;

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/books/search?key=${encodeURIComponent(key)}`);
      setData(response || []);
      toast.success(`Tìm thấy ${(response || []).length} kết quả`);
    } catch (error) {
      toast.error('Tìm kiếm thất bại');
    }
    setIsSearching(false);
  };

  const handleResetSearch = () => {
    setSearchKey('');
    getBookList().then((json) => setData(json));
  };

  const handleResetFilters = () => {
    setFilterCategory('');
    setFilterSale('all');
    setSortBy('default');
    setFilterPublisher('');
    setFilterFormat('');
    setFilterProductionYear('');
    setFilterSeriesId('');
    setFilterAuthorId('');
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
            <i className="fa-solid fa-book-open" />
            <span className="admin-title-name">Quản Lý Sách</span>
          </div>

          <AdminSearchBar
            inputId="adminBookSearchInput"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onSubmit={handleSearch}
            placeholder="Tìm kiếm sách..."
            isSearching={isSearching}
            showReset={!!searchKey}
            onReset={handleResetSearch}
          />
        </div>

        <button onClick={openAddModal} className={`btn btn--admin btn-add`}>
          <i className="fa-solid fa-plus" />
          Thêm Sách
        </button>
      </div>

      <div className={cx('dashboardToolbar')}>
        <div className={cx('dashboardToolbarFilters')}>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Thể loại</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Tất cả</option>
              {categoryOptions.filter(Boolean).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Khuyến mãi</span>
            <select className={cx('dashboardFilterSelect')} value={filterSale} onChange={(e) => setFilterSale(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="yes">Đang giảm giá</option>
              <option value="no">Không KM</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Sắp xếp</span>
            <select className={cx('dashboardFilterSelect')} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Mặc định</option>
              <option value="priceAsc">Giá tăng dần</option>
              <option value="priceDesc">Giá giảm dần</option>
              <option value="soldDesc">Bán chạy nhất</option>
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Nhà xuất bản</span>
            <input
              type="text"
              className={cx('dashboardFilterSelect')}
              placeholder="Lọc theo tên NXB…"
              value={filterPublisher}
              onChange={(e) => setFilterPublisher(e.target.value)}
            />
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Kiểu bìa</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
            >
              {BOOK_FORMAT_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.value === '' ? 'Tất cả' : o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Năm sản xuất</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterProductionYear}
              onChange={(e) => setFilterProductionYear(e.target.value)}
            >
              {productionYearOptions.map((y) => (
                <option key={y || 'all'} value={y}>
                  {y === '' ? 'Tất cả' : y}
                </option>
              ))}
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Series</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterSeriesId}
              onChange={(e) => setFilterSeriesId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Tác giả</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterAuthorId}
              onChange={(e) => setFilterAuthorId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {authorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
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

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-list" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Danh Sách Sách ({filteredBooks.length}
            {filteredBooks.length !== data.length ? ` / ${data.length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('book-table-header')} style={gridStyle}>
            {isActive('product') && <span className={cx('book-col-name')}>Sản Phẩm</span>}
            {isActive('price') && <span className={cx('book-col')}>Giá</span>}
            {isActive('category') && <span className={cx('book-col')}>Thể Loại</span>}
            {isActive('listing') && <span className={cx('book-col')}>Hiển thị web</span>}
            {isActive('discount') && <span className={cx('book-col')}>Khuyến Mãi</span>}
            {isActive('stock') && <span className={cx('book-col')}>Tồn kho</span>}
            {isActive('sold') && <span className={cx('book-col')}>Đã Bán</span>}
            {isActive('rating') && <span className={cx('book-col')}>Đánh Giá</span>}
            {isActive('favourite') && <span className={cx('book-col')}>Yêu Thích</span>}
            {isActive('action') && <span className={cx('book-col-action')}>Thao Tác</span>}
          </div>

          {data.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-book" />
              <p>Chưa có sách nào</p>
              <p className="empty-desc">Nhấn &quot;Thêm Sách&quot; để tạo sách mới</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có sách khớp bộ lọc</p>
              <p className="empty-desc">Thử đổi thể loại hoặc điều kiện khuyến mãi</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => {
              const categoryName =
                item.category && typeof item.category === 'object'
                  ? item.category.name
                  : '—';
              const listDong = listPriceVnd(item.price);
              const discountedDong =
                item.discount > 0
                  ? Math.max(0, Math.ceil(listDong * (1 - item.discount / 100)))
                  : listDong;

              return (
                <div
                  key={item._id || idx}
                  className={cx('book-table-row')}
                  style={{ ...gridStyle, animationDelay: `${idx * 0.04}s` }}
                >
                  {isActive('product') && (
                    <div className={cx('book-col-name')}>
                      <img
                        src={item.img || item.image || 'https://via.placeholder.com/48x56'}
                        alt={item.name}
                        className={cx('product-img')}
                        onError={(e) => (e.target.src = 'https://via.placeholder.com/48x56?text=No+Img')}
                      />
                      <span className={cx('product-title')}>{item.name}</span>
                    </div>
                  )}

                  {isActive('price') && (
                    <span className={cx('book-col')}>
                      <span style={{ color: '#2dd4bf', fontWeight: 600, fontSize: '1.4rem' }}>
                        {formatVndDisplay(discountedDong)}
                      </span>
                      {item.discount > 0 && (
                        <span
                          style={{
                            fontSize: '1.1rem',
                            color: '#94a3b8',
                            textDecoration: 'line-through',
                            marginLeft: 4,
                          }}
                        >
                          {formatVndDisplay(listDong)}
                        </span>
                      )}
                    </span>
                  )}

                  {isActive('category') && (
                    <span className={cx('book-col')} style={{ color: '#64748b', fontSize: '1.35rem' }}>
                      {categoryName}
                    </span>
                  )}

                  {isActive('listing') && (
                    <span className={cx('book-col')} style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                      <span
                        title={
                          item.publishedAt
                            ? `Xuất bản: ${new Date(item.publishedAt).toLocaleString('vi-VN')}`
                            : undefined
                        }
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 8,
                          background:
                            (item.status || '') === 'published'
                              ? 'rgba(16,185,129,0.15)'
                              : (item.status || '') === 'draft'
                                ? 'rgba(148,163,184,0.2)'
                                : (item.status || '') === 'unlisted'
                                  ? 'rgba(245,158,11,0.2)'
                                  : 'rgba(239,68,68,0.12)',
                          color: '#334155',
                        }}
                      >
                        {listingLabel(item.status)}
                      </span>
                    </span>
                  )}

                  {isActive('discount') && (
                    <span className={cx('book-col')}>
                      {item.discount > 0 ? (
                        <span className={cx('discount')}>-{item.discount}%</span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </span>
                  )}

                  {isActive('stock') && (
                    <span className={cx('book-col')} title="Số lượng còn khi đang quản lý tồn theo SL">
                      {typeof item.stock === 'number' && !Number.isNaN(item.stock) ? (
                        <span style={{ fontWeight: 600, color: item.stock <= (item.minStock ?? 5) ? '#b45309' : '#334155' }}>
                          {item.stock}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </span>
                  )}

                  {isActive('sold') && (
                    <span className={cx('book-col')}>
                      <span className={cx('sold-badge')}>{item.sold ?? 0}</span>
                    </span>
                  )}

                  {isActive('rating') && (
                    <span className={cx('book-col')}>
                      {item.evaluate ? (
                        <span className={cx('rating-stars')}>
                          <i className="fa-solid fa-star" />
                          {item.evaluate}
                        </span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </span>
                  )}

                  {isActive('favourite') && (
                    <span className={cx('book-col')}>
                      {item.isFavourite ? (
                        <i className="fa-solid fa-heart" style={{ color: '#ef4444', fontSize: '1.5rem' }} />
                      ) : (
                        <i className="fa-regular fa-heart" style={{ color: '#d1d5db', fontSize: '1.5rem' }} />
                      )}
                    </span>
                  )}

                  {isActive('action') && (
                    <div className={cx('book-col-action')}>
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
          {listPrefs.paginationEnabled && filteredBooks.length > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredBooks.length}
              pageSize={listPrefs.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <AdminColumnSettingsPanel
        open={showColSettings}
        onClose={() => setShowColSettings(false)}
        title="Cột bảng — Quản lý sách"
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {bookFormOpen && (
        <BookFormModal
          key={editingBook?._id || 'add'}
          book={editingBook}
          onClose={closeBookForm}
          onSuccess={handleBookFormSuccess}
        />
      )}
    </div>
  );
}

export default ManageBook;
