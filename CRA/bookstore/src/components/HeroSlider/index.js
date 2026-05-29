import { useEffect, useState, useRef } from 'react';
import { getHeroImages } from '../../app/api/HeroImageApi.js';
import styles from './HeroSlider.module.scss';

import { resolveMediaUrl } from '../../config/api';

function HeroSlider() {
  const [slides, setSlides] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (currentIdx >= slides.length && slides.length > 0) {
      setCurrentIdx(0);
    }
  }, [slides.length, currentIdx]);

  const getImageSrc = (imageUrl) => resolveMediaUrl(imageUrl);

  useEffect(() => {
    async function fetchHeroImages() {
      setIsLoading(true);
      try {
        const images = await getHeroImages();
        setSlides(Array.isArray(images) ? images : []);
      } catch (error) {
        console.error('Lỗi khi tải hero images:', error);
        setSlides([]);
      }
      setIsLoading(false);
    }
    fetchHeroImages();
  }, []);

  // Auto-slide
  useEffect(() => {
    if (slides.length <= 1 || isHovering) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [slides.length, isHovering]);

  const goToSlide = (idx) => {
    setCurrentIdx(idx);
  };

  const goToPrev = () => {
    setCurrentIdx((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentIdx((prev) => (prev + 1) % slides.length);
  };

  if (isLoading) {
    return (
      <div className={styles.heroSliderLoading}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  if (slides.length === 0) {
    return null; // Không hiển thị gì nếu không có hero images
  }

  const currentSlide = slides[currentIdx];

  return (
    <div
      className={styles.heroSlider}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={styles.slideContainer}>
        {currentSlide.link ? (
          <a href={currentSlide.link} className={styles.slideLink}>
            <img
              src={getImageSrc(currentSlide.imageUrl)}
              alt={currentSlide.altText || 'Hero Image'}
              className={styles.slideImage}
            />
          </a>
        ) : (
          <div className={styles.slideLink}>
            <img
              src={getImageSrc(currentSlide.imageUrl)}
              alt={currentSlide.altText || 'Hero Image'}
              className={styles.slideImage}
            />
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={goToPrev}
            aria-label="Slide trước"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={goToNext}
            aria-label="Slide tiếp theo"
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {slides.length > 1 && (
        <div className={styles.dots}>
          {slides.map((slide, idx) => (
            <button
              key={slide._id || idx}
              type="button"
              className={`${styles.dot} ${idx === currentIdx ? styles.dotActive : ''}`}
              onClick={() => goToSlide(idx)}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slide counter */}
      {slides.length > 1 && (
        <div className={styles.counter}>
          {currentIdx + 1} / {slides.length}
        </div>
      )}
    </div>
  );
}

export default HeroSlider;