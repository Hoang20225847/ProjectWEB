import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import styles from './SearchSidebar.module.scss';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import {
  PRICE_BAND_OPTIONS,
  GENRE_FILTER_OPTIONS,
  LANGUAGE_FILTER_OPTIONS,
  SUPPLIER_FILTER_OPTIONS,
  BRAND_FILTER_OPTIONS,
  AGE_RANGE_OPTIONS,
  MANUFACTURING_ORIGIN_OPTIONS,
  BRAND_ORIGIN_OPTIONS,
  COVER_COLOR_OPTIONS,
} from './searchFilterConstants.js';

function getCsvSet(searchParams, key) {
  return new Set((searchParams.get(key) || '').split(',').map((s) => s.trim()).filter(Boolean));
}

function toggleCsvParam(setSearchParams, key, value, checked) {
  setSearchParams(
    (prev) => {
      const n = new URLSearchParams(prev);
      const cur = new Set((n.get(key) || '').split(',').map((s) => s.trim()).filter(Boolean));
      if (checked) cur.add(value);
      else cur.delete(value);
      if (cur.size) n.set(key, [...cur].join(','));
      else n.delete(key);
      return n;
    },
    { replace: true }
  );
}

function CheckboxBlock({ title, options, paramKey, searchParams, setSearchParams, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const selected = useMemo(() => getCsvSet(searchParams, paramKey), [searchParams, paramKey]);
  const onToggle = useCallback(
    (value, checked) => {
      toggleCsvParam(setSearchParams, paramKey, value, checked);
    },
    [setSearchParams, paramKey]
  );
  const shown = open ? options : options.slice(0, 5);
  return (
    <section className={styles.section}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {shown.map((opt) => (
        <label key={opt.value} className={styles.checkRow}>
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={(e) => onToggle(opt.value, e.target.checked)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
      {options.length > 5 && (
        <button type="button" className={styles.seeMore} onClick={() => setOpen((o) => !o)}>
          {open ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}

export default function SearchSidebar({ searchParams, setSearchParams, categories }) {
  const activeSlug =
    searchParams.get('categorySlug') || searchParams.get('category') || '';

  const setCategorySlug = (slug) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (slug) {
          n.set('categorySlug', slug);
          n.delete('categoryId');
          n.delete('category');
        } else {
          n.delete('categorySlug');
          n.delete('category');
        }
        return n;
      },
      { replace: true }
    );
  };

  const clearAll = () => {
    setSearchParams({}, { replace: true });
  };
  const memberOnly = searchParams.get('memberOnly') === 'true';

  const formatOpts = BOOK_FORMAT_OPTIONS.filter((o) => o.value);

  return (
    <aside className={styles.searchSidebar} aria-label="Danh mục và bộ lọc">
      <div className={styles.searchSidebarScroll}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderIcon} aria-hidden>
            <i className="fa-solid fa-layer-group" />
          </div>
          <div>
            <p className={styles.panelHeaderText}>Danh mục &amp; bộ lọc</p>
            <p className={styles.panelHeaderSub}>Chọn thể loại và tinh chỉnh kết quả tìm kiếm</p>
          </div>
        </div>

        <section className={styles.section}>
          <h3 className={styles.blockTitle}>Danh mục sách</h3>
          <ul className={styles.catList}>
            <li>
              <Link to="/search" className={`${styles.catBtn} ${activeSlug === '' ? styles.catBtnActive : ''}`}>
                Tất cả
              </Link>
            </li>
            {(categories || []).map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  className={`${styles.catBtn} ${activeSlug === c.slug ? styles.catBtnActive : ''}`}
                  onClick={() => setCategorySlug(c.slug)}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.divider} />

      <CheckboxBlock
        title="Giá"
        options={PRICE_BAND_OPTIONS}
        paramKey="priceBands"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Thể loại nội dung"
        options={GENRE_FILTER_OPTIONS}
        paramKey="genres"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Thương hiệu"
        options={BRAND_FILTER_OPTIONS}
        paramKey="brands"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Nhà cung cấp / NXB"
        options={SUPPLIER_FILTER_OPTIONS}
        paramKey="suppliers"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Nơi gia công & sản xuất"
        options={MANUFACTURING_ORIGIN_OPTIONS}
        paramKey="manufacturingOrigins"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Xuất xứ thương hiệu"
        options={BRAND_ORIGIN_OPTIONS}
        paramKey="brandOrigins"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Độ tuổi"
        options={AGE_RANGE_OPTIONS}
        paramKey="ageRanges"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Màu sắc"
        options={COVER_COLOR_OPTIONS}
        paramKey="coverColors"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Ngôn ngữ"
        options={LANGUAGE_FILTER_OPTIONS}
        paramKey="languages"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      <CheckboxBlock
        title="Hình thức"
        options={formatOpts.map((o) => ({ value: o.value, label: o.label }))}
        paramKey="formats"
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />
      <section className={styles.section}>
        <h3 className={styles.blockTitle}>Sách hội viên</h3>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={memberOnly}
            onChange={(e) =>
              setSearchParams(
                (prev) => {
                  const n = new URLSearchParams(prev);
                  if (e.target.checked) n.set('memberOnly', 'true');
                  else n.delete('memberOnly');
                  return n;
                },
                { replace: true }
              )
            }
          />
          <span>Chỉ hiện sách hội viên</span>
        </label>
      </section>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnClear} onClick={clearAll}>
          Xóa toàn bộ bộ lọc
        </button>
      </div>
    </aside>
  );
}
