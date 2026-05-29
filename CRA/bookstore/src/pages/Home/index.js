import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getBookList, getCategoryList } from '../../app/api/siteApi.js';
import { categoryIdStr } from '../../utils/categoryUtils.js';
import CategoryBookRow from './CategoryBookRow';
import styles from './Home.module.scss';
import { listPriceVnd } from '../../components/function/function.js';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import FlashSaleSection from '../../components/FlashSaleSection/FlashSaleSection.js';

const EMPTY_FILTERS = {
  bookName: '',
  year: '',
  author: '',
  categoryId: '',
  minRating: '',
  onSaleOnly: false,
  priceTier: '',
  publisher: '',
  format: '',
  productionYear: '',
  pagesMin: '',
  pagesMax: '',
  weightMin: '',
  weightMax: '',
  memberOnlyOnly: false,
};

/** Giá so sánh bộ lọc (đơn vị nghìn, đồng bộ nhãn &lt;150k / 150–300k). */
function bookPriceNum(book) {
  const vnd = listPriceVnd(book?.price);
  if (!vnd) return 0;
  return Math.round(vnd / 1000);
}

function countActiveFilters(f) {
  let n = 0;
  if (f.bookName?.trim()) n += 1;
  if (f.year) n += 1;
  if (f.author?.trim()) n += 1;
  if (f.categoryId) n += 1;
  if (f.minRating) n += 1;
  if (f.onSaleOnly) n += 1;
  if (f.priceTier) n += 1;
  if (f.publisher?.trim()) n += 1;
  if (f.format) n += 1;
  if (f.productionYear) n += 1;
  if (f.pagesMin || f.pagesMax) n += 1;
  if (f.weightMin || f.weightMax) n += 1;
  if (f.memberOnlyOnly) n += 1;
  return n;
}

