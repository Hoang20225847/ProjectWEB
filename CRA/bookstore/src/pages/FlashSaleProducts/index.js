import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookCard, { BookCardGrid } from '../../components/BookCard/BookCard';
import { getLiveFlashSales } from '../../app/api/FlashSaleApi';
import { getCategoryList } from '../../app/api/siteApi.js';
import { bookMatchesCategoryQuery } from '../../utils/categoryUtils.js';
import FlashSaleSidebar from './FlashSaleSidebar.js';
import styles from '../Categori/SearchSidebar.module.scss';

const PER_PAGE_OPTIONS = [7, 14, 21, 28, 35, 42];
const DEFAULT_PER_PAGE = 14;

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

function sortBooks(arr, sortType) {
  const sorted = [...arr];
  switch (sortType) {
    case 0:
      sorted.sort((a, b) => Number(b.evaluate) - Number(a.evaluate));
      break;
    case 1:
      sorted.sort((a, b) => new Date(b.createAt) - new Date(a.createAt));
      break;
    case 2:
      sorted.sort((a, b) => Number(b.sold) - Number(a.sold));
      break;
    case 3:
      sorted.sort((a, b) => Number(a.price) - Number(b.price));
      break;
    case 4:
      sorted.sort((a, b) => Number(b.price) - Number(a.price));
      break;
    default:
      break;
  }
  return sorted;
}

function buildPaginationItems(totalPages, current) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set([1, totalPages, current, current - 1, current + 1, current - 2, current + 2]);
  const nums = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of nums) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

function mergeFlashBooks(sales) {
  const byId = new Map();
  for (const sale of sales || []) {
    for (const book of normalizeSaleBooks(sale)) {
      const id = String(book._id);
      const prev = byId.get(id);
      if (!prev || Number(book.discount) > Number(prev.discount)) {
        byId.set(id, book);
      }
    }
  }
  return [...byId.values()];
}

