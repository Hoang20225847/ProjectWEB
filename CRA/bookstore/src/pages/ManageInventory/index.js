import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../../components/axios/axios.customize';
import styles from './ManageInventory.module.scss';
import { Link } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';

const formatCurrency = (valueDong) => {
  const n = Number(valueDong) || 0;
  return n.toLocaleString('vi-VN');
};

const formatCompactBillions = (valueDong) => {
  const vnd = Number(valueDong) || 0;
  if (vnd >= 1e9) return `${(vnd / 1e9).toFixed(vnd % 1e9 === 0 ? 0 : 1)} tỷ`;
  if (vnd >= 1e6) return `${(vnd / 1e6).toFixed(vnd % 1e6 === 0 ? 0 : 1)}M`;
  if (vnd >= 1e3) return `${(vnd / 1e3).toFixed(0)}k`;
  return String(Math.round(vnd));
};

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const STATUS_OPTS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'low', label: 'Sắp hết' },
  { value: 'out', label: 'Hết hàng' },
  { value: 'slow', label: 'Tồn lâu' },
];

const TYPE_CLASS = {
  import: styles.typeImport,
  sale: styles.typeSale,
  return: styles.typeReturn,
  adjust: styles.typeAdjust,
};

const TYPE_LABEL = {
  import: 'Nhập',
  sale: 'Bán',
  return: 'Trả',
  adjust: 'Điều chỉnh',
};

const ROW_BADGE = {
  normal: { className: styles.stNormal, label: 'Bình thường' },
  low: { className: styles.stLow, label: 'Sắp hết' },
  out: { className: styles.stOut, label: 'Hết hàng' },
  slow: { className: styles.stSlow, label: 'Tồn lâu' },
  untracked: { className: styles.muted, label: '—' },
};

