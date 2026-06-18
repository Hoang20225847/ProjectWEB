import { Link } from 'react-router-dom';
import styles from '../Categori/SearchSidebar.module.scss';

function formatSaleRange(sale) {
  const start = sale?.startsAt ? new Date(sale.startsAt) : null;
  const end = sale?.endsAt ? new Date(sale.endsAt) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const fmt = (d) =>
    d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function FlashSaleSidebar({
  sales = [],
  activeSaleId = '',
  activeCategorySlug = '',
  categories = [],
  bookCountBySale = {},
  onSelectSale,
  onSelectCategory,
}) {
  return (
    <aside className={styles.searchSidebar} aria-label="Flash sale và danh mục">
      <div className={styles.searchSidebarScroll}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderIcon} aria-hidden style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.12))', color: '#b91c1c' }}>
            <i className="fa-solid fa-bolt" />
          </div>
          <div>
            <p className={styles.panelHeaderText}>Flash Sale</p>
            <p className={styles.panelHeaderSub}>Chương trình giảm giá đang diễn ra</p>
          </div>
        </div>

        <section className={styles.section}>
          <h3 className={styles.blockTitle}>Chương trình</h3>
          <ul className={styles.catList}>
            <li>
              <button
                type="button"
                className={`${styles.catBtn} ${activeSaleId === '' ? styles.catBtnActive : ''}`}
                onClick={() => onSelectSale('')}
              >
                Tất cả flash sale
              </button>
            </li>
            {sales.map((sale) => {
              const id = String(sale._id || '');
              const count = bookCountBySale[id] || 0;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`${styles.catBtn} ${activeSaleId === id ? styles.catBtnActive : ''}`}
                    onClick={() => onSelectSale(id)}
                  >
                    <span>{sale.title || 'Flash Sale'}</span>
                    {count > 0 && (
                      <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 500, color: '#64748b', marginTop: 2 }}>
                        {count} sách · {formatSaleRange(sale)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {sales.length === 0 && (
            <p className={styles.panelHeaderSub} style={{ padding: '0 0.25rem' }}>
              Chưa có chương trình đang chạy
            </p>
          )}
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <h3 className={styles.blockTitle}>Danh mục sách</h3>
          <ul className={styles.catList}>
            <li>
              <button
                type="button"
                className={`${styles.catBtn} ${activeCategorySlug === '' ? styles.catBtnActive : ''}`}
                onClick={() => onSelectCategory('')}
              >
                Tất cả
              </button>
            </li>
            {(categories || []).map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  className={`${styles.catBtn} ${activeCategorySlug === c.slug ? styles.catBtnActive : ''}`}
                  onClick={() => onSelectCategory(c.slug)}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <Link to="/search" className={styles.catBtn} style={{ textAlign: 'center' }}>
            Xem toàn bộ sách →
          </Link>
        </section>
      </div>
    </aside>
  );
}
