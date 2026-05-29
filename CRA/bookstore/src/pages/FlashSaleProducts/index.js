import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookCard, { BookCardGrid } from '../../components/BookCard/BookCard';
import { getLiveFlashSales } from '../../app/api/FlashSaleApi';
import styles from './FlashSaleProducts.module.scss';

function normalizeSaleBooks(sale) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items
    .map((it) => {
      const b = it?.bookId && typeof it.bookId === 'object' ? it.bookId : null;
      if (!b) return null;
      const flashDisc = Math.max(0, Math.min(99, Number(it.discountPercent) || 0));
      if (flashDisc <= 0) return null;
      return {
        ...b,
        // Ưu tiên tuyệt đối flash sale khi đang live.
        discount: flashDisc,
        flashSale: {
          status: 'live',
          flashSaleId: String(sale._id || ''),
          title: sale.title || '',
          discountPercent: flashDisc,
          startsAt: sale.startsAt,
          endsAt: sale.endsAt,
          originalDiscount: Number(b.discount) || 0,
        },
      };
    })
    .filter(Boolean);
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function FlashSaleProducts() {
  const [searchParams] = useSearchParams();
  const saleIdFromQuery = String(searchParams.get('sale') || '').trim();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getLiveFlashSales();
        if (cancelled) return;
        setSales(Array.isArray(rows) ? rows : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSales = useMemo(() => {
    const rows = Array.isArray(sales) ? sales : [];
    if (!saleIdFromQuery) return rows;
    const match = rows.find((s) => String(s?._id || '') === saleIdFromQuery);
    return match ? [match] : rows;
  }, [sales, saleIdFromQuery]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>
            <i className="fa-solid fa-bolt" />
            FLASH SALE ĐANG DIỄN RA
          </span>
          <h1 className={styles.title}>Toàn bộ sản phẩm Flash Sale</h1>
          <p className={styles.subtitle}>
            Hiển thị đầy đủ sản phẩm trong các chương trình flash sale đang chạy.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Đang tải danh sách flash sale...</div>
      ) : visibleSales.length === 0 ? (
        <div className={styles.empty}>Hiện chưa có flash sale nào đang diễn ra.</div>
      ) : (
        <div className={styles.saleList}>
          {visibleSales.map((sale) => {
            const books = normalizeSaleBooks(sale);
            if (books.length === 0) return null;
            return (
              <section key={String(sale._id)} className={styles.saleSection}>
                <div className={styles.saleHeader}>
                  <div>
                    <h2 className={styles.saleTitle}>{sale.title || 'Flash Sale'}</h2>
                    {sale.description ? <p className={styles.saleDesc}>{sale.description}</p> : null}
                  </div>
                  <div className={styles.saleMeta}>
                    <span>
                      <i className="fa-regular fa-clock" />
                      {formatDateTime(sale.startsAt)} - {formatDateTime(sale.endsAt)}
                    </span>
                    <span>
                      <i className="fa-solid fa-book" />
                      {books.length} sản phẩm
                    </span>
                  </div>
                </div>
                <BookCardGrid className={styles.grid}>
                  {books.map((book) => (
                    <BookCard key={String(book._id)} book={book} />
                  ))}
                </BookCardGrid>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
