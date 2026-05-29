import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { toast } from 'react-toastify';
import adminStyles from '../../components/Layout/AdminLayout/Admin.module.scss';
import voucherStyles from '../ManageVoucher/ManageVoucher.module.scss';
import pageStyles from './ManageFlashSale.module.scss';
import {
  adminListFlashSales,
  adminCreateFlashSale,
  adminUpdateFlashSale,
  adminDeleteFlashSale,
} from '../../app/api/FlashSaleApi';
import { getBookList } from '../../app/api/siteApi';
import { formatVndDisplay, listPriceVnd, salePriceDisplayVnd } from '../../components/function/function.js';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import { matchesVietnameseSearch } from '../../utils/vietnameseSearch.js';

import { resolveMediaUrl } from '../../config/api';

const cx = classNames.bind({ ...adminStyles, ...voucherStyles, ...pageStyles });

const STATUS_LABEL = {
  live: { text: 'Đang chạy', cls: 'statusLive' },
  scheduled: { text: 'Đã lên lịch', cls: 'statusScheduled' },
  ended: { text: 'Đã kết thúc', cls: 'statusEnded' },
  inactive: { text: 'Đã tắt', cls: 'statusInactive' },
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Convert ISO date → format "YYYY-MM-DDTHH:mm" cho input datetime-local */
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatRange(startsAt, endsAt) {
  const s = startsAt ? new Date(startsAt) : null;
  const e = endsAt ? new Date(endsAt) : null;
  const fmt = (d) =>
    d ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  return `${fmt(s)}  →  ${fmt(e)}`;
}

function resolveBookImage(book) {
  const raw = book?.img || book?.image || book?.thumbnail || '';
  return resolveMediaUrl(String(raw || '').trim());
}

const EMPTY_FORM = {
  _id: '',
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  active: true,
  items: [],
};

function ManageFlashSale() {
  const [sales, setSales] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterText, setFilterText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookPickerSearch, setBookPickerSearch] = useState('');
  const [bookPickerDraft, setBookPickerDraft] = useState({});
  const [bookFilterCategory, setBookFilterCategory] = useState('');
  const [bookFilterSale, setBookFilterSale] = useState('all');
  const [bookFilterPublisher, setBookFilterPublisher] = useState('');
  const [bookFilterFormat, setBookFilterFormat] = useState('');
  const [bookFilterProductionYear, setBookFilterProductionYear] = useState('');
  const [bookFilterSeriesId, setBookFilterSeriesId] = useState('');
  const [bookFilterAuthorId, setBookFilterAuthorId] = useState('');
  const [bookFilterSort, setBookFilterSort] = useState('default');
  const [bulkDiscount, setBulkDiscount] = useState(20);

  const reloadSales = useCallback(async () => {
    const rows = await adminListFlashSales();
    setSales(rows);
  }, []);

  const reloadBooks = useCallback(async () => {
    const rows = await getBookList();
    setBooks(rows);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([reloadSales(), reloadBooks()]);
      } catch {
        toast.error('Không tải được dữ liệu flash sale');
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadSales, reloadBooks]);

  const bookById = useMemo(() => {
    const map = new Map();
    for (const b of books || []) map.set(String(b._id), b);
    return map;
  }, [books]);

  const filteredSales = useMemo(() => {
    let rows = [...sales];
    if (filterStatus !== 'all') rows = rows.filter((s) => s.status === filterStatus);
    const q = String(filterText || '').trim();
    if (q) {
      rows = rows.filter(
        (s) =>
          matchesVietnameseSearch(s.title, q) ||
          matchesVietnameseSearch(s.description, q),
      );
    }
    return rows;
  }, [sales, filterStatus, filterText]);

  const stats = useMemo(() => {
    const c = { live: 0, scheduled: 0, ended: 0, inactive: 0 };
    for (const s of sales) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [sales]);

  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEditModal = (sale) => {
    setForm({
      _id: sale._id,
      title: sale.title || '',
      description: sale.description || '',
      startsAt: toLocalInputValue(sale.startsAt),
      endsAt: toLocalInputValue(sale.endsAt),
      active: sale.active !== false,
      items: (sale.items || []).map((it) => ({
        bookId: String(it.bookId?._id || it.bookId),
        discountPercent: Number(it.discountPercent) || 0,
      })),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm({ ...EMPTY_FORM });
  };

  const openBookPicker = () => {
    const draft = {};
    for (const it of form.items || []) draft[String(it.bookId)] = Number(it.discountPercent) || 10;
    setBookPickerDraft(draft);
    setBookPickerSearch('');
    setBookFilterCategory('');
    setBookFilterSale('all');
    setBookFilterPublisher('');
    setBookFilterFormat('');
    setBookFilterProductionYear('');
    setBookFilterSeriesId('');
    setBookFilterAuthorId('');
    setBookFilterSort('default');
    setBookPickerOpen(true);
  };

  const toggleBookInPicker = (bookId, on) => {
    setBookPickerDraft((prev) => {
      const next = { ...prev };
      if (on) {
        if (next[bookId] == null) next[bookId] = 10;
      } else {
        delete next[bookId];
      }
      return next;
    });
  };

  const updateBookPickerDiscount = (bookId, value) => {
    const v = Math.max(1, Math.min(99, Math.round(Number(value) || 0)));
    setBookPickerDraft((prev) => ({ ...prev, [bookId]: v }));
  };

  const saveBookPicker = () => {
    const items = Object.entries(bookPickerDraft).map(([bookId, discountPercent]) => ({
      bookId,
      discountPercent: Math.max(1, Math.min(99, Math.round(Number(discountPercent) || 0))),
    }));
    setForm((prev) => ({ ...prev, items }));
    setBookPickerOpen(false);
  };

  const updateItemDiscount = (bookId, value) => {
    const v = Math.max(1, Math.min(99, Math.round(Number(value) || 0)));
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.bookId === bookId ? { ...it, discountPercent: v } : it)),
    }));
  };

  const removeItem = (bookId) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((it) => it.bookId !== bookId) }));
  };

  const submitForm = async (e) => {
    e?.preventDefault?.();
    if (!form.title.trim()) {
      toast.error('Cần nhập tiêu đề');
      return;
    }
    if (!form.startsAt || !form.endsAt) {
      toast.error('Chọn thời gian bắt đầu và kết thúc');
      return;
    }
    const startMs = new Date(form.startsAt).getTime();
    const endMs = new Date(form.endsAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      toast.error('Thời gian không hợp lệ');
      return;
    }
    if (endMs <= startMs) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    if ((form.items || []).length === 0) {
      toast.error('Cần chọn ít nhất một cuốn sách');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      active: !!form.active,
      items: form.items.map((it) => ({
        bookId: it.bookId,
        discountPercent: Number(it.discountPercent),
      })),
    };
    try {
      if (form._id) {
        await adminUpdateFlashSale(form._id, payload);
        toast.success('Đã cập nhật flash sale');
      } else {
        await adminCreateFlashSale(payload);
        toast.success('Đã tạo flash sale');
      }
      await reloadSales();
      closeModal();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Lưu flash sale thất bại';
      toast.error(msg);
    }
  };

  const toggleActive = async (sale) => {
    try {
      await adminUpdateFlashSale(sale._id, { active: !sale.active });
      toast.success(sale.active ? 'Đã tắt flash sale' : 'Đã bật flash sale');
      await reloadSales();
    } catch {
      toast.error('Không cập nhật được trạng thái');
    }
  };

  const removeSale = async (sale) => {
    if (!window.confirm(`Xóa flash sale "${sale.title}"?`)) return;
    try {
      await adminDeleteFlashSale(sale._id);
      toast.success('Đã xóa flash sale');
      await reloadSales();
    } catch {
      toast.error('Xóa thất bại');
    }
  };

  const categoryOptions = useMemo(() => {
    const names = new Set();
    for (const b of books || []) {
      const n = b.category && typeof b.category === 'object' ? b.category.name : '';
      if (n) names.add(n);
    }
    return ['', ...[...names].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [books]);

  const productionYearOptions = useMemo(() => {
    const ys = new Set();
    for (const b of books || []) {
      if (b.productionYear != null && !Number.isNaN(Number(b.productionYear))) ys.add(Number(b.productionYear));
    }
    return ['', ...[...ys].sort((a, b) => b - a)];
  }, [books]);

  const seriesOptions = useMemo(() => {
    const map = new Map();
    for (const b of books || []) {
      const s = b.series;
      if (!s) continue;
      const id = typeof s === 'object' && s._id != null ? String(s._id) : String(s);
      const name = typeof s === 'object' && s.name ? String(s.name) : id;
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [books]);

  const authorOptions = useMemo(() => {
    const map = new Map();
    for (const b of books || []) {
      const a = b.authorRef;
      if (!a) continue;
      const id = typeof a === 'object' && a._id != null ? String(a._id) : String(a);
      const name = typeof a === 'object' && a.name ? String(a.name) : (b.author && String(b.author).trim()) || id;
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [books]);

  const visibleBooks = useMemo(() => {
    let rows = [...books];
    const q = String(bookPickerSearch || '').trim();
    if (q) rows = rows.filter((b) => matchesVietnameseSearch(b.name, q));
    if (bookFilterCategory) {
      rows = rows.filter((b) => (b.category && typeof b.category === 'object' ? b.category.name : '') === bookFilterCategory);
    }
    if (bookFilterSale === 'yes') rows = rows.filter((b) => (Number(b.discount) || 0) > 0);
    if (bookFilterSale === 'no') rows = rows.filter((b) => !b.discount || Number(b.discount) <= 0);
    const pubQ = bookFilterPublisher.trim();
    if (pubQ) rows = rows.filter((b) => matchesVietnameseSearch(b.publisher, pubQ));
    if (bookFilterFormat) rows = rows.filter((b) => String(b.format || '') === bookFilterFormat);
    if (bookFilterProductionYear) rows = rows.filter((b) => Number(b.productionYear) === Number(bookFilterProductionYear));
    if (bookFilterSeriesId) {
      rows = rows.filter((b) => {
        const s = b.series;
        const id = s && typeof s === 'object' && s._id != null ? String(s._id) : s != null ? String(s) : '';
        return id === bookFilterSeriesId;
      });
    }
    if (bookFilterAuthorId) {
      rows = rows.filter((b) => {
        const a = b.authorRef;
        const id = a && typeof a === 'object' && a._id != null ? String(a._id) : a != null ? String(a) : '';
        return id === bookFilterAuthorId;
      });
    }
    if (bookFilterSort === 'priceAsc') rows.sort((a, b) => Number(a.price) - Number(b.price));
    if (bookFilterSort === 'priceDesc') rows.sort((a, b) => Number(b.price) - Number(a.price));
    if (bookFilterSort === 'nameAsc') rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
    return rows;
  }, [
    books,
    bookPickerSearch,
    bookFilterCategory,
    bookFilterSale,
    bookFilterPublisher,
    bookFilterFormat,
    bookFilterProductionYear,
    bookFilterSeriesId,
    bookFilterAuthorId,
    bookFilterSort,
  ]);

  const resetBookFilters = () => {
    setBookPickerSearch('');
    setBookFilterCategory('');
    setBookFilterSale('all');
    setBookFilterPublisher('');
    setBookFilterFormat('');
    setBookFilterProductionYear('');
    setBookFilterSeriesId('');
    setBookFilterAuthorId('');
    setBookFilterSort('default');
  };

  const applyBulkDiscount = () => {
    const v = Math.max(1, Math.min(99, Math.round(Number(bulkDiscount) || 0)));
    setBookPickerDraft((prev) => {
      const next = {};
      for (const id of Object.keys(prev)) next[id] = v;
      return next;
    });
  };

  const selectAllVisible = () => {
    const v = Math.max(1, Math.min(99, Math.round(Number(bulkDiscount) || 10)));
    setBookPickerDraft((prev) => {
      const next = { ...prev };
      for (const b of visibleBooks) {
        const id = String(b._id);
        if (next[id] == null) next[id] = v;
      }
      return next;
    });
  };

  const clearAllSelection = () => setBookPickerDraft({});

  return (
    <div className={cx('page-content', 'flashPage')}>
      <div className={cx('admin-nav')}>
        <div className={cx('admin-title')}>
          <i className="fa-solid fa-bolt" />
          <span className={cx('admin-title-name')}>Quản lý Flash Sale</span>
        </div>
        <button type="button" className={cx('flashBtn', 'flashBtnPrimary')} onClick={openCreateModal}>
          <i className="fa-solid fa-plus" /> Tạo flash sale
        </button>
      </div>

      {loading ? (
        <p className={cx('loadingText')}>Đang tải dữ liệu flash sale...</p>
      ) : (
        <>
          <div className={cx('statRow', 'cardAnim')}>
            <div className={cx('statCard', 'statCardLive')}>
              <i className="fa-solid fa-bolt" />
              <div>
                <div className={cx('statValue')}>{stats.live || 0}</div>
                <div className={cx('statLabel')}>Đang chạy</div>
              </div>
            </div>
            <div className={cx('statCard', 'statCardScheduled')}>
              <i className="fa-solid fa-calendar-day" />
              <div>
                <div className={cx('statValue')}>{stats.scheduled || 0}</div>
                <div className={cx('statLabel')}>Đã lên lịch</div>
              </div>
            </div>
            <div className={cx('statCard', 'statCardEnded')}>
              <i className="fa-solid fa-flag-checkered" />
              <div>
                <div className={cx('statValue')}>{stats.ended || 0}</div>
                <div className={cx('statLabel')}>Đã kết thúc</div>
              </div>
            </div>
            <div className={cx('statCard', 'statCardInactive')}>
              <i className="fa-solid fa-pause" />
              <div>
                <div className={cx('statValue')}>{stats.inactive || 0}</div>
                <div className={cx('statLabel')}>Đã tắt</div>
              </div>
            </div>
          </div>

          <div className={cx('flashPanel', 'cardAnim')}>
            <div className={cx('panelHeader')}>
              <h3 className={cx('sectionTitle')}>Danh sách flash sale</h3>
              <div className={cx('panelFilters')}>
                <input
                  className={cx('input')}
                  placeholder="Tìm theo tiêu đề / mô tả..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
                <select
                  className={cx('select-admin')}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="live">Đang chạy</option>
                  <option value="scheduled">Đã lên lịch</option>
                  <option value="ended">Đã kết thúc</option>
                  <option value="inactive">Đã tắt</option>
                </select>
              </div>
            </div>

            {filteredSales.length === 0 ? (
              <div className={cx('emptyState')}>
                <i className="fa-solid fa-bolt-lightning" />
                <p>Chưa có flash sale phù hợp. Hãy tạo mới để bắt đầu khuyến mãi!</p>
              </div>
            ) : (
              <div className={cx('saleList')}>
                {filteredSales.map((sale) => {
                  const status = STATUS_LABEL[sale.status] || STATUS_LABEL.scheduled;
                  return (
                    <div key={sale._id} className={cx('saleCard', `saleCard--${sale.status}`)}>
                      <div className={cx('saleHead')}>
                        <div>
                          <h4 className={cx('saleTitle')}>{sale.title}</h4>
                          {sale.description && <p className={cx('saleDesc')}>{sale.description}</p>}
                        </div>
                        <span className={cx('statusBadge', status.cls)}>{status.text}</span>
                      </div>
                      <div className={cx('saleMetaRow')}>
                        <div className={cx('saleMetaItem')}>
                          <i className="fa-regular fa-clock" />
                          <span>{formatRange(sale.startsAt, sale.endsAt)}</span>
                        </div>
                        <div className={cx('saleMetaItem')}>
                          <i className="fa-solid fa-book" />
                          <span>{sale.items?.length || 0} sách áp dụng</span>
                        </div>
                      </div>
                      <div className={cx('saleItems')}>
                        {(sale.items || []).slice(0, 6).map((it) => {
                          const b = it.bookId && typeof it.bookId === 'object' ? it.bookId : bookById.get(String(it.bookId));
                          if (!b) return null;
                          const list = listPriceVnd(b.price);
                          const sale1 = salePriceDisplayVnd(b.price, it.discountPercent);
                          const img = resolveBookImage(b);
                          return (
                            <div key={`${sale._id}-${it.bookId?._id || it.bookId}`} className={cx('saleItemCard')}>
                              {img ? (
                                <img src={img} alt={b.name} className={cx('saleItemImg')} />
                              ) : (
                                <div className={cx('saleItemImgFallback')}>
                                  <i className="fa-solid fa-book" />
                                </div>
                              )}
                              <div className={cx('saleItemInfo')}>
                                <div className={cx('saleItemName')}>{b.name}</div>
                                <div className={cx('saleItemPriceRow')}>
                                  <span className={cx('saleItemDiscount')}>-{it.discountPercent}%</span>
                                  <span className={cx('saleItemSale')}>{formatVndDisplay(sale1)}</span>
                                  <span className={cx('saleItemList')}>{formatVndDisplay(list)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(sale.items?.length || 0) > 6 && (
                          <div className={cx('saleItemMore')}>+{sale.items.length - 6} sách khác</div>
                        )}
                      </div>
                      <div className={cx('saleActions')}>
                        <button type="button" className={cx('flashBtn', 'flashBtnSecondary')} onClick={() => openEditModal(sale)}>
                          <i className="fa-solid fa-pen-to-square" /> Sửa
                        </button>
                        <button
                          type="button"
                          className={cx('toggleBtn', { toggleBtnOff: !sale.active })}
                          onClick={() => toggleActive(sale)}
                        >
                          <i className={`fa-solid ${sale.active ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
                          {sale.active ? 'Đang bật' : 'Đang tắt'}
                        </button>
                        <button type="button" className={cx('dangerBtn')} onClick={() => removeSale(sale)}>
                          <i className="fa-solid fa-trash" /> Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <div className={cx('modalOverlay')} onClick={closeModal}>
          <div className={cx('modalCard')} onClick={(e) => e.stopPropagation()}>
            <div className={cx('modalHeader')}>
              <h3>{form._id ? 'Chỉnh sửa flash sale' : 'Tạo flash sale mới'}</h3>
              <button type="button" className={cx('iconBtn')} onClick={closeModal}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form className={cx('flashForm')} onSubmit={submitForm}>
              <label className={cx('fieldGroup', 'fullCol')}>
                <span>Tiêu đề chương trình</span>
                <input
                  className={cx('input')}
                  placeholder="Ví dụ: Flash sale tối thứ 6"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className={cx('fieldGroup', 'fullCol')}>
                <span>Mô tả ngắn (tuỳ chọn)</span>
                <input
                  className={cx('input')}
                  placeholder="Ví dụ: Giảm sốc 20-50% các tựa sách hot nhất"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <label className={cx('fieldGroup')}>
                <span>Giờ bắt đầu</span>
                <input
                  className={cx('input')}
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </label>
              <label className={cx('fieldGroup')}>
                <span>Giờ kết thúc</span>
                <input
                  className={cx('input')}
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>
              <label className={cx('switchRow', 'fullCol')}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>Bật flash sale này (tắt nếu chỉ muốn lưu nháp)</span>
              </label>

              <div className={cx('itemsHeader', 'fullCol')}>
                <h4>Sách áp dụng ({form.items.length})</h4>
                <button type="button" className={cx('flashBtn', 'flashBtnPick')} onClick={openBookPicker}>
                  <i className="fa-solid fa-book-open-reader" /> Chọn sách
                </button>
              </div>

              <div className={cx('itemsList', 'fullCol')}>
                {form.items.length === 0 ? (
                  <div className={cx('itemsEmpty')}>
                    Chưa có sách nào. Bấm "Chọn sách" để thêm vào flash sale.
                  </div>
                ) : (
                  form.items.map((it) => {
                    const b = bookById.get(String(it.bookId));
                    if (!b) {
                      return (
                        <div key={it.bookId} className={cx('itemRow')}>
                          <div className={cx('itemInfo')}>Sách không tồn tại ({it.bookId})</div>
                          <button type="button" className={cx('iconBtn')} onClick={() => removeItem(it.bookId)}>
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      );
                    }
                    const img = resolveBookImage(b);
                    const list = listPriceVnd(b.price);
                    const sale = salePriceDisplayVnd(b.price, it.discountPercent);
                    return (
                      <div key={it.bookId} className={cx('itemRow')}>
                        {img ? (
                          <img src={img} alt={b.name} className={cx('itemImg')} />
                        ) : (
                          <div className={cx('itemImgFallback')}>
                            <i className="fa-solid fa-book" />
                          </div>
                        )}
                        <div className={cx('itemInfo')}>
                          <div className={cx('itemName')}>{b.name}</div>
                          <div className={cx('itemPriceRow')}>
                            <span className={cx('itemPriceSale')}>{formatVndDisplay(sale)}</span>
                            <span className={cx('itemPriceList')}>{formatVndDisplay(list)}</span>
                          </div>
                        </div>
                        <div className={cx('itemPercentBox')}>
                          <input
                            className={cx('percentInput')}
                            type="number"
                            min={1}
                            max={99}
                            value={it.discountPercent}
                            onChange={(e) => updateItemDiscount(it.bookId, e.target.value)}
                          />
                          <span>%</span>
                        </div>
                        <button type="button" className={cx('iconBtn')} onClick={() => removeItem(it.bookId)}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={cx('formActions', 'fullCol')}>
                <button type="button" className={cx('flashBtn', 'flashBtnSecondary')} onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className={cx('flashBtn', 'flashBtnPrimary')}>
                  <i className="fa-solid fa-floppy-disk" /> {form._id ? 'Lưu thay đổi' : 'Tạo flash sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookPickerOpen && (
        <div className={cx('bookModalOverlay')} onClick={() => setBookPickerOpen(false)}>
          <div className={cx('bookModalCard')} onClick={(e) => e.stopPropagation()}>
            <h4>Chọn sách cho flash sale</h4>
            <div className={cx('bookModalToolbar')}>
              <div className={cx('bookFilterGroup', 'bookFilterGroupWide')}>
                <label className={cx('bookFilterLabel')}>Lọc sách theo tên</label>
                <input
                  className={cx('input')}
                  placeholder="Lọc nhanh theo tên sách..."
                  value={bookPickerSearch}
                  onChange={(e) => setBookPickerSearch(e.target.value)}
                />
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Thể loại</label>
                <select className={cx('select-admin')} value={bookFilterCategory} onChange={(e) => setBookFilterCategory(e.target.value)}>
                  <option value="">Tất cả</option>
                  {categoryOptions.filter(Boolean).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Khuyến mãi sẵn có</label>
                <select className={cx('select-admin')} value={bookFilterSale} onChange={(e) => setBookFilterSale(e.target.value)}>
                  <option value="all">Tất cả</option>
                  <option value="yes">Đang giảm giá</option>
                  <option value="no">Không KM</option>
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Nhà xuất bản</label>
                <input className={cx('input')} placeholder="Lọc theo NXB..." value={bookFilterPublisher} onChange={(e) => setBookFilterPublisher(e.target.value)} />
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Kiểu bìa</label>
                <select className={cx('select-admin')} value={bookFilterFormat} onChange={(e) => setBookFilterFormat(e.target.value)}>
                  {BOOK_FORMAT_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.value === '' ? 'Tất cả' : o.label}</option>
                  ))}
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Năm sản xuất</label>
                <select className={cx('select-admin')} value={bookFilterProductionYear} onChange={(e) => setBookFilterProductionYear(e.target.value)}>
                  {productionYearOptions.map((y) => (
                    <option key={y || 'all'} value={y}>{y === '' ? 'Tất cả' : y}</option>
                  ))}
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Series</label>
                <select className={cx('select-admin')} value={bookFilterSeriesId} onChange={(e) => setBookFilterSeriesId(e.target.value)}>
                  <option value="">Tất cả</option>
                  {seriesOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Tác giả</label>
                <select className={cx('select-admin')} value={bookFilterAuthorId} onChange={(e) => setBookFilterAuthorId(e.target.value)}>
                  <option value="">Tất cả</option>
                  {authorOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className={cx('bookFilterGroup')}>
                <label className={cx('bookFilterLabel')}>Sắp xếp</label>
                <select className={cx('select-admin')} value={bookFilterSort} onChange={(e) => setBookFilterSort(e.target.value)}>
                  <option value="default">Mặc định</option>
                  <option value="nameAsc">Tên A-Z</option>
                  <option value="priceAsc">Giá tăng dần</option>
                  <option value="priceDesc">Giá giảm dần</option>
                </select>
              </div>
              <button type="button" className={cx('resetBookFiltersBtn')} onClick={resetBookFilters}>
                <i className="fa-solid fa-rotate-left" /> Reset filter
              </button>
            </div>

            <div className={cx('bulkBar')}>
              <span className={cx('bulkLabel')}>
                <i className="fa-solid fa-bolt" /> Áp nhanh % giảm cho mọi sách đang chọn:
              </span>
              <div className={cx('bulkInputBox')}>
                <input
                  className={cx('bulkInput')}
                  type="number"
                  min={1}
                  max={99}
                  value={bulkDiscount}
                  onChange={(e) => setBulkDiscount(e.target.value)}
                />
                <span>%</span>
              </div>
              <button type="button" className={cx('bulkBtn')} onClick={applyBulkDiscount}>
                Áp dụng cho danh sách đã chọn
              </button>
              <button type="button" className={cx('bulkBtn', 'bulkBtnGhost')} onClick={selectAllVisible}>
                <i className="fa-solid fa-check-double" /> Chọn hết sách hiển thị
              </button>
              <button type="button" className={cx('bulkBtn', 'bulkBtnGhost')} onClick={clearAllSelection}>
                <i className="fa-solid fa-eraser" /> Bỏ chọn tất cả
              </button>
            </div>

            <p className={cx('bookFilterMeta')}>
              Hiển thị {visibleBooks.length}/{books.length} sách · Đã chọn {Object.keys(bookPickerDraft).length} cho flash sale
            </p>
            <div className={cx('bookModalList')}>
              {visibleBooks.length === 0 && (
                <div className={cx('bookEmptyState')}>
                  Không tìm thấy sách phù hợp với bộ lọc.
                </div>
              )}
              {visibleBooks.map((b) => {
                const id = String(b._id);
                const checked = Object.prototype.hasOwnProperty.call(bookPickerDraft, id);
                const listPrice = listPriceVnd(b.price);
                const flashDisc = checked ? bookPickerDraft[id] : Number(b.discount) || 10;
                const flashPrice = salePriceDisplayVnd(b.price, flashDisc);
                const baseSale = salePriceDisplayVnd(b.price, b.discount);
                const hasBaseDiscount = Number(b.discount) > 0 && baseSale < listPrice;
                const imageSrc = resolveBookImage(b);
                return (
                  <label key={id} className={cx('bookCheckRow', { bookCheckRowOn: checked })}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleBookInPicker(id, e.target.checked)}
                    />
                    <div className={cx('bookInfo')}>
                      {imageSrc ? (
                        <img className={cx('bookThumb')} src={imageSrc} alt={b.name || 'book'} />
                      ) : (
                        <div className={cx('bookThumbFallback')}>
                          <i className="fa-solid fa-book-open" />
                        </div>
                      )}
                      <div className={cx('bookMeta')}>
                        <div className={cx('bookTitle')}>{b.name || 'Không có tiêu đề'}</div>
                        <div className={cx('bookPriceRow')}>
                          {hasBaseDiscount ? (
                            <>
                              <span className={cx('bookPriceSale')}>{formatVndDisplay(baseSale)}</span>
                              <span className={cx('bookPriceOriginal')}>{formatVndDisplay(listPrice)}</span>
                              <span className={cx('bookDiscountTag')}>-{Number(b.discount)}%</span>
                            </>
                          ) : (
                            <span className={cx('bookPriceSale')}>{formatVndDisplay(listPrice)}</span>
                          )}
                        </div>
                        {checked && (
                          <div className={cx('flashPreviewRow')}>
                            <i className="fa-solid fa-bolt" />
                            <span className={cx('flashPreviewLabel')}>Giá sau flash sale:</span>
                            <span className={cx('flashPreviewPrice')}>{formatVndDisplay(flashPrice)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={cx('flashPercentBox', { flashPercentBoxOff: !checked })}>
                      <label className={cx('flashPercentLabel')}>% giảm flash</label>
                      <div className={cx('flashPercentInputWrap')}>
                        <input
                          className={cx('flashPercentInput')}
                          type="number"
                          min={1}
                          max={99}
                          disabled={!checked}
                          value={flashDisc}
                          onChange={(e) => updateBookPickerDiscount(id, e.target.value)}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className={cx('bookModalActions', 'bookModalActionsStickyBottom')}>
              <button type="button" className={cx('flashBtn', 'flashBtnSecondary')} onClick={() => setBookPickerOpen(false)}>
                Hủy
              </button>
              <button type="button" className={cx('flashBtn', 'flashBtnPrimary')} onClick={saveBookPicker}>
                <i className="fa-solid fa-check" /> Lưu danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageFlashSale;
