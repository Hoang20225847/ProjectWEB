import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './SearchSidebar.module.scss';
import { RATING_FILTER_OPTIONS } from './searchFilterConstants.js';

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

function YearInputBlock({ searchParams, setSearchParams }) {
  const urlYear = searchParams.get('year') || searchParams.get('years')?.split(',')[0]?.trim() || '';
  const [draft, setDraft] = useState(urlYear);

  useEffect(() => {
    setDraft(urlYear);
  }, [urlYear]);

  const commitYear = useCallback(
    (raw) => {
      const trimmed = String(raw ?? '').trim();
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('years');
          if (/^\d{4}$/.test(trimmed)) {
            n.set('year', trimmed);
          } else {
            n.delete('year');
          }
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return (
    <section className={styles.section}>
      <h3 className={styles.blockTitle}>Năm xuất bản</h3>
      <input
        type="number"
        className={styles.yearInput}
        inputMode="numeric"
        min={1900}
        max={2100}
        step={1}
        placeholder="VD: 2024"
        value={draft}
        aria-label="Năm xuất bản"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commitYear(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitYear(draft);
          }
        }}
      />
    </section>
  );
}

function RatingBlock({ searchParams, setSearchParams }) {
  const current = searchParams.get('minRating') || '';
  return (
    <section className={styles.section}>
      <h3 className={styles.blockTitle}>Đánh giá</h3>
      {RATING_FILTER_OPTIONS.map((opt) => (
        <label key={opt.value} className={styles.checkRow}>
          <input
            type="checkbox"
            checked={current === opt.value}
            onChange={(e) =>
              setSearchParams(
                (prev) => {
                  const n = new URLSearchParams(prev);
                  if (e.target.checked) n.set('minRating', opt.value);
                  else if (current === opt.value) n.delete('minRating');
                  return n;
                },
                { replace: true }
              )
            }
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </section>
  );
}

function ToggleRow({ title, label, paramKey, searchParams, setSearchParams }) {
  const checked = searchParams.get(paramKey) === 'true';
  return (
    <section className={styles.section}>
      <h3 className={styles.blockTitle}>{title}</h3>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            setSearchParams(
              (prev) => {
                const n = new URLSearchParams(prev);
                if (e.target.checked) n.set(paramKey, 'true');
                else n.delete(paramKey);
                return n;
              },
              { replace: true }
            )
          }
        />
        <span>{label}</span>
      </label>
    </section>
  );
}

const FILTER_BLOCKS = [
  { key: 'priceBands', title: 'Giá', paramKey: 'priceBands' },
  { key: 'genres', title: 'Thể loại nội dung', paramKey: 'genres' },
  { key: 'brands', title: 'Thương hiệu', paramKey: 'brands' },
  { key: 'suppliers', title: 'Nhà cung cấp / NXB', paramKey: 'suppliers' },
  { key: 'manufacturingOrigins', title: 'Nơi gia công & sản xuất', paramKey: 'manufacturingOrigins' },
  { key: 'brandOrigins', title: 'Xuất xứ thương hiệu', paramKey: 'brandOrigins' },
  { key: 'ageRanges', title: 'Độ tuổi', paramKey: 'ageRanges' },
  { key: 'coverColors', title: 'Màu sắc', paramKey: 'coverColors' },
  { key: 'languages', title: 'Ngôn ngữ', paramKey: 'languages' },
  { key: 'formats', title: 'Hình thức', paramKey: 'formats' },
];

export default function SearchSidebar({ searchParams, setSearchParams, categories, filterFacets }) {
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

  const visibleBlocks = useMemo(
    () =>
      FILTER_BLOCKS.map((block) => ({
        ...block,
        options: Array.isArray(filterFacets?.[block.key]) ? filterFacets[block.key] : [],
      })).filter((block) => block.options.length > 0),
    [filterFacets]
  );

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

        {filterFacets == null && (
          <p className={styles.panelHeaderSub} style={{ padding: '0 0.5rem' }}>
            Đang tải bộ lọc…
          </p>
        )}

        {filterFacets != null && <div className={styles.divider} />}

        <YearInputBlock searchParams={searchParams} setSearchParams={setSearchParams} />

        <RatingBlock searchParams={searchParams} setSearchParams={setSearchParams} />

        {filterFacets?.hasPromotionalBooks && (
          <ToggleRow
            title="Khuyến mãi"
            label="Chỉ hiện sách đang khuyến mãi"
            paramKey="onSaleOnly"
            searchParams={searchParams}
            setSearchParams={setSearchParams}
          />
        )}

        {visibleBlocks.map((block) => (
          <CheckboxBlock
            key={block.paramKey}
            title={block.title}
            options={block.options}
            paramKey={block.paramKey}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
          />
        ))}

        {filterFacets?.hasMemberOnlyBooks && (
          <ToggleRow
            title="Sách hội viên"
            label="Chỉ hiện sách hội viên"
            paramKey="memberOnly"
            searchParams={searchParams}
            setSearchParams={setSearchParams}
          />
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnClear} onClick={clearAll}>
          Xóa toàn bộ bộ lọc
        </button>
      </div>
    </aside>
  );
}
