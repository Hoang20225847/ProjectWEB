import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { toast } from 'react-toastify';
import adminStyles from '../../components/Layout/AdminLayout/Admin.module.scss';
import pageStyles from './ManageVoucher.module.scss';
import axios from '../../components/axios/axios.customize.js';
import { formatVndDisplay, listPriceVnd, salePriceDisplayVnd } from '../../components/function/function.js';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import { resolveMediaUrl } from '../../config/api';

const cx = classNames.bind({ ...adminStyles, ...pageStyles });

function ManageVoucher() {
  const [tiers, setTiers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vForm, setVForm] = useState({
    code: '',
    title: '',
    discountType: 'percent',
    discountValue: 10,
    maxDiscountDong: '',
    minOrderDong: 0,
    endsAt: '',
    maxRedemptions: '',
    visibility: 'public',
    audienceType: 'all',
    tierSlugs: [],
    applyAllBooks: true,
    eligibleBookIds: [],
  });
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookModalDraft, setBookModalDraft] = useState([]);
  const [bookModalSearch, setBookModalSearch] = useState('');
  const [bookModalApplyAll, setBookModalApplyAll] = useState(false);
  const [bookFilterCategory, setBookFilterCategory] = useState('');
  const [bookFilterSale, setBookFilterSale] = useState('all');
  const [bookFilterPublisher, setBookFilterPublisher] = useState('');
  const [bookFilterFormat, setBookFilterFormat] = useState('');
  const [bookFilterProductionYear, setBookFilterProductionYear] = useState('');
  const [bookFilterSeriesId, setBookFilterSeriesId] = useState('');
  const [bookFilterAuthorId, setBookFilterAuthorId] = useState('');
  const [bookFilterSort, setBookFilterSort] = useState('default');
  const [editingVoucherId, setEditingVoucherId] = useState('');
  const [voucherFilters, setVoucherFilters] = useState({
    code: '',
    visibility: '',
    audienceType: '',
    active: '',
    endsBefore: '',
    endsAfter: '',
  });

  const loadTiers = useCallback(async () => {
    const rows = await axios.get('/api/membership/admin/tiers');
    setTiers(Array.isArray(rows) ? rows : []);
  }, []);

  const loadBooks = useCallback(async () => {
    const rows = await axios.get('/api/books');
    setBooks(Array.isArray(rows) ? rows : []);
  }, []);

  const loadVouchers = useCallback(async () => {
    const params = {};
    if (voucherFilters.code.trim()) params.code = voucherFilters.code.trim();
    if (voucherFilters.visibility) params.visibility = voucherFilters.visibility;
    if (voucherFilters.audienceType) params.audienceType = voucherFilters.audienceType;
    if (voucherFilters.active !== '') params.active = voucherFilters.active;
    if (voucherFilters.endsBefore) params.endsBefore = new Date(voucherFilters.endsBefore).toISOString();
    if (voucherFilters.endsAfter) params.endsAfter = new Date(voucherFilters.endsAfter).toISOString();
    const rows = await axios.get('/api/membership/admin/vouchers', { params });
    setVouchers(Array.isArray(rows) ? rows : []);
  }, [voucherFilters]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadTiers(), loadBooks(), loadVouchers()]);
      } catch {
        toast.error('Không tải được dữ liệu voucher');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTiers, loadBooks, loadVouchers]);

  const toggleTierSlug = (slug, checked) => {
    setVForm((prev) => {
      const set = new Set(prev.tierSlugs || []);
      if (checked) set.add(slug);
      else set.delete(slug);
      return { ...prev, tierSlugs: [...set] };
    });
  };

  const createVoucher = async (e) => {
    e.preventDefault();
    if (!vForm.code.trim() || !vForm.title.trim() || !vForm.endsAt) {
      toast.error('Nhập đủ mã, tiêu đề, ngày hết hạn');
      return;
    }
    try {
      await axios.post('/api/membership/admin/vouchers', {
        code: vForm.code.trim(),
        title: vForm.title.trim(),
        discountType: vForm.discountType,
        discountValue: Number(vForm.discountValue),
        maxDiscountDong: vForm.maxDiscountDong === '' ? null : Number(vForm.maxDiscountDong),
        minOrderDong: Number(vForm.minOrderDong) || 0,
        endsAt: new Date(vForm.endsAt).toISOString(),
        maxRedemptions: vForm.maxRedemptions === '' ? null : Number(vForm.maxRedemptions),
        visibility: vForm.visibility,
        audienceType: vForm.audienceType,
        tierSlugs: vForm.audienceType === 'tiers' ? vForm.tierSlugs : [],
        applyAllBooks: !!vForm.applyAllBooks,
        eligibleBookIds: vForm.applyAllBooks ? [] : vForm.eligibleBookIds,
        active: true,
        startsAt: new Date().toISOString(),
      });
      toast.success('Đã tạo voucher');
      setVForm((prev) => ({
        ...prev,
        code: '',
        title: '',
        maxDiscountDong: '',
        tierSlugs: [],
        applyAllBooks: true,
        eligibleBookIds: [],
      }));
      await loadVouchers();
    } catch {
      toast.error('Tạo voucher thất bại (mã có thể bị trùng)');
    }
  };

  const openBookPickerForCreate = () => {
    setEditingVoucherId('');
    setBookModalSearch('');
    setBookModalApplyAll(!!vForm.applyAllBooks);
    setBookModalDraft(vForm.applyAllBooks ? books.map((b) => String(b._id)) : (vForm.eligibleBookIds || []));
    setBookModalOpen(true);
  };

  const openBookPickerForEdit = (voucher) => {
    setEditingVoucherId(String(voucher._id));
    const applyAll = !!voucher.applyAllBooks;
    setBookModalSearch('');
    setBookModalApplyAll(applyAll);
    setBookModalDraft(applyAll ? books.map((b) => String(b._id)) : (voucher.eligibleBookIds || []).map((b) => String(b._id || b)));
    setBookModalOpen(true);
  };

  const resetBookFilters = () => {
    setBookModalSearch('');
    setBookFilterCategory('');
    setBookFilterSale('all');
    setBookFilterPublisher('');
    setBookFilterFormat('');
    setBookFilterProductionYear('');
    setBookFilterSeriesId('');
    setBookFilterAuthorId('');
    setBookFilterSort('default');
  };

  const saveBookPicker = async () => {
    if (!editingVoucherId) {
      setVForm((prev) => ({
        ...prev,
        applyAllBooks: bookModalApplyAll,
        eligibleBookIds: bookModalApplyAll ? books.map((b) => String(b._id)) : bookModalDraft,
      }));
      setBookModalOpen(false);
      return;
    }
    try {
      await axios.put(`/api/membership/admin/vouchers/${editingVoucherId}`, {
        applyAllBooks: bookModalApplyAll,
        eligibleBookIds: bookModalApplyAll ? [] : bookModalDraft,
      });
      toast.success('Đã cập nhật sách áp dụng voucher');
      await loadVouchers();
      setBookModalOpen(false);
    } catch {
      toast.error('Không cập nhật được danh sách sách áp dụng');
    }
  };

  const toggleVoucherActive = async (voucher) => {
    try {
      await axios.put(`/api/membership/admin/vouchers/${voucher._id}`, { active: !voucher.active });
      toast.success(voucher.active ? 'Đã tắt voucher' : 'Đã bật voucher');
      await loadVouchers();
    } catch {
      toast.error('Không cập nhật được trạng thái voucher');
    }
  };

  const selectedBookCount = useMemo(
    () => (vForm.applyAllBooks ? 0 : (vForm.eligibleBookIds || []).length),
    [vForm.applyAllBooks, vForm.eligibleBookIds],
  );

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
    const q = String(bookModalSearch || '').trim().toLowerCase();
    if (q) rows = rows.filter((b) => String(b.name || '').toLowerCase().includes(q));
    if (bookFilterCategory) {
      rows = rows.filter((b) => (b.category && typeof b.category === 'object' ? b.category.name : '') === bookFilterCategory);
    }
    if (bookFilterSale === 'yes') rows = rows.filter((b) => (Number(b.discount) || 0) > 0);
    if (bookFilterSale === 'no') rows = rows.filter((b) => !b.discount || Number(b.discount) <= 0);
    const pubQ = bookFilterPublisher.trim().toLowerCase();
    if (pubQ) rows = rows.filter((b) => String(b.publisher || '').toLowerCase().includes(pubQ));
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
    bookModalSearch,
    bookFilterCategory,
    bookFilterSale,
    bookFilterPublisher,
    bookFilterFormat,
    bookFilterProductionYear,
    bookFilterSeriesId,
    bookFilterAuthorId,
    bookFilterSort,
  ]);

  const resolveBookImage = (book) => {
    const raw =
      book?.img ||
      book?.image ||
      book?.imageUrl ||
      book?.thumbnail ||
      book?.thumb ||
      book?.avatar ||
      '';
    return resolveMediaUrl(String(raw || '').trim());
  };

  return (
    <div className={cx('page-content', 'voucherPage')}>
      <div className={cx('admin-nav')}>
        <div className={cx('admin-title')}>
          <i className="fa-solid fa-ticket" />
          <span className={cx('admin-title-name')}>Quản lý voucher</span>
        </div>
      </div>

      {loading ? (
        <p className={cx('loadingText')}>Đang tải dữ liệu voucher...</p>
      ) : (
        <>
          <div className={cx('voucherPanel', 'cardAnim')}>
            <h3 className={cx('sectionTitle')}>Tạo voucher mới</h3>
            <form className={cx('voucherForm')} onSubmit={createVoucher}>
              <label className={cx('fieldGroup')}><span>Mã voucher</span><input className={cx('input')} placeholder="VD: SUMMER2026" value={vForm.code} onChange={(e) => setVForm({ ...vForm, code: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Tiêu đề voucher</span><input className={cx('input')} placeholder="Ví dụ: Giảm giá mùa hè" value={vForm.title} onChange={(e) => setVForm({ ...vForm, title: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Loại giảm giá</span><select className={cx('select-admin')} value={vForm.discountType} onChange={(e) => setVForm({ ...vForm, discountType: e.target.value })}>
                <option value="percent">Giảm phần trăm (%)</option>
                <option value="fixed">Giảm số tiền cố định (đồng)</option>
              </select></label>
              <label className={cx('fieldGroup')}><span>Giá trị giảm</span><input className={cx('input')} type="number" placeholder="Ví dụ: 10 hoặc 50000" value={vForm.discountValue} onChange={(e) => setVForm({ ...vForm, discountValue: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Giảm tối đa (đồng)</span><input className={cx('input')} type="number" placeholder="Để trống nếu không giới hạn, ví dụ 20000" value={vForm.maxDiscountDong} onChange={(e) => setVForm({ ...vForm, maxDiscountDong: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Đơn tối thiểu (đồng)</span><input className={cx('input')} type="number" placeholder="Ví dụ: 150000" value={vForm.minOrderDong} onChange={(e) => setVForm({ ...vForm, minOrderDong: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Ngày hết hạn</span><input className={cx('input')} type="datetime-local" value={vForm.endsAt} onChange={(e) => setVForm({ ...vForm, endsAt: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Giới hạn lượt dùng</span><input className={cx('input')} type="number" placeholder="Để trống = không giới hạn" value={vForm.maxRedemptions} onChange={(e) => setVForm({ ...vForm, maxRedemptions: e.target.value })} /></label>
              <label className={cx('fieldGroup')}><span>Độ hiển thị voucher</span><select className={cx('select-admin')} value={vForm.visibility} onChange={(e) => setVForm({ ...vForm, visibility: e.target.value })}>
                <option value="public">Public - phát vào kho voucher người dùng</option>
                <option value="private">Private - chỉ ai có mã mới dùng được</option>
              </select></label>
              <label className={cx('fieldGroup')}><span>Đối tượng áp dụng</span><select className={cx('select-admin')} value={vForm.audienceType} onChange={(e) => setVForm({ ...vForm, audienceType: e.target.value, tierSlugs: [] })}>
                <option value="all">Áp dụng cho tất cả tài khoản</option>
                <option value="member">Áp dụng cho tất cả hội viên</option>
                <option value="tiers">Áp dụng theo từng hạng hội viên</option>
              </select></label>

              {vForm.audienceType === 'tiers' && (
                <div className={cx('tiersRow')}>
                  {tiers.map((t) => (
                    <label key={t._id} className={cx('tierChip')}>
                      <input type="checkbox" checked={(vForm.tierSlugs || []).includes(t.slug)} onChange={(e) => toggleTierSlug(t.slug, e.target.checked)} />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className={cx('bookPickerRow')}>
                <button type="button" className="btn btn--secondary" onClick={openBookPickerForCreate}>
                  Chọn sách áp dụng
                </button>
                <span className={cx('bookPickedLabel')}>
                  {vForm.applyAllBooks ? 'Đang chọn: Mọi loại sách' : `Đã chọn ${selectedBookCount} sách`}
                </span>
              </div>

              <button type="submit" className="btn btn--primary">
                Tạo voucher
              </button>
            </form>
          </div>

          <div className={cx('voucherPanel', 'cardAnim')}>
            <h3 className={cx('sectionTitle')}>Danh sách voucher</h3>
            <div className={cx('voucherFilters')}>
              <input className={cx('input')} placeholder="Tìm theo mã voucher..." value={voucherFilters.code} onChange={(e) => setVoucherFilters((p) => ({ ...p, code: e.target.value }))} />
              <select className={cx('select-admin')} value={voucherFilters.visibility} onChange={(e) => setVoucherFilters((p) => ({ ...p, visibility: e.target.value }))}>
                <option value="">Tất cả loại</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <select className={cx('select-admin')} value={voucherFilters.audienceType} onChange={(e) => setVoucherFilters((p) => ({ ...p, audienceType: e.target.value }))}>
                <option value="">Tất cả đối tượng</option>
                <option value="all">Tất cả</option>
                <option value="member">Hội viên</option>
                <option value="tiers">Theo hạng</option>
              </select>
              <select className={cx('select-admin')} value={voucherFilters.active} onChange={(e) => setVoucherFilters((p) => ({ ...p, active: e.target.value }))}>
                <option value="">Bật/Tắt tất cả</option>
                <option value="true">Đang bật</option>
                <option value="false">Đang tắt</option>
              </select>
              <input className={cx('input')} type="date" value={voucherFilters.endsAfter} onChange={(e) => setVoucherFilters((p) => ({ ...p, endsAfter: e.target.value }))} title="Hết hạn từ ngày" />
              <input className={cx('input')} type="date" value={voucherFilters.endsBefore} onChange={(e) => setVoucherFilters((p) => ({ ...p, endsBefore: e.target.value }))} title="Hết hạn đến ngày" />
            </div>

            <div className={cx('voucherTableWrap')}>
              <table className={cx('voucherTable')}>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tiêu đề</th>
                    <th>Loại</th>
                    <th>Đối tượng</th>
                    <th>Phạm vi sách</th>
                    <th>Trần giảm</th>
                    <th>Hết hạn</th>
                    <th>Đã dùng</th>
                    <th>Trạng thái</th>
                    <th>Tác vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v._id}>
                      <td>{v.code}</td>
                      <td>{v.title}</td>
                      <td>{v.visibility === 'private' ? 'Private' : 'Public'}</td>
                      <td>{v.audienceType === 'all' ? 'Tất cả' : v.audienceType === 'member' ? 'Hội viên' : `Hạng: ${(v.tierSlugs || []).join(', ') || '—'}`}</td>
                      <td>{v.applyAllBooks ? 'Mọi sách' : `${(v.eligibleBookIds || []).length} sách`}</td>
                      <td>{v.maxDiscountDong != null ? `${Number(v.maxDiscountDong).toLocaleString('vi-VN')}đ` : 'Không giới hạn'}</td>
                      <td>{v.endsAt ? new Date(v.endsAt).toLocaleString('vi-VN') : '—'}</td>
                      <td>{v.redemptionCount || 0}</td>
                      <td>
                        <button type="button" className={cx('stateBtn', { stateBtnOff: !v.active })} onClick={() => toggleVoucherActive(v)}>
                          {v.active ? 'Đang bật' : 'Đang tắt'}
                        </button>
                      </td>
                      <td>
                        <button type="button" className={cx('actionBtn')} onClick={() => openBookPickerForEdit(v)}>
                          Chỉnh sách áp dụng
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {bookModalOpen && (
            <div className={cx('bookModalOverlay')} onClick={() => setBookModalOpen(false)}>
              <div className={cx('bookModalCard')} onClick={(e) => e.stopPropagation()}>
                <h4>Chọn sách được áp dụng voucher</h4>
                <div className={cx('bookModalToolbar')}>
                  <div className={cx('bookFilterGroup', 'bookFilterGroupWide')}>
                    <label className={cx('bookFilterLabel')}>Lọc sách theo tên</label>
                    <input
                      className={cx('input')}
                      placeholder="Lọc nhanh theo tên sách..."
                      value={bookModalSearch}
                      onChange={(e) => setBookModalSearch(e.target.value)}
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
                    <label className={cx('bookFilterLabel')}>Khuyến mãi</label>
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
                  <label className={cx('applyAllRow')}>
                    <input
                      type="checkbox"
                      checked={bookModalApplyAll}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBookModalApplyAll(checked);
                        setBookModalDraft(checked ? books.map((b) => String(b._id)) : []);
                      }}
                    />
                    <span>Áp dụng cho mọi loại sách (tick tất cả)</span>
                  </label>
                  <button type="button" className={cx('resetBookFiltersBtn')} onClick={resetBookFilters}>
                    <i className="fa-solid fa-rotate-left" /> Reset filter
                  </button>
                </div>
                <p className={cx('bookFilterMeta')}>
                  Hiển thị {visibleBooks.length}/{books.length} sách
                </p>
                <div className={cx('bookModalList')}>
                  {visibleBooks.length === 0 && (
                    <div className={cx('bookEmptyState')}>
                      Không tìm thấy sách phù hợp với từ khóa.
                    </div>
                  )}
                  {visibleBooks.map((b) => {
                    const id = String(b._id);
                    const checked = bookModalDraft.includes(id);
                    const listPrice = listPriceVnd(b.price);
                    const salePrice = salePriceDisplayVnd(b.price, b.discount);
                    const hasDiscount = Number(b.discount) > 0 && salePrice < listPrice;
                    const imageSrc = resolveBookImage(b);
                    return (
                      <label key={id} className={cx('bookCheckRow')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setBookModalDraft((prev) => {
                              const set = new Set(prev);
                              if (e.target.checked) set.add(id);
                              else set.delete(id);
                              setBookModalApplyAll(set.size >= books.length && books.length > 0);
                              return [...set];
                            })
                          }
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
                              {hasDiscount ? (
                                <>
                                  <span className={cx('bookPriceSale')}>{formatVndDisplay(salePrice)}</span>
                                  <span className={cx('bookPriceOriginal')}>{formatVndDisplay(listPrice)}</span>
                                  <span className={cx('bookDiscountTag')}>-{Number(b.discount)}%</span>
                                </>
                              ) : (
                                <span className={cx('bookPriceSale')}>{formatVndDisplay(listPrice)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className={cx('bookModalActions', 'bookModalActionsStickyBottom')}>
                  <button type="button" className="btn btn--secondary" onClick={() => setBookModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="button" className="btn btn--primary" onClick={saveBookPicker}>
                    Lưu danh sách
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ManageVoucher;
