import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import pageStyles from './ManageChatbot.module.scss';
import { getChatbotOverview, getChatbotFeedbacks } from '../../app/api/ChatbotAdminApi';

const cx = classNames.bind(pageStyles);

const ISSUE_LABELS = {
  yes: 'Đã giải quyết',
  no: 'Chưa giải quyết',
  partial: 'Giải quyết một phần',
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function IssueBadge({ value }) {
  if (!value) return <span className={cx('badge', 'badgeMuted')}>—</span>;
  const cls =
    value === 'yes' ? 'badgeYes' : value === 'no' ? 'badgeNo' : value === 'partial' ? 'badgePartial' : 'badgeMuted';
  return <span className={cx('badge', cls)}>{ISSUE_LABELS[value] || value}</span>;
}

function Stars({ n }) {
  if (!n) return '—';
  return <span className={cx('stars')}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function ManageChatbot() {
  const [range, setRange] = useState(defaultRange);
  const [overview, setOverview] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterResolved, setFilterResolved] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: range.from, to: range.to, limit: 50 };
      if (filterResolved) params.issueResolved = filterResolved;
      const [ov, fb] = await Promise.all([
        getChatbotOverview({ from: range.from, to: range.to }),
        getChatbotFeedbacks(params),
      ]);
      setOverview(ov);
      setFeedbacks(Array.isArray(fb?.items) ? fb.items : Array.isArray(fb) ? fb : []);
    } catch (e) {
      console.error(e);
      setOverview(null);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, filterResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = useMemo(() => {
    if (!overview) return [];
    return [
      { label: 'Tổng phiên chat', value: overview.sessions?.total ?? 0 },
      {
        label: 'Đánh giá trung bình',
        value: overview.rating?.avg ? `${overview.rating.avg} ★` : '—',
        sub: `${overview.rating?.count ?? 0} lượt đánh giá`,
      },
      {
        label: 'Đã giải quyết (Có)',
        value: overview.issueResolved?.yes ?? 0,
        sub: `${overview.issueResolved?.resolvedPct ?? 0}% trong số đã trả lời`,
      },
      {
        label: 'Chưa giải quyết',
        value: overview.issueResolved?.no ?? 0,
        sub: `${overview.issueResolved?.partial ?? 0} một phần`,
      },
      {
        label: 'Token TB / phiên',
        value: overview.tokens?.avgPerSession ?? 0,
        sub: `Tổng ~${overview.tokens?.total ?? 0}`,
      },
      {
        label: 'Tỷ lệ có đánh giá',
        value: `${overview.sessions?.ratePct ?? 0}%`,
        sub: `${overview.sessions?.rated ?? 0} phiên`,
      },
    ];
  }, [overview]);

  return (
    <div className={cx('page')}>
      <h1 className={cx('pageTitle')}>Chatbot — Đánh giá & hiệu quả</h1>
      <p className={cx('pageDesc')}>
        Chỉ lưu tóm tắt phiên (rating, giải quyết vấn đề, nhận xét, token) — không lưu nội dung hội thoại để tiết kiệm dữ liệu.
      </p>

      <div className={cx('toolbar')}>
        <label>
          Từ{' '}
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label>
          Đến{' '}
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <select value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)}>
          <option value="">Tất cả — giải quyết</option>
          <option value="yes">Đã giải quyết</option>
          <option value="partial">Một phần</option>
          <option value="no">Chưa giải quyết</option>
        </select>
        <button type="button" className={cx('btnPrimary')} onClick={load}>
          Làm mới
        </button>
      </div>

      {loading && !overview ? (
        <div className={cx('loading')}>Đang tải…</div>
      ) : (
        <>
          <div className={cx('kpiGrid')}>
            {kpi.map((c) => (
              <div key={c.label} className={cx('kpiCard')}>
                <div className={cx('kpiLabel')}>{c.label}</div>
                <div className={cx('kpiValue')}>{c.value}</div>
                {c.sub && <div className={cx('kpiSub')}>{c.sub}</div>}
              </div>
            ))}
          </div>

          <div className={cx('tableWrap')}>
            <table className={cx('table')}>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Phiên / Email</th>
                  <th>Giải quyết?</th>
                  <th>Rating</th>
                  <th>Nhận xét</th>
                  <th>Token</th>
                  <th>Kết thúc</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={cx('emptyRow')}>
                      Chưa có dữ liệu đánh giá trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  feedbacks.map((row) => (
                    <tr key={row.sessionId}>
                      <td>
                        {(row.ratedAt || row.createdAt)
                          ? new Date(row.ratedAt || row.createdAt).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td>
                        <div className={cx('cellTitle')}>{row.title || 'Cuộc trò chuyện'}</div>
                        <div className={cx('cellMuted')}>{row.userEmail || 'Khách'}</div>
                      </td>
                      <td>
                        <IssueBadge value={row.issueResolved} />
                      </td>
                      <td>
                        <Stars n={row.rating} />
                      </td>
                      <td className={cx('cellComment')}>{row.feedback || '—'}</td>
                      <td>{row.totalTokensUsed ?? '—'}</td>
                      <td>{row.endReason || row.status || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default ManageChatbot;
