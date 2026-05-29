import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import { useCallback, useEffect, useState } from 'react';
import axios from '../../components/axios/axios.customize.js';
import { toast } from 'react-toastify';
import { formatVndDisplay } from '../../components/function/function.js';

const cx = classNames.bind(styles);

const TABS = [
  { id: 'tiers', label: 'Hạng (Tier)' },
  { id: 'benefits', label: 'Ưu đãi (Benefit)' },
  { id: 'logs', label: 'Lịch sử nâng hạng' },
  { id: 'points', label: 'Giao dịch điểm' },
];

function ManageMembership() {
  const [tab, setTab] = useState('tiers');
  const [tiers, setTiers] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [points, setPoints] = useState([]);
  const [tierAccountStats, setTierAccountStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTiers = useCallback(async () => {
    const rows = await axios.get('/api/membership/admin/tiers');
    setTiers(Array.isArray(rows) ? rows : []);
  }, []);

  const loadBenefits = useCallback(async () => {
    const rows = await axios.get('/api/membership/admin/benefits');
    setBenefits(Array.isArray(rows) ? rows : []);
  }, []);

  const loadLogs = useCallback(async () => {
    const rows = await axios.get('/api/membership/admin/logs?limit=80');
    setLogs(Array.isArray(rows) ? rows : []);
  }, []);

  const loadPoints = useCallback(async () => {
    const rows = await axios.get('/api/membership/admin/points?limit=80');
    setPoints(Array.isArray(rows) ? rows : []);
  }, []);

  const loadTierAccountStats = useCallback(async () => {
    const stats = await axios.get('/api/membership/admin/tier-account-stats');
    setTierAccountStats(stats && typeof stats === 'object' && !Array.isArray(stats) ? stats : null);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (tab === 'tiers') {
          await loadTiers();
          try {
            await loadTierAccountStats();
          } catch {
            setTierAccountStats(null);
          }
        }
        if (tab === 'benefits') await loadBenefits();
        if (tab === 'logs') await loadLogs();
        if (tab === 'points') await loadPoints();
      } catch (e) {
        toast.error('Không tải được dữ liệu (cần quyền admin)');
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, loadTiers, loadTierAccountStats, loadBenefits, loadLogs, loadPoints]);

  const saveTier = async (t) => {
    try {
      await axios.put(`/api/membership/admin/tiers/${t._id}`, {
        name: t.name,
        discountPercent: Number(t.discountPercent),
        minTotalSpentDong: Number(t.minTotalSpentDong),
        shipFreeAll: !!t.shipFreeAll,
        shipFreeMinSubtotalDong: t.shipFreeMinSubtotalDong === '' || t.shipFreeMinSubtotalDong == null ? null : Number(t.shipFreeMinSubtotalDong),
        pointsPer1000Vnd: Number(t.pointsPer1000Vnd),
        active: !!t.active,
        sortOrder: Number(t.sortOrder) || 0,
      });
      toast.success('Đã lưu hạng');
      await loadTiers();
      try {
        await loadTierAccountStats();
      } catch {
        /* ignore */
      }
    } catch {
      toast.error('Lưu thất bại');
    }
  };

  const toggleBenefit = async (b) => {
    try {
      await axios.put(`/api/membership/admin/benefits/${b._id}`, { active: !b.active });
      toast.success('Đã cập nhật');
      await loadBenefits();
    } catch {
      toast.error('Lỗi');
    }
  };

  return (
    <div className={cx('page-content', 'membershipPage')}>
      <div className={cx('admin-nav')}>
        <div className={cx('admin-title')}>
          <i className="fa-solid fa-crown" />
          <span className={cx('admin-title-name')}>Quản lý hội viên</span>
        </div>
      </div>

      <div className={cx('membershipTabs')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cx('membershipTab', { membershipTabActive: tab === t.id })}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={cx('membershipLoading')}>Đang tải…</p>
      ) : (
        <>
          {tab === 'tiers' && (
            <>
              {tierAccountStats && (
                <div className={cx('data-card', 'membershipTierStatsCard')}>
                  <div className={cx('data-card-header')}>
                    <h3 className={cx('data-card-title')}>Thống kê tài khoản theo hạng (toàn hệ thống)</h3>
                  </div>
                  <div className={cx('data-card-body', 'membershipCardBody')}>
                    <div className={cx('membershipTierStatsSummary')}>
                      <span className={cx('membershipTierStatsPill')}>
                        Tổng tài khoản <em>{tierAccountStats.totalAccounts ?? 0}</em>
                      </span>
                      <span className={cx('membershipTierStatsPill')}>
                        Đã gán hạng hội viên <em>{tierAccountStats.withMembership ?? 0}</em>
                      </span>
                      <span className={cx('membershipTierStatsPill')}>
                        Tài khoản thường (chưa gán hạng) <em>{tierAccountStats.withoutTier ?? 0}</em>
                      </span>
                      {(tierAccountStats.orphanAccounts ?? 0) > 0 && (
                        <span className={cx('membershipTierStatsPill')}>
                          Gán hạng không còn trong cấu hình <em>{tierAccountStats.orphanAccounts}</em>
                        </span>
                      )}
                    </div>
                    <div className={cx('membershipTableWrap')}>
                      <table className={cx('membershipTable')}>
                        <thead>
                          <tr>
                            <th>Hạng</th>
                            <th>Slug</th>
                            <th style={{ textAlign: 'right' }}>Số tài khoản</th>
                            <th>Cấu hình hạng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tierAccountStats.byTier || []).map((row) => (
                            <tr key={String(row.tierId)}>
                              <td>{row.name}</td>
                              <td>{row.slug}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.accountCount}</td>
                              <td>{row.active ? 'Đang bật' : 'Tắt'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <div className={cx('data-card')}>
              <div className={cx('data-card-header')}>
                <h3 className={cx('data-card-title')}>Cấu hình hạng</h3>
              </div>
              <div className={cx('data-card-body', 'membershipCardBody')}>
                <p className={cx('membershipIntro')}>
                  Ngưỡng <strong>Chi tiêu tích lũy</strong> dùng khi đơn chuyển sang <em>Hoàn thành</em>. Giảm giá % áp trên tổng tiền hàng
                  trước khi tính phí ship.
                </p>
                {tiers.map((t) => (
                  <div key={t._id} className={cx('membershipTierCard')}>
                    <div className={cx('membershipTierTop')}>
                      <div className={cx('membershipTierMeta')}>
                        <div className={cx('membershipTierTitle')}>{t.name}</div>
                        <div className={cx('membershipTierSlug')}>slug: {t.slug}</div>
                      </div>
                      <label className={cx('membershipTierField')}>
                        <span className={cx('membershipFieldLabel')}>Giảm %</span>
                        <input
                          className={cx('input')}
                          type="number"
                          value={t.discountPercent}
                          onChange={(e) =>
                            setTiers((prev) =>
                              prev.map((x) => (x._id === t._id ? { ...x, discountPercent: e.target.value } : x)),
                            )
                          }
                        />
                      </label>
                      <label className={cx('membershipTierField')}>
                        <span className={cx('membershipFieldLabel')}>Ngưỡng chi tiêu (đồng)</span>
                        <input
                          className={cx('input')}
                          type="number"
                          value={t.minTotalSpentDong}
                          onChange={(e) =>
                            setTiers((prev) =>
                              prev.map((x) => (x._id === t._id ? { ...x, minTotalSpentDong: e.target.value } : x)),
                            )
                          }
                        />
                      </label>
                      <label className={cx('membershipTierField')}>
                        <span className={cx('membershipFieldLabel')}>Ship miễn từ (đồng, để trống nếu shipFreeAll)</span>
                        <input
                          className={cx('input')}
                          type="number"
                          value={t.shipFreeMinSubtotalDong ?? ''}
                          onChange={(e) =>
                            setTiers((prev) =>
                              prev.map((x) =>
                                x._id === t._id ? { ...x, shipFreeMinSubtotalDong: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className={cx('membershipTierField')}>
                        <span className={cx('membershipFieldLabel')}>Điểm / 1000đ</span>
                        <input
                          className={cx('input')}
                          type="number"
                          value={t.pointsPer1000Vnd}
                          onChange={(e) =>
                            setTiers((prev) =>
                              prev.map((x) => (x._id === t._id ? { ...x, pointsPer1000Vnd: e.target.value } : x)),
                            )
                          }
                        />
                      </label>
                      <div className={cx('membershipCheckboxCol')}>
                        <label className={cx('membershipCheckboxRow')}>
                          <input
                            type="checkbox"
                            checked={!!t.shipFreeAll}
                            onChange={(e) =>
                              setTiers((prev) =>
                                prev.map((x) => (x._id === t._id ? { ...x, shipFreeAll: e.target.checked } : x)),
                              )
                            }
                          />
                          Miễn ship mọi đơn
                        </label>
                        <label className={cx('membershipCheckboxRow')}>
                          <input
                            type="checkbox"
                            checked={!!t.active}
                            onChange={(e) =>
                              setTiers((prev) =>
                                prev.map((x) => (x._id === t._id ? { ...x, active: e.target.checked } : x)),
                              )
                            }
                          />
                          Đang bật
                        </label>
                      </div>
                    </div>
                    <div className={cx('membershipSaveRow')}>
                      <button type="button" className="btn btn--primary" onClick={() => saveTier(t)}>
                        Lưu «{t.name}»
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}

          {tab === 'benefits' && (
            <div className={cx('data-card')}>
              <div className={cx('data-card-header')}>
                <h3 className={cx('data-card-title')}>MemberBenefit</h3>
              </div>
              <div className={cx('data-card-body', 'membershipCardBody')}>
                {benefits.length === 0 ? (
                  <p className={cx('membershipEmpty')}>Chưa có benefit tùy chỉnh — hệ thống dùng cấu hình từ bảng hạng.</p>
                ) : (
                  <div className={cx('membershipTableWrap')}>
                    <table className={cx('membershipTable')}>
                      <thead>
                        <tr>
                          <th>Hạng</th>
                          <th>Loại</th>
                          <th>Tiêu đề</th>
                          <th>Bật</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benefits.map((b) => (
                          <tr key={b._id}>
                            <td>{b.membershipTier?.name || '—'}</td>
                            <td>{b.benefitKind}</td>
                            <td>{b.title}</td>
                            <td>
                              <button type="button" className={cx('dashboardSettingsBtn')} onClick={() => toggleBenefit(b)}>
                                {b.active ? 'Tắt' : 'Bật'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'logs' && (
            <div className={cx('data-card')}>
              <div className={cx('data-card-header')}>
                <h3 className={cx('data-card-title')}>MembershipLog</h3>
              </div>
              <div className={cx('data-card-body', 'membershipCardBody')}>
                <div className={cx('membershipTableWrap')}>
                  <table className={cx('membershipTable')} style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Email</th>
                        <th>Từ → Đến</th>
                        <th style={{ textAlign: 'right' }}>Tổng chi (đồng)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l._id}>
                          <td>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</td>
                          <td>{l.email}</td>
                          <td>
                            {l.fromTierSlug} → {l.toTierSlug}
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatVndDisplay(l.totalSpentDong)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'points' && (
            <div className={cx('data-card')}>
              <div className={cx('data-card-header')}>
                <h3 className={cx('data-card-title')}>PointTransaction</h3>
              </div>
              <div className={cx('data-card-body', 'membershipCardBody')}>
                <div className={cx('membershipTableWrap')}>
                  <table className={cx('membershipTable')} style={{ minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Email</th>
                        <th>Loại</th>
                        <th style={{ textAlign: 'right' }}>Điểm</th>
                        <th style={{ textAlign: 'right' }}>Sau GD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p._id}>
                          <td>{p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : '—'}</td>
                          <td>{p.email}</td>
                          <td>{p.type}</td>
                          <td style={{ textAlign: 'right' }}>{p.points}</td>
                          <td style={{ textAlign: 'right' }}>{p.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ManageMembership;
