import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLiveFlashSales, getUpcomingFlashSales } from '../../app/api/FlashSaleApi';
import { formatVndDisplay, listPriceVnd, salePriceDisplayVnd } from '../function/function';
import styles from './FlashSaleSection.module.scss';
import { resolveMediaUrl } from '../../config/api';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatRemaining(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (days > 0) return `${days} ngày ${pad(h)}h${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function resolveBookImage(book) {
  const raw = book?.img || book?.image || book?.thumbnail || '';
  return resolveMediaUrl(String(raw || '').trim());
}

export default function FlashSaleSection() {
  const [live, setLive] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [l, u] = await Promise.all([
        getLiveFlashSales(),
        getUpcomingFlashSales(7),
      ]);
      if (!mounted) return;
      setLive(Array.isArray(l) ? l : []);
      setUpcoming(Array.isArray(u) ? u : []);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (live.length === 0 && upcoming.length === 0) return undefined;
    const id = setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => clearInterval(id);
  }, [live.length, upcoming.length]);

  const now = Date.now();

  const liveSale = useMemo(() => {
    return live.find((s) => new Date(s.endsAt).getTime() > now) || null;
  }, [live, now]);

  const upcomingSale = useMemo(() => {
    return upcoming.find((s) => new Date(s.startsAt).getTime() > now) || null;
  }, [upcoming, now]);

  if (!liveSale && !upcomingSale) return null;

  const renderItems = (items, discountField) => {
    return (items || []).slice(0, 8).map((it) => {
      const b = it.bookId && typeof it.bookId === 'object' ? it.bookId : null;
      if (!b) return null;
      const disc = Number(it.discountPercent) || 0;
      const list = listPriceVnd(b.price);
      const sale = salePriceDisplayVnd(b.price, disc);
      const img = resolveBookImage(b);
      return (
        <Link
          key={String(b._id)}
          to={`/details/${encodeURIComponent(b.name)}`}
          className={styles.itemCard}
        >
          <div className={styles.itemImgWrap}>
            {img ? (
              <img src={img} alt={b.name} className={styles.itemImg} />
            ) : (
              <div className={styles.itemImgFallback}>
                <i className="fa-solid fa-book" />
              </div>
            )}
            <span className={styles.itemBadge}>-{disc}%</span>
          </div>
          <div className={styles.itemBody}>
            <div className={styles.itemName}>{b.name}</div>
            {discountField === 'live' ? (
              <div className={styles.itemPriceRow}>
                <span className={styles.itemSale}>{formatVndDisplay(sale)}</span>
                <span className={styles.itemList}>{formatVndDisplay(list)}</span>
              </div>
            ) : (
              <div className={styles.itemPreview}>
                <span className={styles.itemPreviewLabel}>Giá flash sale</span>
                <span className={styles.itemPreviewSale}>{formatVndDisplay(sale)}</span>
              </div>
            )}
          </div>
        </Link>
      );
    });
  };

  return (
    <section className={styles.section}>
      {liveSale && (
        <div className={`${styles.banner} ${styles.bannerLive}`}>
          <div className={styles.bannerHeader}>
            <div>
              <span className={styles.kicker}>
                <i className="fa-solid fa-bolt" /> ĐANG DIỄN RA
              </span>
              <h2 className={styles.title}>{liveSale.title}</h2>
              {liveSale.description && <p className={styles.desc}>{liveSale.description}</p>}
            </div>
            <div className={styles.timerBox}>
              <span className={styles.timerLabel}>Kết thúc sau</span>
              <span className={styles.timerValue}>
                {formatRemaining(new Date(liveSale.endsAt).getTime() - now)}
              </span>
            </div>
          </div>
          <div className={styles.itemRow}>{renderItems(liveSale.items, 'live')}</div>
          {(liveSale.items || []).length > 8 && (
            <div className={styles.bannerActions}>
              <Link
                to={`/flash-sale?sale=${encodeURIComponent(String(liveSale._id || ''))}`}
                className={styles.viewAllBtn}
              >
                Xem tất cả {(liveSale.items || []).length} sản phẩm flash sale
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          )}
        </div>
      )}

      {upcomingSale && (
        <div className={`${styles.banner} ${styles.bannerUpcoming}`}>
          <div className={styles.bannerHeader}>
            <div>
              <span className={styles.kickerUp}>
                <i className="fa-regular fa-bell" /> SẮP DIỄN RA
              </span>
              <h2 className={styles.title}>{upcomingSale.title}</h2>
              {upcomingSale.description && <p className={styles.desc}>{upcomingSale.description}</p>}
            </div>
            <div className={styles.timerBoxUp}>
              <span className={styles.timerLabel}>Bắt đầu sau</span>
              <span className={styles.timerValue}>
                {formatRemaining(new Date(upcomingSale.startsAt).getTime() - now)}
              </span>
              <span className={styles.startsAt}>
                {new Date(upcomingSale.startsAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            </div>
          </div>
          <div className={styles.itemRow}>{renderItems(upcomingSale.items, 'upcoming')}</div>
        </div>
      )}
    </section>
  );
}
