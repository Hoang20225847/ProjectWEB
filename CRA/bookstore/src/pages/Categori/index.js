import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getBookList, getCategoryList } from '../../app/api/siteApi.js';
import axios from '../../components/axios/axios.customize.js';
import BookCard, { BookCardGrid } from '../../components/BookCard/BookCard.js';
import { toast } from 'react-toastify';
import { bookMatchesCategoryQuery } from '../../utils/categoryUtils.js';
import SearchSidebar from './SearchSidebar.js';
import styles from './SearchSidebar.module.scss';
import { SEARCH_FILTER_QUERY_KEYS } from './searchFilterConstants.js';

/** Bội số của 7 — khớp số cột mỗi dòng lưới */
const PER_PAGE_OPTIONS = [7, 14, 21, 28, 35, 42];
const DEFAULT_PER_PAGE = 14;

function hasStructuredFilters(qp) {
  if (qp.get('category')) return true;
  return SEARCH_FILTER_QUERY_KEYS.some((k) => qp.get(k));
}

/** Query không gồm page/perPage — đổi bộ lọc thì reset về trang 1 */
function filterSignatureFromSearch(search) {
  const sp = new URLSearchParams(search);
  sp.delete('page');
  sp.delete('perPage');
  const keys = [...sp.keys()].sort();
  const out = new URLSearchParams();
  keys.forEach((k) => {
    out.set(k, sp.get(k));
  });
  return out.toString();
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

function Category() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortType, setSortType] = useState(100);
  const [sourceBooks, setSourceBooks] = useState(null);
  const [categories, setCategories] = useState([]);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const priceMenuRef = useRef(null);

  const filterSig = useMemo(() => filterSignatureFromSearch(location.search), [location.search]);
  const prevSigRef = useRef(undefined);

  useEffect(() => {
    if (prevSigRef.current !== undefined && prevSigRef.current !== filterSig) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('page');
          return n;
        },
        { replace: true }
      );
    }
    prevSigRef.current = filterSig;
  }, [filterSig, setSearchParams]);

  useEffect(() => {
    (async () => {
      const list = await getCategoryList();
      setCategories(Array.isArray(list) ? list : []);
    })();
  }, []);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const keysearch = qp.get('keysearch');
    const category = qp.get('category');
    const structured = hasStructuredFilters(qp);

    async function fetchData() {
      if (keysearch && !structured) {
        try {
          const response = await axios.get(`/api/books/search?key=${encodeURIComponent(keysearch)}`);
          setSourceBooks(Array.isArray(response) ? response : []);
        } catch (error) {
          console.log(error);
          toast.error('Lỗi Tìm Kiếm');
          setSourceBooks([]);
        }
        return;
      }

      if (structured) {
        try {
          const params = new URLSearchParams();
          SEARCH_FILTER_QUERY_KEYS.forEach((k) => {
            const v = qp.get(k);
            if (v) params.set(k, v);
          });
          const legacySlug = qp.get('category');
          if (legacySlug && !params.get('categorySlug')) {
            params.set('categorySlug', legacySlug);
          }
          const response = await axios.get(`/api/books/filter?${params.toString()}`);
          setSourceBooks(Array.isArray(response) ? response : []);
        } catch (error) {
          console.log(error);
          toast.error('Lỗi khi lọc sách');
          setSourceBooks([]);
        }
        return;
      }

      const json = await getBookList();
      const list = Array.isArray(json) ? json : [];
      setSourceBooks(category ? list.filter((item) => bookMatchesCategoryQuery(item, category)) : list);
    }

    fetchData();
  }, [location.search]);

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

  const handleSortClick = useCallback((e, type) => {
    e.preventDefault();
    setSortType(type);
  }, []);

  const handlePriceSort = useCallback((e, type) => {
    e.preventDefault();
    setSortType(type);
    setPriceMenuOpen(false);
  }, []);

  if (!sourceBooks) {
    return <div className={styles.searchPageRoot}>Đang tải...</div>;
  }

  const paginationItems = buildPaginationItems(totalPages, currentPage);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(currentPage * perPage, total);

  return (
    <div className={styles.searchPageRoot}>
      <div className={styles.searchPageRow}>
        <SearchSidebar
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          categories={categories}
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
              <label htmlFor="search-per-page">
                Hiển thị / trang:{' '}
                <select
                  id="search-per-page"
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
            <p className={styles.searchEmpty}>Không tìm thấy sách phù hợp.</p>
          ) : (
            <BookCardGrid>
              {pagedBooks.map((item) => (
                <BookCard key={item._id} book={item} layout="grid" />
              ))}
            </BookCardGrid>
          )}

          {total > 0 && totalPages > 1 && (
            <nav className={styles.searchPagination} aria-label="Phân trang kết quả">
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

export default Category;
