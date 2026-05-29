import { useEffect, useState } from 'react';
import clsx from 'clsx';
import styles from './FlashSaleBadge.module.scss';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatRemaining(ms, { compact = false } = {}) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (compact) {
    if (days > 0) return `${days}n ${pad(hours)}:${pad(minutes)}`;
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}`;
  }
  if (days > 0) return `${days} ngày ${pad(hours)}h${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Badge nhỏ gắn vào BookCard (vị trí absolute) thể hiện trạng thái flash sale.
 * - status='live': badge màu đỏ + countdown đến hết flash sale.
 * - status='upcoming': badge cam + countdown đến lúc bắt đầu (≤ 7h).
 *
 * @param {{ status: 'live'|'upcoming', startsAt: string|Date, endsAt: string|Date, discountPercent?: number, variant?: 'overlay'|'inline' }} props
 */
export default function FlashSaleBadge({
  status,
  startsAt,
  endsAt,
  discountPercent,
  variant = 'overlay',
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!status) return undefined;
    const id = setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!status) return null;

  const now = Date.now();
  if (status === 'live') {
    const end = endsAt ? new Date(endsAt).getTime() : 0;
    const remaining = Math.max(0, end - now);
    if (remaining <= 0) return null;
    return (
      <div className={clsx(styles.badge, styles.badgeLive, variant === 'inline' && styles.badgeInline)}>
        <span className={styles.label}>
          <i className="fa-solid fa-bolt" />
          FLASH SALE
        </span>
        {discountPercent ? <span className={styles.discount}>-{discountPercent}%</span> : null}
        <span className={styles.countdown}>
          <i className="fa-regular fa-clock" />
          Còn {formatRemaining(remaining, { compact: variant === 'overlay' })}
        </span>
      </div>
    );
  }

  if (status === 'upcoming') {
    const start = startsAt ? new Date(startsAt).getTime() : 0;
    const remaining = Math.max(0, start - now);
    if (remaining <= 0) return null;
    return (
      <div className={clsx(styles.badge, styles.badgeUpcoming, variant === 'inline' && styles.badgeInline)}>
        <span className={styles.label}>
          <i className="fa-regular fa-bell" />
          SẮP FLASH SALE
        </span>
        {discountPercent ? <span className={styles.discount}>-{discountPercent}%</span> : null}
        <span className={styles.countdown}>
          <i className="fa-regular fa-clock" />
          Bắt đầu sau {formatRemaining(remaining, { compact: variant === 'overlay' })}
        </span>
      </div>
    );
  }

  return null;
}
