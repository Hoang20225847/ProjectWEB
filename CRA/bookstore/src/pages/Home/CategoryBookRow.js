import { useRef, useState, useCallback, useEffect } from 'react';
import BookCard from '../../components/BookCard/BookCard.js';
import styles from './Home.module.scss';

/** meta: 'sold' — hiện đã bán; 'rating' — hiện điểm đánh giá */
function CategoryBookRow({ books, meta }) {
  const scrollRef = useRef(null);
  const [thumb, setThumb] = useState({ w: 100, left: 0 });

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const w = maxScroll <= 0 ? 100 : (clientWidth / scrollWidth) * 100;
    const left = maxScroll <= 0 ? 0 : (scrollLeft / maxScroll) * (100 - w);
    setThumb({ w, left });
  }, []);

  useEffect(() => {
    updateThumb();
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => updateThumb());
    ro.observe(el);
    return () => ro.disconnect();
  }, [books, updateThumb]);

  if (!books || books.length === 0) {
    return <p className={styles.emptyHint}>Chưa có sách để hiển thị.</p>;
  }

  return (
    <>
      <div ref={scrollRef} className={styles.bookScroll} onScroll={updateThumb}>
        {books.map((item) => (
          <BookCard key={item._id} book={item} meta={meta} layout="scroll" />
        ))}
      </div>
      <div className={styles.pagingTrack} aria-hidden>
        <div
          className={styles.pagingThumb}
          style={{ width: `${thumb.w}%`, left: `${thumb.left}%` }}
        />
      </div>
    </>
  );
}

export default CategoryBookRow;
