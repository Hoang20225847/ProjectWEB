import { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import axios from '../../components/axios/axios.customize';
import { AuthContext } from '../../components/context/auth.context';
import styles from './Statistics.module.scss';

/** API thống kê (đơn.totalAmount, dòng đơn…) trả về đồng VNĐ — không nhân thêm 1000 */
const formatCurrency = (valueDong) => {
  const n = Math.round(Number(valueDong) || 0);
  return n.toLocaleString('vi-VN');
};

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function defaultRange() {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - 29);
  return { from, to };
}

function Statistics() {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth?.user?.role === 'admin';

  const [{ from, to }, setRange] = useState(() => defaultRange());
  const fromStr = useMemo(() => from.toISOString().slice(0, 10), [from]);
  const toStr = useMemo(() => to.toISOString().slice(0, 10), [to]);

  const [granularity, setGranularity] = useState('month');
  const [periodData, setPeriodData] = useState([]);
  const [financial, setFinancial] = useState(null);
  const [compare, setCompare] = useState(null);
  const [categorySpending, setCategorySpending] = useState([]);
  const [monthlyOrders, setMonthlyOrders] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [loadingFin, setLoadingFin] = useState(true);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [ordersByStatus, setOrdersByStatus] = useState([]);
  const [ordersByPayment, setOrdersByPayment] = useState(null);

  const selectedYear = useMemo(() => from.getFullYear(), [from]);

  const loadFinancialBlock = useCallback(async () => {
    setLoadingFin(true);
    try {
      const [fin, cmp, cat, st, pay] = await Promise.all([
        axios.get(`/api/statistics/financial-summary?from=${fromStr}&to=${toStr}`),
        axios.get(`/api/statistics/period-compare?from=${fromStr}&to=${toStr}`),
        axios.get(`/api/statistics/category-spending?startDate=${fromStr}&endDate=${toStr}`),
        axios.get(`/api/statistics/orders-by-status?from=${fromStr}&to=${toStr}`),
        axios.get(`/api/statistics/orders-by-payment?from=${fromStr}&to=${toStr}`),
      ]);
      setFinancial(fin);
      setCompare(cmp);
      setCategorySpending(toArray(cat?.data ?? cat));
      setOrdersByStatus(toArray(st));
      setOrdersByPayment(pay && typeof pay === 'object' ? pay : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFin(false);
    }
  }, [fromStr, toStr]);

  const loadPeriodChart = useCallback(async () => {
    setLoadingPeriod(true);
    try {
      const res = await axios.get(
        `/api/statistics/revenue-by-period?granularity=${granularity}&from=${fromStr}&to=${toStr}`
      );
      setPeriodData(toArray(res?.data ?? res));
    } catch (e) {
      console.error(e);
      setPeriodData([]);
    } finally {
      setLoadingPeriod(false);
    }
  }, [granularity, fromStr, toStr]);

  useEffect(() => {
    loadFinancialBlock();
  }, [loadFinancialBlock]);

  useEffect(() => {
    loadPeriodChart();
  }, [loadPeriodChart]);

  useEffect(() => {
    const y = selectedYear;
    axios
      .get(`/api/statistics/monthly-orders?year=${y}`)
      .then((res) => setMonthlyOrders(toArray(res?.data ?? res)))
      .catch(() => setMonthlyOrders([]));
  }, [selectedYear]);

  useEffect(() => {
    axios
      .get('/api/statistics/top-books?limit=8')
      .then((res) => setTopBooks(toArray(res)))
      .catch(() => setTopBooks([]));
  }, []);

  const maxPeriodRev = Math.max(...periodData.map((p) => p.revenue || 0), 1);

  const statusBarColor = {
    'Chờ xử lý': '#f59e0b',
    'Đang giao': '#3b82f6',
    'Hoàn thành': '#10b981',
    'Đã hủy': '#94a3b8',
  };
  const maxStatusCount = Math.max(...ordersByStatus.map((s) => s.count || 0), 1);
  const payTotal = (ordersByPayment?.paid || 0) + (ordersByPayment?.unpaid || 0);
  const paidPct = payTotal ? ((ordersByPayment?.paid || 0) / payTotal) * 100 : 0;
  const categoryRevenueTotal = categorySpending.reduce((sum, cat) => sum + (Number(cat.totalSpent) || 0), 0);
  const categoryChartColors = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b', '#22c55e', '#ec4899'];
  const categoryChartData = categorySpending.map((cat, idx) => {
    const value = Number(cat.totalSpent) || 0;
    const pct = categoryRevenueTotal ? (value / categoryRevenueTotal) * 100 : 0;
    return {
      ...cat,
      value,
      pct,
      color: categoryChartColors[idx % categoryChartColors.length],
    };
  });
  const categoryConicStops = categoryChartData
    .reduce(
      (acc, cat) => {
        const nextEnd = acc.end + cat.pct;
        acc.parts.push(`${cat.color} ${acc.end}% ${nextEnd}%`);
        acc.end = nextEnd;
        return acc;
      },
      { end: 0, parts: [] }
    )
    .parts.join(', ');

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Thống kê</h1>
        <p className={styles.subtitle}>
          {isAdmin
            ? 'Doanh thu và tài chính toàn hệ thống. Kho hàng: menu Kho hàng & Nhập hàng.'
            : 'Số liệu theo đơn hàng của bạn (doanh thu, danh mục, kênh).'}
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>💰</span> Doanh thu &amp; Tài chính
        </h2>
        <div className={styles.dateRangeToolbar} aria-label="Chọn khoảng ngày thống kê">
          <div className={styles.dateField}>
            <span className={styles.dateFieldCap} id="stat-from-cap">
              Ngày bắt đầu
            </span>
            <div className={styles.dateInputWrap}>
              <input
                type="date"
                className={styles.dateInputNative}
                value={fromStr}
                onChange={(e) => setRange((prev) => ({ from: startOfDay(e.target.value), to: prev.to }))}
                aria-labelledby="stat-from-cap"
              />
            </div>
          </div>
          <div className={styles.dateField}>
            <span className={styles.dateFieldCap} id="stat-to-cap">
              Ngày kết thúc
            </span>
            <div className={styles.dateInputWrap}>
              <input
                type="date"
                className={styles.dateInputNative}
                value={toStr}
                onChange={(e) => setRange((prev) => ({ from: prev.from, to: endOfDay(e.target.value) }))}
                aria-labelledby="stat-to-cap"
              />
            </div>
          </div>
          <div className={styles.dateRangeActions}>
            <button type="button" className={styles.btnGhost} onClick={() => setRange(defaultRange())}>
              30 ngày gần nhất
            </button>
          </div>
        </div>

        {!loadingFin && (
          <div className={styles.chartsRow}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Đơn theo trạng thái</h3>
              {ordersByStatus.length === 0 ? (
                <p className={styles.muted}>Chưa tải được dữ liệu trạng thái.</p>
              ) : (
                <ul className={styles.statusChartList}>
                  {ordersByStatus.map((row) => (
                    <li key={row.status} className={styles.statusChartRow}>
                      <span className={styles.statusChartLabel}>{row.status}</span>
                      <div className={styles.statusChartTrack}>
                        <div
                          className={styles.statusChartFill}
                          style={{
                            width: `${row.count === 0 ? 0 : Math.max(8, (row.count / maxStatusCount) * 100)}%`,
                            backgroundColor: statusBarColor[row.status] || '#64748b',
                          }}
                        />
                      </div>
                      <span className={styles.statusChartCount}>{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Tỷ lệ thanh toán</h3>
              {!ordersByPayment || payTotal === 0 ? (
                <p className={styles.muted}>Không có đơn trong khoảng thời gian.</p>
              ) : (
                <div className={styles.paymentChart}>
                  <div className={styles.donutWrap} aria-hidden>
                    <div
                      className={styles.donutRing}
                      style={{
                        background: `conic-gradient(#10b981 0% ${paidPct}%, #cbd5e1 ${paidPct}% 100%)`,
                      }}
                    />
                    <div className={styles.donutCenter}>
                      <strong>{Math.round(paidPct)}%</strong>
                      <span>đã TT</span>
                    </div>
                  </div>
                  <ul className={styles.paymentLegend}>
                    <li>
                      <span className={styles.legendSwatch} style={{ background: '#10b981' }} />
                      Đã thanh toán: <strong>{ordersByPayment.paid}</strong>
                    </li>
                    <li>
                      <span className={styles.legendSwatch} style={{ background: '#cbd5e1' }} />
                      Chưa thanh toán: <strong>{ordersByPayment.unpaid}</strong>
                    </li>
                    <li className={styles.paymentLegendTotal}>Tổng đơn: {payTotal}</li>
                  </ul>
                  <p className={styles.chartHint}>
                    Gồm đơn có cờ thanh toán hoặc trạng thái <strong>Hoàn thành</strong> (coi như đã thanh toán).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {loadingFin ? (
          <p className={styles.muted}>Đang tải chỉ số tài chính…</p>
        ) : financial ? (
          <div className={styles.kpiGrid}>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Doanh thu kỳ</span>
              <strong>{formatCurrency(financial.revenue)}đ</strong>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Tiền vốn (giá nhập lúc bán)</span>
              <strong>{formatCurrency(financial.cogs)}đ</strong>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Lợi nhuận gộp</span>
              <strong className={styles.kpiAccent}>{formatCurrency(financial.grossProfit)}đ</strong>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Tỷ suất LN</span>
              <strong>{financial.marginPct}%</strong>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>AOV (TB / đơn)</span>
              <strong>{formatCurrency(financial.aov)}đ</strong>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLab}>Số đơn</span>
              <strong>{financial.orderCount}</strong>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>Không tải được dữ liệu tài chính.</p>
        )}

        {compare && (
          <div className={styles.compareCard}>
            <h3 className={styles.cardTitle}>So sánh kỳ này vs kỳ trước (cùng độ dài)</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  <th>Kỳ chọn</th>
                  <th>Kỳ trước</th>
                  <th>Chênh %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Doanh thu</td>
                  <td>{formatCurrency(compare.current.revenue)}đ</td>
                  <td>{formatCurrency(compare.previous.revenue)}đ</td>
                  <td className={compare.deltaPct.revenue >= 0 ? styles.up : styles.down}>
                    {compare.deltaPct.revenue > 0 ? '+' : ''}
                    {compare.deltaPct.revenue}%
                  </td>
                </tr>
                <tr>
                  <td>Đơn hàng</td>
                  <td>{compare.current.orderCount}</td>
                  <td>{compare.previous.orderCount}</td>
                  <td className={compare.deltaPct.orders >= 0 ? styles.up : styles.down}>
                    {compare.deltaPct.orders > 0 ? '+' : ''}
                    {compare.deltaPct.orders}%
                  </td>
                </tr>
                <tr>
                  <td>Lợi nhuận gộp</td>
                  <td>{formatCurrency(compare.current.grossProfit)}đ</td>
                  <td>{formatCurrency(compare.previous.grossProfit)}đ</td>
                  <td className={compare.deltaPct.grossProfit >= 0 ? styles.up : styles.down}>
                    {compare.deltaPct.grossProfit > 0 ? '+' : ''}
                    {compare.deltaPct.grossProfit}%
                  </td>
                </tr>
                <tr>
                  <td>AOV</td>
                  <td>{formatCurrency(compare.current.aov)}đ</td>
                  <td>{formatCurrency(compare.previous.aov)}đ</td>
                  <td className={compare.deltaPct.aov >= 0 ? styles.up : styles.down}>
                    {compare.deltaPct.aov > 0 ? '+' : ''}
                    {compare.deltaPct.aov}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.subBlock}>
          <h3 className={styles.cardTitle}>Doanh thu theo ngày / tuần / tháng / năm</h3>
          <div className={styles.tabs}>
            {['day', 'week', 'month', 'year'].map((g) => (
              <button
                key={g}
                type="button"
                className={`${styles.tab} ${granularity === g ? styles.tabActive : ''}`}
                onClick={() => setGranularity(g)}
              >
                {g === 'day' ? 'Ngày' : g === 'week' ? 'Tuần' : g === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
          {loadingPeriod ? (
            <p className={styles.muted}>Đang tải biểu đồ…</p>
          ) : (
            <div className={styles.barChart}>
              {periodData.map((row) => (
                <div key={row.period} className={styles.barCol}>
                  <div className={styles.barWrap}>
                    <div
                      className={styles.bar}
                      style={{ height: `${(row.revenue / maxPeriodRev) * 160}px` }}
                      title={`${row.orders} đơn`}
                    />
                  </div>
                  <span className={styles.barLab}>{row.period}</span>
                  <span className={styles.barVal}>{formatCurrency(row.revenue)}đ</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.subBlock}>
          <h3 className={styles.cardTitle}>Doanh thu theo danh mục sách (trong khoảng ngày)</h3>
          {categorySpending.length === 0 ? (
            <p className={styles.muted}>Chưa có dữ liệu.</p>
          ) : (
            <>
              <div className={styles.categoryChartRow}>
                <div className={styles.categoryDonutWrap} aria-hidden>
                  <div
                    className={styles.categoryDonutRing}
                    style={{
                      background:
                        categoryConicStops.length > 0
                          ? `conic-gradient(${categoryConicStops})`
                          : 'conic-gradient(#cbd5e1 0% 100%)',
                    }}
                  />
                  <div className={styles.categoryDonutCenter}>
                    <strong>100%</strong>
                    <span>doanh thu</span>
                  </div>
                </div>
                <ul className={styles.categoryLegend}>
                  {categoryChartData.map((cat) => (
                    <li key={cat.category}>
                      <span className={styles.legendSwatch} style={{ background: cat.color }} />
                      <span className={styles.categoryLegendLabel}>{cat.category}</span>
                      <strong>{cat.pct.toFixed(1)}%</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <ul className={styles.catList}>
                {categorySpending.map((cat) => (
                  <li key={cat.category} className={styles.catRow}>
                    <span className={styles.catName}>{cat.category}</span>
                    <span className={styles.catMeta}>{cat.quantity || 0} cuốn</span>
                    <span className={styles.catMoney}>{formatCurrency(cat.totalSpent)}đ</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className={styles.subBlock}>
          <h3 className={styles.cardTitle}>Theo tháng trong năm {selectedYear}</h3>
          <p className={styles.muted} style={{ marginBottom: 12 }}>
            Dùng năm của ngày &quot;Từ&quot; — chỉnh ngày bắt đầu nếu cần năm khác.
          </p>
          <div className={styles.barChartMonth}>
            {monthlyOrders.map((m) => (
              <div key={m.month} className={styles.barCol}>
                <div className={styles.barWrap}>
                  <div
                    className={styles.barAlt}
                    style={{
                      height: `${Math.max(
                        4,
                        (m.revenue / Math.max(...monthlyOrders.map((x) => x.revenue || 0), 1)) * 140
                      )}px`,
                    }}
                  />
                </div>
                <span className={styles.barLab}>T{m.month}</span>
                <span className={styles.barVal}>{m.count || 0} đơn</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Top sách bán chạy</h2>
        <div className={styles.topGrid}>
          {topBooks.map((book, idx) => (
            <article key={book._id || idx} className={styles.topCard}>
              <span className={styles.rank}>#{idx + 1}</span>
              {book.img ? (
                <img src={book.img} alt={book.name || 'Sách'} className={styles.cover} />
              ) : (
                <div className={styles.coverPh} />
              )}
              <div>
                <h4 className={styles.bookTitle}>{book.name}</h4>
                <p className={styles.muted}>Đã bán: {book.totalSold || 0}</p>
                <p className={styles.muted}>Doanh thu dòng: {formatCurrency(book.totalRevenue)}đ</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {financial?.note && <p className={styles.footnote}>{financial.note}</p>}
    </div>
  );
}

export default Statistics;
