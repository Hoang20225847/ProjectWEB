import { useEffect, useMemo, useState } from 'react';
import axios from '../../components/axios/axios.customize';
import { formatVndDisplay } from '../../components/function/function.js';
import styles from './UserStatistics.module.scss';

function formatCompactVnd(value) {
  const n = Number(value) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.0', '')} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')}tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${n}`;
}

export default function UserStatistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await axios.get('/api/statistics/user-dashboard');
        if (mounted) setData(res);
      } catch (_e) {
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const monthlyMax = useMemo(() => {
    const list = Array.isArray(data?.monthlySpending) ? data.monthlySpending : [];
    return Math.max(...list.map((m) => Number(m?.spend) || 0), 1);
  }, [data]);

  const categories = Array.isArray(data?.favoriteCategories) ? data.favoriteCategories : [];
  const topCategories = categories.length > 0 ? categories : [{ name: 'Chưa có dữ liệu', percent: 0, quantity: 0 }];

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Thống kê của tôi</h1>
        <p className={styles.muted}>Đang tải dữ liệu thống kê...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Thống kê của tôi</h1>
      <p className={styles.subtitle}>Dữ liệu mua hàng, đánh giá và ưu đãi cá nhân</p>

      <section className={styles.section}>
        <h2>Tổng quan đơn hàng</h2>
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Tổng đơn hàng</span>
            <strong className={styles.kpiValue}>{data?.orderOverview?.totalOrders ?? 0}</strong>
            <small>tất cả thời gian</small>
          </article>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Đang xử lý</span>
            <strong className={styles.kpiValue}>{data?.orderOverview?.pendingOrders ?? 0}</strong>
            <small>đơn chờ giao</small>
          </article>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Tổng chi tiêu</span>
            <strong className={styles.kpiValue}>{formatCompactVnd(data?.orderOverview?.totalSpend)}</strong>
            <small>VNĐ đã mua</small>
          </article>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Sách đã mua</span>
            <strong className={styles.kpiValue}>{data?.orderOverview?.booksPurchased ?? 0}</strong>
            <small>cuốn sách</small>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Thể loại yêu thích</h2>
        <div className={styles.listCard}>
          {topCategories.map((cat) => (
            <div key={cat.name} className={styles.row}>
              <span>{cat.name}</span>
              <span>{cat.percent || 0}%</span>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${Math.max(0, Math.min(100, cat.percent || 0))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Chi tiêu theo tháng</h2>
        <div className={styles.monthGrid}>
          {(data?.monthlySpending || []).map((m) => (
            <div key={m.key} className={styles.monthItem}>
              <span className={styles.monthLabel}>{m.label}</span>
              <div className={styles.monthTrack}>
                <div
                  className={styles.monthFill}
                  style={{ height: `${Math.max(8, Math.round(((Number(m?.spend) || 0) / monthlyMax) * 100))}%` }}
                />
              </div>
              <span className={styles.monthValue}>{formatCompactVnd(m?.spend)}</span>
            </div>
          ))}
        </div>
        <p className={styles.muted}>Chi tiêu 4 tháng gần nhất</p>
      </section>

      <section className={styles.section}>
        <h2>Sách đã đọc / wishlist</h2>
        <div className={styles.smallGrid}>
          <article className={styles.metricCard}>
            <span>Đã đánh giá</span>
            <strong>{data?.readingStats?.reviewedCount ?? 0}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>Điểm đánh giá TB</span>
            <strong>{data?.readingStats?.avgRating ?? 0} ★</strong>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Điểm thưởng & ưu đãi</h2>
        <div className={styles.smallGrid}>
          <article className={styles.metricCard}>
            <span>Điểm tích lũy</span>
            <strong>{(data?.rewards?.points ?? 0).toLocaleString('vi-VN')} pts</strong>
          </article>
          <article className={styles.metricCard}>
            <span>Hạng thành viên</span>
            <strong>{data?.rewards?.memberRank || 'Chưa có'}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>Voucher khả dụng</span>
            <strong>{data?.rewards?.voucherAvailable ?? 0} mã</strong>
          </article>
          <article className={styles.metricCard}>
            <span>Tiết kiệm được</span>
            <strong>{formatVndDisplay(data?.rewards?.totalSaved || 0)}</strong>
          </article>
        </div>
      </section>
    </div>
  );
}
