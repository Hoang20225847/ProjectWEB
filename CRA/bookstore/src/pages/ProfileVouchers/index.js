import { useEffect, useMemo, useState } from 'react';
import axios from '../../components/axios/axios.customize.js';
import styles from './ProfileVouchers.module.scss';
import { formatVndDisplay } from '../../components/function/function.js';

function ProfileVouchers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('expiringSoonest');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await axios.get('/api/membership/my-vouchers');
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const okStatus = statusFilter === 'all' ? true : r.displayStatus === statusFilter;
      if (!okStatus) return false;
      if (!q) return true;
      const code = String(r.code || '').toLowerCase();
      const title = String(r.voucher?.title || '').toLowerCase();
      return code.includes(q) || title.includes(q);
    });
    const sorted = [...filtered];
    if (sortBy === 'expiringSoonest') {
      sorted.sort((a, b) => {
        const ea = a?.voucher?.endsAt ? new Date(a.voucher.endsAt).getTime() : Number.MAX_SAFE_INTEGER;
        const eb = b?.voucher?.endsAt ? new Date(b.voucher.endsAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ea - eb;
      });
    } else if (sortBy === 'newest') {
      sorted.sort((a, b) => {
        const aa = a?.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const ab = b?.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return ab - aa;
      });
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => {
        const aa = a?.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const ab = b?.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return aa - ab;
      });
    }
    return sorted;
  }, [rows, search, statusFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const base = { all: rows.length, active: 0, expiringSoon: 0, used: 0, expired: 0 };
    for (const r of rows) {
      if (base[r.displayStatus] != null) base[r.displayStatus] += 1;
    }
    return base;
  }, [rows]);

  const formatDiscountText = (voucher) => {
    if (!voucher) return '—';
    if (voucher.discountType === 'percent') return `Giảm ${voucher.discountValue || 0}%`;
    return `Giảm ${formatVndDisplay(voucher.discountValue || 0)}`;
  };

  const statusLabel = (s) => {
    if (s === 'active') return 'Khả dụng';
    if (s === 'expiringSoon') return 'Sắp hết hạn';
    if (s === 'used') return 'Đã dùng';
    if (s === 'expired') return 'Hết hạn';
    return 'Khác';
  };

  return (
    <div className="Account-container">
      <div className="Account-Title">
        <span className="Account-Title-Name">Kho voucher của tôi</span>
        <span className="Account-Tittle-Description">Theo dõi voucher khả dụng và lịch sử sử dụng.</span>
      </div>
      {loading ? (
        <p className={styles.loading}>Đang tải voucher…</p>
      ) : rows.length === 0 ? (
        <div className={styles.emptyCard}>Kho rỗng</div>
      ) : (
        <div className={styles.wrapper}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              placeholder="Tìm theo mã hoặc tiêu đề voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={styles.statusSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả ({statusCounts.all})</option>
              <option value="active">Khả dụng ({statusCounts.active})</option>
              <option value="expiringSoon">Sắp hết hạn ({statusCounts.expiringSoon})</option>
              <option value="used">Đã dùng ({statusCounts.used})</option>
              <option value="expired">Hết hạn ({statusCounts.expired})</option>
            </select>
            <select className={styles.statusSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="expiringSoonest">Hết hạn gần nhất</option>
              <option value="newest">Voucher mới nhất</option>
              <option value="oldest">Voucher cũ nhất</option>
            </select>
          </div>
          {filteredRows.length === 0 ? (
            <p className={styles.emptyText}>Không có voucher phù hợp bộ lọc hiện tại.</p>
          ) : (
            <div className={styles.cardGrid}>
              {filteredRows.map((it) => (
                <article key={String(it.userVoucherId)} className={styles.voucherCard}>
                  <div className={styles.cardTop}>
                    <div className={styles.code}>{it.code}</div>
                    <span className={`${styles.statusBadge} ${styles[`status_${it.displayStatus}`] || ''}`}>
                      {statusLabel(it.displayStatus)}
                    </span>
                  </div>
                  <h3 className={styles.title}>{it.voucher?.title || 'Voucher'}</h3>
                  <div className={styles.infoRow}><span>Ưu đãi</span><strong>{formatDiscountText(it.voucher)}</strong></div>
                  <div className={styles.infoRow}>
                    <span>Giảm tối đa</span>
                    <strong>{it.voucher?.maxDiscountDong != null ? formatVndDisplay(it.voucher.maxDiscountDong) : 'Không giới hạn'}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Đơn tối thiểu</span>
                    <strong>{formatVndDisplay(it.voucher?.minOrderDong || 0)}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Hết hạn</span>
                    <strong>{it.voucher?.endsAt ? new Date(it.voucher.endsAt).toLocaleString('vi-VN') : '—'}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileVouchers;