export default function FlashSaleProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sortType, setSortType] = useState(100);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const priceMenuRef = useRef(null);

  const saleIdFromQuery = String(searchParams.get('sale') || '').trim();
  const categorySlug =
    searchParams.get('categorySlug') || searchParams.get('category') || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getLiveFlashSales();
        if (!cancelled) setSales(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setSales([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const list = await getCategoryList();
      setCategories(Array.isArray(list) ? list : []);
    })();
  }, []);

  useEffect(() => {
    if (!priceMenuOpen) return undefined;
    const onDown = (e) => {
      if (priceMenuRef.current && !priceMenuRef.current.contains(e.target)) {
        setPriceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [priceMenuOpen]);

  const visibleSales = useMemo(() => {
    const rows = Array.isArray(sales) ? sales : [];
    if (!saleIdFromQuery) return rows;
    const match = rows.find((s) => String(s?._id || '') === saleIdFromQuery);
    return match ? [match] : rows;
  }, [sales, saleIdFromQuery]);

  const bookCountBySale = useMemo(() => {
    const counts = {};
    for (const sale of sales || []) {
      counts[String(sale._id)] = normalizeSaleBooks(sale).length;
    }
    return counts;
  }, [sales]);

  const sourceBooks = useMemo(() => {
    if (!sales) return null;
    const merged = mergeFlashBooks(visibleSales);
    if (!categorySlug) return merged;
    return merged.filter((b) => bookMatchesCategoryQuery(b, categorySlug));
  }, [sales, visibleSales, categorySlug]);

  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const rawPer = parseInt(searchParams.get('perPage') || String(DEFAULT_PER_PAGE), 10);
  const perPage = PER_PAGE_OPTIONS.includes(rawPer) ? rawPer : DEFAULT_PER_PAGE;

  const orderedBooks = useMemo(
    () => (sourceBooks ? sortBooks(sourceBooks, sortType) : []),
    [sourceBooks, sortType]
  );

  const total = orderedBooks.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(pageFromUrl, totalPages);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, saleIdFromQuery, categorySlug, sortType, perPage]);

  useEffect(() => {
    if (pageFromUrl !== currentPage) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (currentPage <= 1) n.delete('page');
          else n.set('page', String(currentPage));
          return n;
        },
        { replace: true }
      );
    }
  }, [pageFromUrl, currentPage, setSearchParams]);

  const pagedBooks = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return orderedBooks.slice(start, start + perPage);
  }, [orderedBooks, currentPage, perPage]);

  const setPage = useCallback(
    (p) => {
      const next = Math.max(1, Math.min(p, totalPages));
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next <= 1) n.delete('page');
          else n.set('page', String(next));
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams, totalPages]
  );

  const setPerPage = useCallback(
    (pp) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set('perPage', String(pp));
          n.delete('page');
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleSelectSale = useCallback(
    (saleId) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (saleId) n.set('sale', saleId);
          else n.delete('sale');
          n.delete('page');
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleSelectCategory = useCallback(
    (slug) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (slug) {
            n.set('categorySlug', slug);
            n.delete('category');
          } else {
            n.delete('categorySlug');
            n.delete('category');
          }
          n.delete('page');
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleSortClick = useCallback((e, type) => {
    e.preventDefault();
    setSortType(type);
  }, []);

  const handlePriceSort = useCallback((e, type) => {
    e.preventDefault();
    setSortType(type);
    setPriceMenuOpen(false);
  }, []);

  if (sales === null) {
    return <div className={styles.searchPageRoot}>Đang tải...</div>;
  }

  const paginationItems = buildPaginationItems(totalPages, currentPage);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(currentPage * perPage, total);

  return (
    <div className={styles.searchPageRoot}>
      <div className={styles.searchPageRow}>
        <FlashSaleSidebar
          sales={sales}
          activeSaleId={saleIdFromQuery}
          activeCategorySlug={categorySlug}
          categories={categories}
          bookCountBySale={bookCountBySale}
          onSelectSale={handleSelectSale}
          onSelectCategory={handleSelectCategory}
        />

        <div className={styles.searchMain}>
          <div className={styles.searchToolbar}>
            <span className={styles.searchToolbarLabel}>Sắp xếp theo</span>
            <div className={styles.searchToolbarSort}>
              <button
                type="button"
                className={`${styles.searchToolbarBtn} ${sortType === 0 ? styles.searchToolbarBtnActive : ''}`}
                onClick={(e) => handleSortClick(e, 0)}
              >
                Chất lượng
              </button>
              <button
                type="button"
                className={`${styles.searchToolbarBtn} ${sortType === 1 ? styles.searchToolbarBtnActive : ''}`}
                onClick={(e) => handleSortClick(e, 1)}
              >
                Mới nhất
              </button>
              <button
                type="button"
                className={`${styles.searchToolbarBtn} ${sortType === 2 ? styles.searchToolbarBtnActive : ''}`}
                onClick={(e) => handleSortClick(e, 2)}
              >
                Bán chạy
              </button>
              <div className={styles.priceDropdownWrap} ref={priceMenuRef}>
                <button
                  type="button"
                  className={`${styles.priceDropdownBtn} ${sortType === 3 || sortType === 4 ? styles.searchToolbarBtnActive : ''}`}
                  onClick={() => setPriceMenuOpen((o) => !o)}
                  aria-expanded={priceMenuOpen}
                >
                  Giá
                  <i className="fa-solid fa-angle-down" />
                </button>
                {priceMenuOpen && (
                  <ul className={styles.priceDropdownMenu} role="menu">
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className={sortType === 3 ? styles.priceDropdownItemActive : ''}
                        onClick={(e) => handlePriceSort(e, 3)}
                      >
                        Giá: thấp → cao
                      </button>
                    </li>
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className={sortType === 4 ? styles.priceDropdownItemActive : ''}
                        onClick={(e) => handlePriceSort(e, 4)}
                      >
                        Giá: cao → thấp
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>
            <div className={styles.searchToolbarMeta}>
              <label htmlFor="flash-per-page">
                Hiển thị / trang:{' '}
                <select
                  id="flash-per-page"
                  className={styles.perPageSelect}
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} cuốn
                    </option>
                  ))}
                </select>
              </label>
              <span>
                <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> / <strong>{total}</strong> sách
              </span>
            </div>
          </div>

          {total === 0 ? (
            <p className={styles.searchEmpty}>
              {sales.length === 0
                ? 'Hiện chưa có flash sale nào đang diễn ra.'
                : 'Không có sách phù hợp với bộ lọc đã chọn.'}
            </p>
          ) : (
            <BookCardGrid>
              {pagedBooks.map((book) => (
                <BookCard key={String(book._id)} book={book} layout="grid" />
              ))}
            </BookCardGrid>
          )}

          {total > 0 && totalPages > 1 && (
            <nav className={styles.searchPagination} aria-label="Phân trang flash sale">
              <button
                type="button"
                className={styles.paginationBtn}
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Trang trước"
              >
                ‹ Trước
              </button>
              {paginationItems.map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className={styles.paginationEllipsis}>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.paginationBtn} ${item === currentPage ? styles.paginationBtnActive : ''}`}
                    onClick={() => setPage(item)}
                    aria-current={item === currentPage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className={styles.paginationBtn}
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Trang sau"
              >
                Sau ›
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
