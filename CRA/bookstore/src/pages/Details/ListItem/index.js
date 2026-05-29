import { useEffect, useState } from 'react';
import { getBookList } from '../../../app/api/siteApi';
import { sameCategory } from '../../../utils/categoryUtils';
import CategoryBookRow from '../../Home/CategoryBookRow';
import classNames from 'classnames/bind';
import styles from '../Details.module.scss';

const cx = classNames.bind(styles);

/**
 * @param {object} category — dùng khi không có prefetchedBooks (lọc từ toàn bộ sách)
 * @param {string} id — id sách hiện tại (loại khỏi danh sách)
 * @param {object[]|undefined} prefetchedBooks — từ API chi tiết (sameCategoryBooks), bỏ qua fetch
 */
function ListItem({ category, id, prefetchedBooks }) {
  const [data, setData] = useState(
    Array.isArray(prefetchedBooks) ? prefetchedBooks : null
  );

  useEffect(() => {
    let cancelled = false;
    if (Array.isArray(prefetchedBooks)) {
      setData(prefetchedBooks);
      return undefined;
    }
    (async () => {
      const json = await getBookList();
      if (!cancelled) setData(Array.isArray(json) ? json : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [prefetchedBooks]);

  if (data === null) {
    return <div className={cx('relatedLoading')}>Đang tải sách…</div>;
  }

  const related = Array.isArray(prefetchedBooks)
    ? data.filter((item) => String(item._id) !== String(id))
    : data.filter(
        (item) => sameCategory(item.category, category) && String(item._id) !== String(id)
      );

  return <CategoryBookRow books={related} meta="sold" />;
}

export default ListItem;