function ManageInventory() {
  const [tab, setTab] = useState('list');
  const [dashboard, setDashboard] = useState(null);
  const [invBooks, setInvBooks] = useState([]);
  const [invMovements, setInvMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');

  const [importForm, setImportForm] = useState({
    bookId: '',
    quantity: '',
    importPrice: '',
    supplierMode: 'pick',
    supplierPick: '',
    supplierNew: '',
    note: '',
  });
  /** Toàn bộ sách cho dropdown nhập hàng (không lọc theo tab danh sách). */
  const [pickerBooks, setPickerBooks] = useState([]);
  const [adjustOutForm, setAdjustOutForm] = useState({ bookId: '', quantity: '', note: '' });

  const loadDashboardMovements = useCallback(async () => {
    const [dash, mov] = await Promise.all([
      axios.get('/api/inventory/dashboard'),
      axios.get('/api/inventory/movements?limit=80'),
    ]);
    setDashboard(dash);
    setInvMovements(toArray(mov));
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await axios.get('/api/categories');
    setCategories(toArray(res));
  }, []);

  const loadSuppliers = useCallback(async () => {
    const res = await axios.get('/api/suppliers');
    setSuppliers(toArray(res));
  }, []);

  const loadBooks = useCallback(async () => {
    setListLoading(true);
    try {
      const params = {};
      if (qDebounced.trim()) params.q = qDebounced.trim();
      if (categoryId) params.categoryId = categoryId;
      if (status && status !== 'all') params.status = status;
      const res = await axios.get('/api/inventory/by-book', { params });
      setInvBooks(toArray(res));
    } catch (e) {
      console.error(e);
    } finally {
      setListLoading(false);
    }
  }, [qDebounced, categoryId, status]);

  useEffect(() => {
    if (tab !== 'import') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/inventory/by-book');
        if (!cancelled) setPickerBooks(toArray(res));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 320);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadDashboardMovements(), loadCategories(), loadSuppliers()]);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDashboardMovements, loadCategories, loadSuppliers]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const booksForPicker = pickerBooks.length ? pickerBooks : invBooks;
  const selectedBook = useMemo(
    () => booksForPicker.find((b) => String(b._id) === String(importForm.bookId)),
    [booksForPicker, importForm.bookId]
  );

  const importPreview = useMemo(() => {
    const qty = Math.floor(Number(importForm.quantity));
    const price = Number(String(importForm.importPrice).replace(/,/g, ''));
    const cur = selectedBook?.stock;
    const hasQty = Number.isFinite(qty) && qty >= 1;
    const hasPrice = Number.isFinite(price) && price >= 0;
    const before = typeof cur === 'number' ? cur : null;
    const after = before != null && hasQty ? before + qty : null;
    const total = hasQty && hasPrice ? qty * price : hasQty && importForm.importPrice === '' ? null : null;
    return { before, after, total, hasQty, hasPrice, qty, price };
  }, [importForm.quantity, importForm.importPrice, selectedBook]);

  const selectedAdjustBook = useMemo(
    () => booksForPicker.find((b) => String(b._id) === String(adjustOutForm.bookId)),
    [booksForPicker, adjustOutForm.bookId]
  );

  const adjustOutPreview = useMemo(() => {
    const qty = Math.floor(Number(adjustOutForm.quantity));
    const cur = selectedAdjustBook?.stock;
    const hasQty = Number.isFinite(qty) && qty >= 1;
    const before = typeof cur === 'number' ? cur : null;
    const after = before != null && hasQty ? Math.max(0, before - qty) : null;
    return { before, after, hasQty, qty };
  }, [adjustOutForm.quantity, selectedAdjustBook]);

  const handleImport = async (e) => {
    e.preventDefault();
    try {
      const qty = Math.floor(Number(importForm.quantity));
      const importPrice =
        importForm.importPrice === '' ? undefined : Number(String(importForm.importPrice).replace(/,/g, ''));
      const supplierName =
        importForm.supplierMode === 'new'
          ? String(importForm.supplierNew || '').trim()
          : String(importForm.supplierPick || '').trim();

      if (importForm.supplierMode === 'new' && !supplierName) {
        window.alert('Nhập tên nhà cung cấp mới');
        return;
      }
      if (importForm.supplierMode === 'new' && supplierName) {
        try {
          await axios.post('/api/suppliers', { name: supplierName });
          await loadSuppliers();
        } catch (err) {
          const msg = String(err?.response?.data?.message || '').toLowerCase();
          if (!msg.includes('duplicate') && !msg.includes('trùng')) {
            throw err;
          }
          await loadSuppliers();
        }
      }
      await axios.post('/api/inventory/stock-import', {
        bookId: importForm.bookId.trim(),
        quantity: qty,
        importPrice: importPrice !== undefined && !Number.isNaN(importPrice) ? importPrice : undefined,
        supplierName: supplierName || undefined,
        note: importForm.note || undefined,
      });
      setImportForm({
        bookId: '',
        quantity: '',
        importPrice: '',
        supplierMode: 'pick',
        supplierPick: '',
        supplierNew: '',
        note: '',
      });
      await Promise.all([loadDashboardMovements(), loadBooks(), axios.get('/api/inventory/by-book').then((r) => setPickerBooks(toArray(r)))]);
      setTab('list');
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Nhập kho thất bại');
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Sách', 'Tồn', 'Tối thiểu', 'Giá vốn (đồng)', 'Giá trị kho', 'Trạng thái'].join(','),
      ...invBooks.map((b) =>
        [
          `"${String(b.name || '').replace(/"/g, '""')}"`,
          b.stock ?? '',
          b.minStock ?? '',
          b.costPrice ?? '',
          b.inventoryValueAtCost ?? '',
          b.rowStatus ?? '',
        ].join(',')
      ),
    ];
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ton-kho-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openImportFor = (bookId) => {
    setImportForm((s) => ({
      ...s,
      bookId: String(bookId),
      quantity: '',
      importPrice: '',
      supplierMode: 'pick',
      supplierPick: '',
      supplierNew: '',
      note: '',
    }));
    setTab('import');
  };

  const importMovementReversed = (mov, all) => {
    const tag = `__REV_IMPORT__:${String(mov._id)}__`;
    return (all || []).some((x) => typeof x.note === 'string' && x.note.startsWith(tag));
  };

  const handleReverseImport = async (m) => {
    const ok = window.confirm(
      `Hoàn tác phiếu nhập +${m.quantity} cuốn cho "${m.bookId?.name || 'sách'}"?\nTồn sẽ giảm lại và ghi biến động điều chỉnh.`
    );
    if (!ok) return;
    try {
      const res = await axios.post('/api/inventory/stock-import/reverse', {
        movementId: String(m._id),
        note: 'Hoàn tác từ giao diện kho',
      });
      if (res?.costPriceNote) {
        window.alert(`${res.message}\n\n${res.costPriceNote}`);
      } else {
        window.alert(res?.message || 'Đã hoàn tác');
      }
      await Promise.all([
        loadDashboardMovements(),
        loadBooks(),
        axios.get('/api/inventory/by-book').then((r) => setPickerBooks(toArray(r))).catch(() => {}),
      ]);
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Hoàn tác thất bại');
    }
  };

  const handleAdjustOut = async (e) => {
    e.preventDefault();
    const qty = Math.floor(Number(adjustOutForm.quantity));
    if (!adjustOutForm.bookId || !Number.isFinite(qty) || qty < 1) {
      window.alert('Chọn sách và số lượng trừ ≥ 1');
      return;
    }
    try {
      await axios.post('/api/inventory/stock-adjust', {
        bookId: adjustOutForm.bookId.trim(),
        quantity: qty,
        direction: 'out',
        note: adjustOutForm.note?.trim() || 'Trừ tồn (nhập thừa / ghi sai)',
      });
      setAdjustOutForm({ bookId: '', quantity: '', note: '' });
      await Promise.all([loadDashboardMovements(), loadBooks(), axios.get('/api/inventory/by-book').then((r) => setPickerBooks(toArray(r)))]);
      window.alert('Đã trừ tồn');
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Điều chỉnh thất bại');
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className={styles.page}>
      <div className={styles.adminNav}>
        <div className={styles.navBrand}>
          <i className="fa-solid fa-warehouse" aria-hidden />
          <span className={styles.navBrandText}>Quản lý kho hàng</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/admin/Statistics" className={styles.linkBtn}>
            <i className="fa-solid fa-chart-line" /> Thống kê
          </Link>
          <Link to="/admin/Settings" className={styles.linkBtn}>
            <i className="fa-solid fa-gear" /> Cài đặt
          </Link>
        </div>
      </div>

      <div className={styles.topBar}>
        <h1 className={styles.title}>Quản lý kho hàng</h1>
        <div className={styles.actions}>
          <button type="button" className={styles.btnOutline} onClick={exportCsv}>
            Xuất báo cáo
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setTab('import')}>
            + Nhập hàng
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingBlock} aria-busy="true" aria-label="Đang tải">
          <div className={styles.loadingDots}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
          <span className={styles.loadingLabel}>Đang tải bảng điều khiển kho…</span>
          <div className={styles.shimmer} />
        </div>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Tổng đầu sách có kho</span>
              <span className={styles.kpiVal}>{dashboard?.totalSkusWithStock ?? 0}</span>
              <div className={styles.kpiHint}>trong {dashboard?.categoryCount ?? 0} danh mục</div>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Giá trị tồn kho</span>
              <span className={styles.kpiVal}>₫{formatCompactBillions(dashboard?.valueAtCost)}</span>
              <div className={styles.kpiHint}>stock × costPrice</div>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Cần nhập hàng</span>
              <span className={styles.kpiVal}>{dashboard?.needRestockCount ?? 0}</span>
              <div className={styles.kpiHint}>stock ≤ minStock</div>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Tồn quá 90 ngày</span>
              <span className={styles.kpiVal}>{dashboard?.slowStaleCount ?? 0}</span>
              <div className={styles.kpiHint}>chưa bán được</div>
            </div>
          </div>

          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'list' ? styles.tabActive : ''}`}
              onClick={() => setTab('list')}
            >
              Danh sách tồn kho
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'import' ? styles.tabActive : ''}`}
              onClick={() => setTab('import')}
            >
              Nhập hàng
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
              onClick={() => setTab('history')}
            >
              Lịch sử biến động
            </button>
          </div>

          {tab === 'list' && (
            <div key="tab-list" className={styles.tabPanel}>
              <div className={styles.filters}>
                <input
                  className={`${styles.input} ${styles.inputSearch}`}
                  placeholder="Tìm tên sách, ISBN…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {listLoading ? (
                <div className={styles.listLoadingOverlay} aria-busy="true">
                  <div className={styles.listLoadingInner}>
                    <div className={styles.loadingDots}>
                      <span className={styles.loadingDot} />
                      <span className={styles.loadingDot} />
                      <span className={styles.loadingDot} />
                    </div>
                    <span className={styles.loadingLabel}>Đang tải danh sách…</span>
                  </div>
                  <div className={styles.shimmer} />
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Sách</th>
                        <th>Tồn kho</th>
                        <th>Mức tối thiểu</th>
                        <th>Giá vốn</th>
                        <th>Giá trị kho</th>
                        <th>Lần bán gần nhất</th>
                        <th>Trạng thái</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {invBooks.map((b) => {
                        const rb = ROW_BADGE[b.rowStatus] || ROW_BADGE.untracked;
                        const barClass =
                          b.stock != null && b.stock <= 0
                            ? styles.stockBarDanger
                            : b.rowStatus === 'low'
                              ? styles.stockBarWarn
                              : '';
                        return (
                          <tr key={b._id}>
                            <td className={styles.bookCell}>{b.name}</td>
                            <td className={styles.stockCell}>
                              <span className={styles.stockNum}>{b.stock == null ? '—' : b.stock}</span>
                              {b.stock != null && (
                                <div
                                  className={`${styles.stockBarTrack} ${barClass}`}
                                  title={`Mức đầy ~${b.stockBarPct}% (so với ngưỡng hiển thị)`}
                                >
                                  <div className={styles.stockBarFill} style={{ width: `${b.stockBarPct}%` }} />
                                </div>
                              )}
                            </td>
                            <td>{b.minStock ?? '—'}</td>
                            <td>{formatCurrency(b.costPrice)}đ</td>
                            <td>
                              {b.inventoryValueAtCost == null ? '—' : `${formatCurrency(b.inventoryValueAtCost)}đ`}
                            </td>
                            <td>{fmtDate(b.lastSoldAt)}</td>
                            <td>
                              <span className={`${styles.badge} ${rb.className}`}>{rb.label}</span>
                            </td>
                            <td>
                              <button type="button" className={styles.btnOutline} onClick={() => openImportFor(b._id)}>
                                Nhập
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'import' && (
            <div key="tab-import" className={styles.tabPanel}>
              <div className={styles.importPanel}>
              <form className={styles.formStack} onSubmit={handleImport}>
                <div>
                  <div className={styles.label}>Sách</div>
                  <select
                    className={styles.select}
                    style={{ width: '100%' }}
                    required
                    value={importForm.bookId}
                    onChange={(e) => setImportForm((s) => ({ ...s, bookId: e.target.value }))}
                  >
                    <option value="">Chọn sách…</option>
                    {booksForPicker.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                        {b.stock != null ? ` (tồn ${b.stock})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={styles.label}>Số lượng nhập</div>
                  <input
                    className={styles.input}
                    style={{ width: '100%' }}
                    type="number"
                    min={1}
                    required
                    value={importForm.quantity}
                    onChange={(e) => setImportForm((s) => ({ ...s, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <div className={styles.label}>Giá nhập (đ / cuốn)</div>
                  <input
                    className={styles.input}
                    style={{ width: '100%' }}
                    type="number"
                    min={0}
                    step="0.001"
                    value={importForm.importPrice}
                    onChange={(e) => setImportForm((s) => ({ ...s, importPrice: e.target.value }))}
                    placeholder="Để cập nhật giá vốn theo bình quân gia quyền"
                  />
                </div>
                <div>
                  <div className={styles.label}>Nhà cung cấp</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      className={importForm.supplierMode === 'pick' ? styles.btnPrimary : styles.btnOutline}
                      onClick={() => setImportForm((s) => ({ ...s, supplierMode: 'pick' }))}
                    >
                      Chọn có sẵn
                    </button>
                    <button
                      type="button"
                      className={importForm.supplierMode === 'new' ? styles.btnPrimary : styles.btnOutline}
                      onClick={() => setImportForm((s) => ({ ...s, supplierMode: 'new' }))}
                    >
                      Thêm mới
                    </button>
                  </div>
                  {importForm.supplierMode === 'pick' ? (
                    <select
                      className={styles.select}
                      style={{ width: '100%' }}
                      value={importForm.supplierPick}
                      onChange={(e) => setImportForm((s) => ({ ...s, supplierPick: e.target.value }))}
                    >
                      <option value="">-- Không chọn --</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={styles.input}
                      style={{ width: '100%' }}
                      placeholder="Nhập nhà cung cấp mới..."
                      value={importForm.supplierNew}
                      onChange={(e) => setImportForm((s) => ({ ...s, supplierNew: e.target.value }))}
                    />
                  )}
                </div>
                <div>
                  <div className={styles.label}>Ghi chú</div>
                  <input
                    className={styles.input}
                    style={{ width: '100%' }}
                    value={importForm.note}
                    onChange={(e) => setImportForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder="Tùy chọn"
                  />
                </div>

                <div className={styles.preview}>
                  <div className={styles.previewRow}>
                    <span>Tồn trước</span>
                    <strong>{importPreview.before == null ? '—' : importPreview.before}</strong>
                  </div>
                  <div className={styles.previewRow}>
                    <span>Tồn sau (dự kiến)</span>
                    <strong>{importPreview.after == null ? '—' : importPreview.after}</strong>
                  </div>
                  <div className={styles.previewRow}>
                    <span>Tổng tiền nhập (đ)</span>
                    <strong>
                      {importPreview.total == null
                        ? importPreview.hasQty && importForm.importPrice === ''
                          ? 'Nhập giá để xem'
                          : '—'
                        : formatCurrency(importPreview.total)}
                      {importPreview.total != null ? 'đ' : ''}
                    </strong>
                  </div>
                </div>

                <button type="submit" className={styles.btnPrimary} disabled={!importForm.bookId}>
                  Xác nhận nhập kho
                </button>
              </form>

              <div className={styles.sectionDivider}>
                <h3 className={styles.sectionSubheading}>Trừ tồn thủ công</h3>
                <p className={`${styles.muted} ${styles.sectionHelp}`}>
                  Nếu nhập thừa / ghi sai số lượng mà không cần gắn phiếu cũ: chọn sách, nhập số lượng cần trừ, xác nhận (ghi nhận điều chỉnh xuất).
                </p>
                <form className={styles.formStack} onSubmit={handleAdjustOut}>
                  <div>
                    <div className={styles.label}>Sách</div>
                    <select
                      className={styles.select}
                      style={{ width: '100%' }}
                      value={adjustOutForm.bookId}
                      onChange={(e) => setAdjustOutForm((s) => ({ ...s, bookId: e.target.value }))}
                    >
                      <option value="">Chọn sách…</option>
                      {booksForPicker.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                          {b.stock != null ? ` (tồn ${b.stock})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={styles.label}>Số lượng trừ</div>
                    <input
                      className={styles.input}
                      style={{ width: '100%' }}
                      type="number"
                      min={1}
                      value={adjustOutForm.quantity}
                      onChange={(e) => setAdjustOutForm((s) => ({ ...s, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className={styles.label}>Lý do (ghi vào lịch sử)</div>
                    <input
                      className={styles.input}
                      style={{ width: '100%' }}
                      value={adjustOutForm.note}
                      onChange={(e) => setAdjustOutForm((s) => ({ ...s, note: e.target.value }))}
                      placeholder="Ví dụ: nhập thừa 20 cuốn"
                    />
                  </div>
                  <div className={styles.preview}>
                    <div className={styles.previewRow}>
                      <span>Tồn trước</span>
                      <strong>{adjustOutPreview.before == null ? '—' : adjustOutPreview.before}</strong>
                    </div>
                    <div className={styles.previewRow}>
                      <span>Tồn sau (dự kiến)</span>
                      <strong>{adjustOutPreview.after == null ? '—' : adjustOutPreview.after}</strong>
                    </div>
                  </div>
                  <button type="submit" className={styles.btnOutline} disabled={!adjustOutForm.bookId}>
                    Xác nhận trừ tồn
                  </button>
                </form>
              </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div key="tab-history" className={styles.tabPanel}>
              <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Sách</th>
                    <th>Loại</th>
                    <th>NCC</th>
                    <th>+/−</th>
                    <th>Trước</th>
                    <th>Sau</th>
                    <th>Ghi chú</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invMovements.map((m) => {
                    const tc = TYPE_CLASS[m.type] || '';
                    const sign = (m.signedQty ?? 0) >= 0;
                    const canReverseImport =
                      m.type === 'import' &&
                      (m.stockDirection === 'in' || m.stockDirection == null) &&
                      !importMovementReversed(m, invMovements);
                    return (
                      <tr key={m._id}>
                        <td>{m.createdAt ? new Date(m.createdAt).toLocaleString('vi-VN') : ''}</td>
                        <td>{m.bookId?.name || '—'}</td>
                        <td>
                          <span className={`${styles.badge} ${tc}`}>{TYPE_LABEL[m.type] || m.type}</span>
                        </td>
                        <td>{m.supplierName || '—'}</td>
                        <td>
                          <span className={sign ? styles.signIn : styles.signOut}>
                            {sign ? '+' : ''}
                            {m.signedQty ?? m.quantity}
                          </span>
                        </td>
                        <td>{m.balanceBefore ?? '—'}</td>
                        <td>{m.balanceAfter ?? '—'}</td>
                        <td>{m.note}</td>
                        <td>
                          {canReverseImport ? (
                            <button
                              type="button"
                              className={styles.btnOutline}
                              style={{ color: '#b91c1c', borderColor: 'rgba(185,28,28,0.45)' }}
                              onClick={() => handleReverseImport(m)}
                            >
                              Hoàn tác nhập
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ManageInventory;
