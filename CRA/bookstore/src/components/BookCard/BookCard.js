import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useContext } from 'react';
import { formatVndDisplay, listPriceVnd, salePriceDisplayVnd } from '../function/function.js';
import styles from './BookCard.module.scss';
import { AuthContext } from '../context/auth.context.js';
import FlashSaleBadge from '../FlashSaleBadge/FlashSaleBadge.js';

function formatCount(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v < 0) return '0';
  return v.toLocaleString('vi-VN');
}

function formatRating(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return '0';
  return (Math.round(n * 10) / 10).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/**
 * Thẻ sách — cùng giao diện với hàng sách trang chủ (CategoryBookRow).
 * @param {'scroll'|'grid'} layout
 */
export default function BookCard({ book: item, meta: _meta, layout = 'grid' }) {
  const { auth } = useContext(AuthContext);
  const isMember = !!auth?.user?.isMember;
  const isMemberOnly = !!item?.isMemberOnly;
  const disc = Number(item?.discount) || 0;
  const effectiveDiscount = isMemberOnly && !isMember ? 0 : disc;
  const hasDiscount = effectiveDiscount > 0;
  const sold = Number(item?.sold) || 0;
  const evaluate = Number(item?.evaluate);
  const rating = Number.isNaN(evaluate) ? 0 : Math.min(5, Math.max(0, evaluate));
  const purchaseCountRaw = item?.purchaseCount ?? item?.orderCount;
  const purchaseExplicit =
    purchaseCountRaw != null && purchaseCountRaw !== '' ? Number(purchaseCountRaw) : null;
  const hasDistinctPurchase =
    purchaseExplicit != null && !Number.isNaN(purchaseExplicit) && purchaseExplicit !== sold;
  const hasStock = typeof item.stock === 'number' && !Number.isNaN(item.stock);

  return (
    <div className={layout === 'scroll' ? styles.rootScroll : styles.rootGrid}>
      <Link to={`/details/${encodeURIComponent(item.name)}`} className={styles.cardLink}>
        <div className={styles.cardImgWrap}>
          <div className={styles.cardImg} style={{ backgroundImage: `url('${item.img}')` }} />
          {isMemberOnly && (
            <span className={styles.badgeMember}>
              <i className="fa-solid fa-crown" aria-hidden />
              HỘI VIÊN
            </span>
          )}
          {hasDiscount && (
            <div className={styles.promoBadge} aria-label={`Giảm giá ${disc} phần trăm`}>
              <span className={styles.promoPercent}>-{effectiveDiscount}%</span>
              <span className={styles.promoLabel}>GIẢM</span>
            </div>
          )}
          {item?.flashSale && (
            <FlashSaleBadge
              status={item.flashSale.status}
              startsAt={item.flashSale.startsAt}
              endsAt={item.flashSale.endsAt}
              discountPercent={item.flashSale.discountPercent}
              variant="overlay"
            />
          )}
        </div>
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{item.name}</h3>
          <div className={styles.cardStats} role="group" aria-label="Thống kê sách">
            <span className={styles.statItem} title="Điểm đánh giá">
              <i className={clsx('fa-solid fa-star', styles.statIconRating)} aria-hidden />
              <span className={styles.statNum}>{formatRating(rating)}</span>
              <span className={styles.statSuffix}>/5</span>
            </span>
            <span className={styles.statSep} aria-hidden>
              ·
            </span>
            <span className={styles.statItem} title="Đã bán">
              <i className={clsx('fa-solid fa-fire-flame-curved', styles.statIcon)} aria-hidden />
              <span className={styles.statNum}>{formatCount(sold)}</span>
              <span className={styles.statSuffix}>đã bán</span>
            </span>
            {hasDistinctPurchase && (
              <>
                <span className={styles.statSep} aria-hidden>
                  ·
                </span>
                <span className={styles.statItem} title="Lượt mua (đơn)">
                  <i className={clsx('fa-solid fa-bag-shopping', styles.statIcon)} aria-hidden />
                  <span className={styles.statNum}>{formatCount(purchaseExplicit)}</span>
                  <span className={styles.statSuffix}>mua</span>
                </span>
              </>
            )}
            {hasStock && (
              <>
                <span className={styles.statSep} aria-hidden>
                  ·
                </span>
                <span className={styles.statItem} title="Tồn kho">
                  <i className={clsx('fa-solid fa-boxes-stacked', styles.statIconStock)} aria-hidden />
                  <span className={styles.statNum}>{formatCount(item.stock)}</span>
                  <span className={styles.statSuffix}>còn</span>
                </span>
              </>
            )}
          </div>
          <div className={styles.cardFooter}>
            {hasDiscount ? (
              <div className={styles.priceRow}>
                <span className={styles.discTag}>-{effectiveDiscount}%</span>
                <div className={styles.priceStack}>
                  <span className={styles.cardPriceOld}>{formatVndDisplay(listPriceVnd(item.price))}</span>
                  <span className={styles.cardPrice}>{formatVndDisplay(salePriceDisplayVnd(item.price, effectiveDiscount))}</span>
                </div>
              </div>
            ) : (
              <span className={styles.cardPrice}>{formatVndDisplay(listPriceVnd(item.price))}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function BookCardGrid({ children, className }) {
  return <div className={clsx(styles.bookGrid, className)}>{children}</div>;
}
