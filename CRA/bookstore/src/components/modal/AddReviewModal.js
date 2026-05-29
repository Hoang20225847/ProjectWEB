import { useState } from 'react';
import classNames from 'classnames/bind';
import '@fortawesome/fontawesome-free/css/all.min.css';
import axios from '../axios/axios.customize';
import { toast } from 'react-toastify';
import styles from './AddReviewModal.module.scss';

const cx = classNames.bind(styles);

const RATING_LABELS = {
  1: 'Rất không hài lòng',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

function AddReviewModal({ onClose, onNext, product, userId }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const displayStars = hoverRating || rating;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || rating < 1) {
      toast.warning('Vui lòng chọn từ 1 đến 5 sao');
      return;
    }
    const formData = {
      userId,
      evaluate: String(rating),
      comment: comment.trim(),
      bookId: product.bookId._id,
    };
    try {
      await axios.post('/api/review', formData);
      toast.success('Đánh giá thành công');
      setRating(0);
      setHoverRating(0);
      setComment('');
      onNext();
    } catch {
      toast.error('Đánh giá không thành công');
    }
  };

  if (!product?.bookId) return null;

  return (
    <div className={cx('overlay')} onClick={onClose} role="presentation">
      <div
        className={cx('panel')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        <button type="button" className={cx('closeBtn')} onClick={onClose} aria-label="Đóng">
          <i className="fa-solid fa-xmark" aria-hidden />
        </button>

        <form className={cx('form')} onSubmit={handleSubmit} noValidate>
          <header className={cx('head')}>
            <h2 id="review-modal-title" className={cx('title')}>
              Đánh giá sách
            </h2>
            <p className={cx('subtitle')}>Chia sẻ trải nghiệm để giúp người khác chọn sách phù hợp hơn.</p>
          </header>

          <div className={cx('bookCard')}>
            <img
              className={cx('bookThumb')}
              src={product.bookId.img}
              alt=""
              loading="lazy"
            />
            <p className={cx('bookName')}>{product.bookId.name}</p>
          </div>

          <label className={cx('fieldLabel')} htmlFor="review-stars-group">
            Số sao
          </label>
          <div
            id="review-stars-group"
            className={cx('starRow')}
            role="group"
            aria-label="Chọn từ 1 đến 5 sao"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={cx('starBtn', { active: displayStars >= n })}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                aria-label={`${n} sao`}
              >
                <i className={displayStars >= n ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden />
              </button>
            ))}
          </div>
          <p className={cx('ratingHint')} aria-live="polite">
            {rating > 0 ? (
              <>
                Đã chọn: <strong>{rating}</strong> / 5 — {RATING_LABELS[rating]}
              </>
            ) : (
              'Chạm vào ngôi sao để chọn điểm.'
            )}
          </p>

          <label className={cx('fieldLabel')} htmlFor="review-comment">
            Bình luận <span className={cx('optionalHint')}>(tùy chọn)</span>
          </label>
          <textarea
            id="review-comment"
            name="comment"
            className={cx('textarea')}
            rows={5}
            placeholder="Viết vài dòng về chất lượng sách, đóng gói hoặc trải nghiệm đọc…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <footer className={cx('footer')}>
            <button type="button" className={cx('btnSecondary')} onClick={onClose}>
              Trở lại
            </button>
            <button type="submit" className={cx('btnPrimary')}>
              Gửi đánh giá
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default AddReviewModal;
