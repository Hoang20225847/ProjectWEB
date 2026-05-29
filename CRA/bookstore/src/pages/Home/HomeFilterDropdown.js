import styles from './Home.module.scss';

export default function HomeFilterDropdown({ categories, onApply }) {
  const years = [];
  const y = new Date().getFullYear();
  for (let i = y + 1; i >= 1990; i -= 1) years.push(i);

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const categoryId = fd.get('categoryId') || '';
    const year = fd.get('year') || '';
    const author = (fd.get('author') || '').trim();
    onApply({ categoryId, year, author });
  };

  const handleReset = (e) => {
    e.preventDefault();
    document.getElementById('home-filter-form')?.reset();
    onApply({ categoryId: '', year: '', author: '' });
  };

  return (
    <div className={styles.filterWrap}>
      <button type="button" className={styles.filterTrigger} aria-haspopup="true">
        <i className="fa-solid fa-sliders" />
        Bộ lọc
      </button>
      <div className={styles.filterPanel} role="menu">
        <form id="home-filter-form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <div className={styles.filterRow}>
            <label htmlFor="filter-category">Thể loại</label>
            <select id="filter-category" name="categoryId" className={styles.filterSelect} defaultValue="">
              <option value="">Tất cả</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterRow}>
            <label htmlFor="filter-year">Năm xuất bản</label>
            <select id="filter-year" name="year" className={styles.filterSelect} defaultValue="">
              <option value="">Tất cả</option>
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterRow}>
            <label htmlFor="filter-author">Tác giả / từ khóa</label>
            <input
              id="filter-author"
              name="author"
              type="text"
              className={styles.filterInput}
              placeholder="Tìm trong tên tác giả, tên sách, mô tả…"
              autoComplete="off"
            />
          </div>
          <div className={styles.filterActions}>
            <button type="button" className={styles.filterBtnSecondary} onClick={handleReset}>
              Đặt lại
            </button>
            <button type="submit" className={styles.filterBtnPrimary}>
              Áp dụng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