function Home() {
  const [books, setBooks] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [tempFilters, setTempFilters] = useState({ ...EMPTY_FILTERS });
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    async function load() {
      const [b, c] = await Promise.all([getBookList(), getCategoryList()]);
      setBooks(Array.isArray(b) ? b : []);
      setCategories(Array.isArray(c) ? [...c].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []);
    }
    load();
  }, []);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDocDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
        setTempFilters({ ...filters });
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setFilterOpen(false);
        setTempFilters({ ...filters });
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen, filters]);

  const toggleFilterPanel = (e) => {
    e.stopPropagation();
    setFilterOpen((open) => {
      if (open) {
        setTempFilters({ ...filters });
        return false;
      }
      setTempFilters({ ...filters });
      return true;
    });
  };

  const handleApplyFilters = () => {
    setFilters({ ...tempFilters });
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setTempFilters({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
  };

  const activeCount = countActiveFilters(filters);
  const hasActiveFilters = activeCount > 0;

  const filteredBooks = useMemo(() => {
    if (!books) return null;
    let result = [...books];

    if (filters.bookName?.trim()) {
      const q = filters.bookName.trim().toLowerCase();
      result = result.filter((book) => book.name?.toLowerCase().includes(q));
    }

    if (filters.year) {
      result = result.filter(
        (book) =>
          String(book.publishedYear ?? '') === filters.year ||
          String(book.publishingYear ?? '') === filters.year ||
          String(book.year ?? '') === filters.year
      );
    }

    if (filters.author?.trim()) {
      const raw = filters.author.trim();
      const q = raw.toLowerCase();
      const oid24 = /^[a-f0-9]{24}$/i.test(raw);
      if (oid24) {
        result = result.filter((book) => {
          const id =
            book.authorRef && typeof book.authorRef === 'object' && book.authorRef._id
              ? String(book.authorRef._id)
              : book.authorRef != null
                ? String(book.authorRef)
                : '';
          return id.toLowerCase() === q;
        });
      } else {
        result = result.filter((book) => {
          const legacy = (book.author || '').toLowerCase();
          const fromRef =
            book.authorRef && typeof book.authorRef === 'object' && book.authorRef.name
              ? String(book.authorRef.name).toLowerCase()
              : '';
          return legacy.includes(q) || fromRef.includes(q);
        });
      }
    }

    if (filters.categoryId) {
      const id = String(filters.categoryId);
      result = result.filter((book) => categoryIdStr(book.category) === id);
    }

    if (filters.minRating) {
      const min = Number(filters.minRating);
      result = result.filter((book) => Number(book.evaluate) >= min);
    }

    if (filters.onSaleOnly) {
      result = result.filter((book) => Number(book.discount) > 0);
    }

    if (filters.memberOnlyOnly) {
      result = result.filter((book) => !!book.isMemberOnly);
    }

    if (filters.priceTier) {
      result = result.filter((book) => {
        const p = bookPriceNum(book);
        if (p <= 0) return false;
        switch (filters.priceTier) {
          case 'lt150':
            return p < 150;
          case '150_300':
            return p >= 150 && p < 300;
          case 'gt300':
            return p >= 300;
          default:
            return true;
        }
      });
    }

    if (filters.publisher?.trim()) {
      const q = filters.publisher.trim().toLowerCase();
      result = result.filter((book) => (book.publisher || '').toLowerCase().includes(q));
    }

    if (filters.format) {
      result = result.filter((book) => String(book.format || '') === filters.format);
    }

    if (filters.productionYear) {
      result = result.filter((book) => String(book.productionYear ?? '') === filters.productionYear);
    }

    const pMin = filters.pagesMin === '' ? null : Number(filters.pagesMin);
    const pMax = filters.pagesMax === '' ? null : Number(filters.pagesMax);
    if (pMin != null && !Number.isNaN(pMin)) {
      result = result.filter((book) => typeof book.pages === 'number' && book.pages >= pMin);
    }
    if (pMax != null && !Number.isNaN(pMax)) {
      result = result.filter((book) => typeof book.pages === 'number' && book.pages <= pMax);
    }

    const wMin = filters.weightMin === '' ? null : Number(filters.weightMin);
    const wMax = filters.weightMax === '' ? null : Number(filters.weightMax);
    if (wMin != null && !Number.isNaN(wMin)) {
      result = result.filter((book) => typeof book.weight === 'number' && book.weight >= wMin);
    }
    if (wMax != null && !Number.isNaN(wMax)) {
      result = result.filter((book) => typeof book.weight === 'number' && book.weight <= wMax);
    }

    return result;
  }, [books, filters]);

  const availableYears = useMemo(() => {
    if (!books) return [];
    const years = new Set();
    books.forEach((book) => {
      if (book.publishedYear != null) years.add(Number(book.publishedYear));
      if (book.publishingYear) years.add(Number(book.publishingYear));
      if (book.year) years.add(Number(book.year));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [books]);

  const availableProductionYears = useMemo(() => {
    if (!books) return [];
    const years = new Set();
    books.forEach((book) => {
      if (book.productionYear != null && !Number.isNaN(Number(book.productionYear))) {
        years.add(Number(book.productionYear));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [books]);

  const booksByCat = useMemo(() => {
    if (!filteredBooks) return {};
    const map = {};
    categories.forEach((cat) => {
      map[cat.slug] = filteredBooks.filter((bk) => categoryIdStr(bk.category) === String(cat._id));
    });
    const catIds = new Set(categories.map((c) => String(c._id)));
    const others = filteredBooks.filter((bk) => {
      const id = categoryIdStr(bk.category);
      return id && !catIds.has(id);
    });
    if (others.length) map._other = others;
    return map;
  }, [filteredBooks, categories]);

  const booksBySales = useMemo(() => {
    if (!filteredBooks?.length) return [];
    return [...filteredBooks].sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0));
  }, [filteredBooks]);

  const booksByRating = useMemo(() => {
    if (!filteredBooks?.length) return [];
    return [...filteredBooks].sort((a, b) => (Number(b.evaluate) || 0) - (Number(a.evaluate) || 0));
  }, [filteredBooks]);

  if (!books) {
    return <div className={styles.loading}>Đang tải...</div>;
  }

  return (
    <div className={styles.homeWaka}>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div
          ref={filterRef}
          className={`${styles.filterDropdown} ${filterOpen ? styles.filterDropdownOpen : ''}`}
        >
          <button
            type="button"
            className={`${styles.filterBtn} ${hasActiveFilters ? styles.filterBtnActive : ''}`}
            onClick={toggleFilterPanel}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
          >
            <i className="fa-solid fa-book-bookmark" />
            Bộ lọc sách
            {hasActiveFilters && <span style={{ marginLeft: 4 }}>({activeCount})</span>}
          </button>

          <div className={styles.filterDropdownPanel} role="dialog" aria-label="Bộ lọc sách">
            <div className={styles.filterDropdownPanelInner}>
              <div className={styles.filterPanelHeader}>
                <div className={styles.filterPanelHeaderIcon}>
                  <i className="fa-solid fa-book-open" />
                </div>
                <div className={styles.filterPanelHeaderText}>
                  <p className={styles.filterPanelTitle}>Tìm đúng cuốn bạn cần</p>
                  <p className={styles.filterPanelSub}>
                    Chọn tiêu chí rồi nhấn «Áp dụng». Panel giữ mở khi bạn điền — đóng bằng nút, click ra ngoài hoặc phím Escape.
                  </p>
                </div>
              </div>

              <p className={styles.filterHint}>
                Gợi ý: có thể kết hợp thể loại + khoảng giá + điểm đánh giá để thu hẹp danh sách trên trang chủ.
              </p>

              <div className={styles.filterFieldsGrid}>
                <div className={`${styles.filterGroup} ${styles.filterSpan2}`}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-book">
                    <i className="fa-solid fa-book" /> Tên sách
                  </label>
                  <input
                    id="home-filter-book"
                    type="text"
                    className={styles.filterGroupInput}
                    placeholder="VD: Harry Potter, Sapiens…"
                    value={tempFilters.bookName}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, bookName: e.target.value }))}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-category">
                    <i className="fa-solid fa-layer-group" /> Thể loại
                  </label>
                  <select
                    id="home-filter-category"
                    className={styles.filterGroupSelect}
                    value={tempFilters.categoryId}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Tất cả thể loại</option>
                    {categories.map((c) => (
                      <option key={c._id} value={String(c._id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-year">
                    <i className="fa-solid fa-calendar" /> Năm xuất bản
                  </label>
                  <select
                    id="home-filter-year"
                    className={styles.filterGroupSelect}
                    value={tempFilters.year}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, year: e.target.value }))}
                  >
                    <option value="">Mọi năm</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`${styles.filterGroup} ${styles.filterSpan2}`}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-author">
                    <i className="fa-solid fa-pen-nib" /> Tác giả
                  </label>
                  <input
                    id="home-filter-author"
                    type="text"
                    className={styles.filterGroupInput}
                    placeholder="Tên tác giả…"
                    value={tempFilters.author}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, author: e.target.value }))}
                  />
                </div>

                <div className={`${styles.filterGroup} ${styles.filterSpan2}`}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-publisher">
                    <i className="fa-solid fa-building" /> Nhà xuất bản
                  </label>
                  <input
                    id="home-filter-publisher"
                    type="text"
                    className={styles.filterGroupInput}
                    placeholder="VD: Kim Đồng, NXB Trẻ…"
                    value={tempFilters.publisher}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, publisher: e.target.value }))}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-format">
                    <i className="fa-solid fa-book" /> Kiểu bìa
                  </label>
                  <select
                    id="home-filter-format"
                    className={styles.filterGroupSelect}
                    value={tempFilters.format}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, format: e.target.value }))}
                  >
                    {BOOK_FORMAT_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.value === '' ? 'Mọi kiểu bìa' : o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-prod-year">
                    <i className="fa-solid fa-industry" /> Năm sản xuất
                  </label>
                  <select
                    id="home-filter-prod-year"
                    className={styles.filterGroupSelect}
                    value={tempFilters.productionYear}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, productionYear: e.target.value }))}
                  >
                    <option value="">Mọi năm</option>
                    {availableProductionYears.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-pages-min">
                    <i className="fa-solid fa-file-lines" /> Số trang (từ — đến)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="home-filter-pages-min"
                      type="number"
                      min="0"
                      className={styles.filterGroupInput}
                      placeholder="Từ"
                      value={tempFilters.pagesMin}
                      onChange={(e) => setTempFilters((prev) => ({ ...prev, pagesMin: e.target.value }))}
                    />
                    <input
                      type="number"
                      min="0"
                      className={styles.filterGroupInput}
                      placeholder="Đến"
                      value={tempFilters.pagesMax}
                      onChange={(e) => setTempFilters((prev) => ({ ...prev, pagesMax: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-weight-min">
                    <i className="fa-solid fa-weight-hanging" /> Trọng lượng g (từ — đến)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="home-filter-weight-min"
                      type="number"
                      min="0"
                      className={styles.filterGroupInput}
                      placeholder="Từ"
                      value={tempFilters.weightMin}
                      onChange={(e) => setTempFilters((prev) => ({ ...prev, weightMin: e.target.value }))}
                    />
                    <input
                      type="number"
                      min="0"
                      className={styles.filterGroupInput}
                      placeholder="Đến"
                      value={tempFilters.weightMax}
                      onChange={(e) => setTempFilters((prev) => ({ ...prev, weightMax: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-price">
                    <i className="fa-solid fa-tag" /> Khoảng giá (niêm yết)
                  </label>
                  <select
                    id="home-filter-price"
                    className={styles.filterGroupSelect}
                    value={tempFilters.priceTier}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, priceTier: e.target.value }))}
                  >
                    <option value="">Mọi mức giá</option>
                    <option value="lt150">Dưới ~150k</option>
                    <option value="150_300">~150k – dưới ~300k</option>
                    <option value="gt300">Từ ~300k trở lên</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterGroupLabel} htmlFor="home-filter-rating">
                    <i className="fa-solid fa-star-half-stroke" /> Đánh giá tối thiểu
                  </label>
                  <select
                    id="home-filter-rating"
                    className={styles.filterGroupSelect}
                    value={tempFilters.minRating}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, minRating: e.target.value }))}
                  >
                    <option value="">Mọi mức điểm</option>
                    <option value="3">Từ 3 sao</option>
                    <option value="4">Từ 4 sao</option>
                    <option value="4.5">Từ 4,5 sao</option>
                  </select>
                </div>

                <label className={`${styles.filterCheckboxRow} ${styles.filterSpan2}`}>
                  <input
                    type="checkbox"
                    checked={tempFilters.onSaleOnly}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, onSaleOnly: e.target.checked }))}
                  />
                  <span>
                    <i className="fa-solid fa-percent" />
                    Chỉ hiện sách đang khuyến mãi (có % giảm)
                  </span>
                </label>
                <label className={`${styles.filterCheckboxRow} ${styles.filterSpan2}`}>
                  <input
                    type="checkbox"
                    checked={tempFilters.memberOnlyOnly}
                    onChange={(e) => setTempFilters((prev) => ({ ...prev, memberOnlyOnly: e.target.checked }))}
                  />
                  <span>
                    <i className="fa-solid fa-crown" />
                    Chỉ hiện sách hội viên
                  </span>
                </label>
              </div>

              <div className={styles.filterActions}>
                <button type="button" className={styles.filterResetBtn} onClick={handleClearFilters}>
                  <i className="fa-solid fa-xmark" /> Xóa tất cả
                </button>
                <button type="button" className={styles.filterApplyBtn} onClick={handleApplyFilters}>
                  <i className="fa-solid fa-check" /> Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className={styles.activeFilters}>
            {filters.bookName?.trim() && (
              <span className={styles.activeFilterTag}>Sách: {filters.bookName.trim()}</span>
            )}
            {filters.categoryId && (
              <span className={styles.activeFilterTag}>
                Thể loại: {categories.find((c) => String(c._id) === filters.categoryId)?.name || '—'}
              </span>
            )}
            {filters.year && <span className={styles.activeFilterTag}>Năm XB: {filters.year}</span>}
            {filters.author?.trim() && (
              <span className={styles.activeFilterTag}>Tác giả: {filters.author.trim()}</span>
            )}
            {filters.publisher?.trim() && (
              <span className={styles.activeFilterTag}>NXB: {filters.publisher.trim()}</span>
            )}
            {filters.format && (
              <span className={styles.activeFilterTag}>
                Bìa: {BOOK_FORMAT_OPTIONS.find((o) => o.value === filters.format)?.label || filters.format}
              </span>
            )}
            {filters.productionYear && (
              <span className={styles.activeFilterTag}>Năm SX: {filters.productionYear}</span>
            )}
            {(filters.pagesMin || filters.pagesMax) && (
              <span className={styles.activeFilterTag}>
                Trang: {filters.pagesMin || '…'} — {filters.pagesMax || '…'}
              </span>
            )}
            {(filters.weightMin || filters.weightMax) && (
              <span className={styles.activeFilterTag}>
                Gram: {filters.weightMin || '…'} — {filters.weightMax || '…'}
              </span>
            )}
            {filters.priceTier === 'lt150' && (
              <span className={styles.activeFilterTag}>Giá: dưới ~150k</span>
            )}
            {filters.priceTier === '150_300' && (
              <span className={styles.activeFilterTag}>Giá: ~150k – dưới ~300k</span>
            )}
            {filters.priceTier === 'gt300' && (
              <span className={styles.activeFilterTag}>Giá: từ ~300k</span>
            )}
            {filters.minRating && (
              <span className={styles.activeFilterTag}>Đánh giá: từ {filters.minRating}★</span>
            )}
            {filters.onSaleOnly && <span className={styles.activeFilterTag}>Đang khuyến mãi</span>}
            {filters.memberOnlyOnly && <span className={styles.activeFilterTag}>Sách hội viên</span>}
          </div>
        )}
      </div>

      <FlashSaleSection />

      {/* Các section sách */}
      {filteredBooks?.length === 0 ? (
        <div className={styles.emptyHint}>Không tìm thấy sách nào phù hợp với bộ lọc</div>
      ) : (
        <>
          {booksBySales.length > 0 && (
            <section id="section-sales" className={styles.catSection}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Bán chạy theo doanh số</h2>
                  <p className={styles.sectionSub}>Sắp xếp theo số lượng đã bán</p>
                </div>
                <a className={styles.sectionMore} href="/search">
                  Xem thêm →
                </a>
              </div>
              <CategoryBookRow books={booksBySales} meta="sold" />
            </section>
          )}

          {booksByRating.length > 0 && (
            <section id="section-rating" className={styles.catSection}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Đánh giá cao nhất</h2>
                  <p className={styles.sectionSub}>Sắp xếp theo điểm đánh giá</p>
                </div>
                <a className={styles.sectionMore} href="/search">
                  Xem thêm →
                </a>
              </div>
              <CategoryBookRow books={booksByRating} meta="rating" />
            </section>
          )}

          {categories.map((cat) => {
            const list = booksByCat[cat.slug];
            if (!list || list.length === 0) return null;
            return (
              <section key={cat._id} id={`section-${cat.slug}`} className={styles.catSection}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>{cat.name}</h2>
                  <a className={styles.sectionMore} href={`/search?category=${encodeURIComponent(cat.slug)}`}>
                    Xem thêm →
                  </a>
                </div>
                <CategoryBookRow books={list} />
              </section>
            );
          })}

          {booksByCat._other?.length > 0 && (
            <section id="section-other" className={styles.catSection}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Sách khác</h2>
              </div>
              <CategoryBookRow books={booksByCat._other} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Home;