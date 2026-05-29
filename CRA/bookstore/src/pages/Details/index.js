import { useContext, useEffect, useState, useMemo } from 'react';
import classNames from 'classnames/bind';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './Details.module.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';
import ListItem from './ListItem';
import CategoryBookRow from '../Home/CategoryBookRow';
import { getBookDetail } from '../../app/api/DetailApi';
import { getReviewBook } from '../../app/api/ReviewApi.js';
import DiscountPrice, { formatVndDisplay, listPriceVnd, salePriceDisplayVnd } from '../../components/function/function.js';
import { AuthContext } from '../../components/context/auth.context.js';
import axios from '../../components/axios/axios.customize.js';
import { toast } from 'react-toastify';
import Review from './Review/index.js';
import { bookFormatLabel } from '../../utils/bookFormat.js';
import FlashSaleBadge from '../../components/FlashSaleBadge/FlashSaleBadge.js';

const cx = classNames.bind(styles);

function Details() {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);
  const { slug } = useParams();
  const location = useLocation();
  const [item, setItem] = useState(undefined);
  const [authorPage, setAuthorPage] = useState(1);
  const [countreview, setCountReview] = useState(0);
  const [count, setcount] = useState(1);
  const [formatBook, setFormatBook] = useState('paper');
  const [contentMode, setContentMode] = useState('full');
  const [descExpanded, setDescExpanded] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    setAuthorPage(1);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setItem(undefined);
    (async () => {
      const json = await getBookDetail(slug, { authorPage });
      if (cancelled) return;
      setItem(json || null);
      setCurrentImage(json?.img || null);
      setcount(1);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, authorPage]);

  useEffect(() => {
    if (item && typeof item === 'object') {
      setCurrentImage(item.img || null);
    }
  }, [item]);

  useEffect(() => {
    if (!item || location.hash !== '#book-reviews') return;
    const t = window.setTimeout(() => {
      document.getElementById('book-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(t);
  }, [item, location.hash]);

  const allImages = useMemo(() => {
    if (!item) return [];
    const imgs = [item.img, item.img1, item.img2, item.img3, item.img4].filter(Boolean);
    return imgs;
  }, [item]);

  const handleImageClick = (src, index) => {
    setCurrentImage(src);
    setLightboxIndex(index);
  };

  const handleOpenLightbox = () => {
    const idx = allImages.indexOf(currentImage);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setShowLightbox(true);
  };

  const handlePrevImage = () => {
    const newIndex = lightboxIndex === 0 ? allImages.length - 1 : lightboxIndex - 1;
    setLightboxIndex(newIndex);
    setCurrentImage(allImages[newIndex]);
  };

  const handleNextImage = () => {
    const newIndex = lightboxIndex === allImages.length - 1 ? 0 : lightboxIndex + 1;
    setLightboxIndex(newIndex);
    setCurrentImage(allImages[newIndex]);
  };

  const handleCloseLightbox = () => setShowLightbox(false);

  useEffect(() => {
    async function fetchReviews() {
      if (item) {
        const reviews = await getReviewBook(item._id);
        if (Array.isArray(reviews)) setCountReview(reviews.length);
      }
    }
    fetchReviews();
  }, [item]);

  const categoryLabel = useMemo(() => {
    if (!item?.category) return '—';
    if (typeof item.category === 'object' && item.category.name) return item.category.name;
    return '—';
  }, [item]);

  const authorLabel =
    (item?.authorRef && typeof item.authorRef === 'object' && item.authorRef.name
      ? item.authorRef.name
      : '') ||
    item?.author?.trim() ||
    'Đang cập nhật';
  const yearLabel = item?.publishedYear != null ? String(item.publishedYear) : '—';
  const publisherLabel = item?.publisher?.trim() || '—';
  const productionYearLabel = item?.productionYear != null ? String(item.productionYear) : '—';
  const pagesLabel = item?.pages != null && !Number.isNaN(Number(item.pages)) ? String(item.pages) : '—';
  const weightLabel =
    item?.weight != null && !Number.isNaN(Number(item.weight)) ? `${item.weight} g` : '—';
  const formatLabel = bookFormatLabel(item?.format);

  const descPlain = (item?.description || '').trim();
  const descPreviewLen = 320;
  const showDescToggle = descPlain.length > descPreviewLen;

  const roundedStars = Math.min(5, Math.max(0, Math.round(Number(item?.evaluate) || 0)));

  const handleCart = async (event) => {
    event.preventDefault();
    const stockTierNow = item?.stockTier || 'unmanaged';
    if (stockTierNow === 'outOfStock') {
      toast.warning('Sách đã hết hàng, không thể thêm vào giỏ hàng.');
      return;
    }
    if (!auth?.isAuthenticated) {
      navigate('/login');
      return;
    }
    const email = auth.user.email;
    const bookId = item._id;
    const quantity = count;
    const isMemberOnlyBook = !!item?.isMemberOnly;
    const isMember = !!auth?.user?.isMember;
    const effectiveDiscount = isMemberOnlyBook && !isMember ? 0 : Number(item?.discount) || 0;
    const price = DiscountPrice(item.price, effectiveDiscount);
    const totalPrice = price * quantity;
    const formData = {
      email,
      items: { bookId, quantity, price, totalPrice },
    };
    try {
      const data = await axios.post('/api/cart', formData);
      toast.success(data.message);
      
      // Dispatch event để Header cập nhật notifications ngay lập tức
      window.dispatchEvent(new CustomEvent('cart-added'));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Thêm thất bại';
      toast.error(msg);
    }
  };

  const handleCheckout = () => {
    const stockTierNow = item?.stockTier || 'unmanaged';
    if (stockTierNow === 'outOfStock') {
      toast.warning('Sách đã hết hàng, không thể mua.');
      return;
    }
    navigate('/checkout', {
      state: {
        from: 'details',
        items: [
          {
            bookId: item,
            quantity: count,
            price: DiscountPrice(item.price, effectiveDiscount),
            totalPrice: DiscountPrice(item.price, effectiveDiscount) * count,
          },
        ],
      },
    });
  };

  const handleBecomeMember = async () => {
    if (!auth?.isAuthenticated) {
      toast.info('Vui lòng đăng nhập để đăng ký hội viên');
      navigate('/login');
      return;
    }
    try {
      const response = await axios.put('/api/account/membership', {
        email: auth.user.email,
        register: true,
      });
      setAuth((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          isMember: true,
          membershipTierSlug: response.membershipTierSlug || prev.user.membershipTierSlug || '',
          membershipTierName: response.membershipTierName || prev.user.membershipTierName || '',
          loyaltyPoints: response.loyaltyPoints ?? prev.user.loyaltyPoints ?? 0,
          totalSpentDong: response.totalSpentDong ?? prev.user.totalSpentDong ?? 0,
          memberSince: response.memberSince ?? prev.user.memberSince ?? null,
        },
      }));
      toast.success(response?.message || 'Đăng ký hội viên thành công');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể đăng ký hội viên');
    }
  };

  if (item === undefined) {
    return (
      <div className={cx('detailLoading')}>
        <span className={cx('detailLoadingSpinner')} />
        Đang tải sách…
      </div>
    );
  }

  if (item === null) {
    return (
      <div className={cx('container')}>
        <div className={cx('detailLoading')} style={{ flexDirection: 'column', gap: 16, padding: '48px 24px' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#64748b' }}>Không tìm thấy sách</p>
          <p style={{ color: '#94a3b8' }}>
            Cuốn sách chưa được công bố, đã gỡ, hoặc không tồn tại.
          </p>
          <Link to="/" className={cx('breadcrumbLink')} style={{ fontWeight: 600 }}>
            ← Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const listVnd = listPriceVnd(item.price);
  const isMemberOnlyBook = !!item?.isMemberOnly;
  const isMember = !!auth?.user?.isMember;
  const effectiveDiscount = isMemberOnlyBook && !isMember ? 0 : Number(item?.discount) || 0;
  const saleDisplayVnd = salePriceDisplayVnd(item.price, effectiveDiscount);
  const hasDiscount = effectiveDiscount > 0;
  const stockTier = item.stockTier || 'unmanaged';
  const blockPurchase = stockTier === 'outOfStock';
  const maxBuy =
    stockTier === 'unmanaged' || item.stock == null
      ? 999
      : blockPurchase
        ? 0
        : Math.max(1, Math.min(999, Number(item.stock) || 0));

  return (
    <div className={cx('container')}>
      <div className="grid">
        <nav className={cx('breadcrumb')} aria-label="Breadcrumb">
          <Link to="/" className={cx('breadcrumbLink')}>
            Trang chủ
          </Link>
          <span className={cx('breadcrumbSep')}>/</span>
          <span className={cx('breadcrumbCurrent')}>{item.name}</span>
        </nav>

        <div className={cx('detailHero')}>
          <div className={cx('coverCol')}>
            <div className={cx('coverFrame')} onClick={handleOpenLightbox}>
              {hasDiscount ? (
                <span className={cx('coverBadge')}>Giảm {effectiveDiscount}%</span>
              ) : null}

              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className={cx('coverNav', 'coverNavPrev')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    aria-label="Ảnh trước"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    className={cx('coverNav', 'coverNavNext')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    aria-label="Ảnh tiếp theo"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </>
              )}

              <img src={currentImage} alt={item.name} className={cx('coverImg')} />
            </div>
            {(allImages.length > 1) && (
              <ul className={cx('thumbRow')}>
                {allImages.map((src, idx) => (
                  <li key={idx} className={cx('thumbItem', idx === lightboxIndex && 'thumbActive')}>
                    <img
                      src={src}
                      alt=""
                      className={cx('thumbImg')}
                      onClick={() => handleImageClick(src, idx)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cx('metaCol')}>
            <h1 className={cx('bookTitle')}>{item.name}</h1>

            {item?.flashSale ? (
              <div style={{ marginBottom: 8 }}>
                <FlashSaleBadge
                  status={item.flashSale.status}
                  startsAt={item.flashSale.startsAt}
                  endsAt={item.flashSale.endsAt}
                  discountPercent={item.flashSale.discountPercent}
                  variant="inline"
                />
              </div>
            ) : null}

            <div className={cx('rateRow')}>
              <div className={cx('stars')} aria-label={`${item.evaluate} trên 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <i
                    key={i}
                    className={i <= roundedStars ? 'fa-solid fa-star' : 'fa-regular fa-star'}
                  />
                ))}
              </div>
              <span className={cx('rateNum')}>{Number(item.evaluate).toFixed(1)}</span>
              <span className={cx('rateDot')}>·</span>
              <span className={cx('rateReviews')}>
                {countreview} đánh giá
              </span>
            </div>

            {Number(item.sold) > 0 ? (
              <div className={cx('trendPill')}>
                <i className="fa-solid fa-fire-flame-curved" />
                Bán chạy · {item.sold} lượt mua
              </div>
            ) : (
              <div className={cx('trendPill', 'trendPillMuted')}>Sách mới trên kệ</div>
            )}

            <dl className={cx('metaGrid')}>
              <div className={cx('metaRow')}>
                <dt>Tác giả</dt>
                <dd>{authorLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Thể loại</dt>
                <dd>
                  <span className={cx('metaCategory')}>{categoryLabel}</span>
                  <i className={`fa-solid fa-chevron-down ${cx('metaChevron')}`} aria-hidden />
                </dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Năm xuất bản</dt>
                <dd>{yearLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Nhà xuất bản</dt>
                <dd>{publisherLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Năm sản xuất</dt>
                <dd>{productionYearLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Số trang</dt>
                <dd>{pagesLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Trọng lượng</dt>
                <dd>{weightLabel}</dd>
              </div>
              <div className={cx('metaRow')}>
                <dt>Kiểu bìa</dt>
                <dd>{formatLabel}</dd>
              </div>
              {typeof item.stock === 'number' && !Number.isNaN(item.stock) ? (
                <div className={cx('metaRow')}>
                  <dt>Tồn kho</dt>
                  <dd>
                    {item.stock > 0 ? (
                      <>
                        Còn <strong>{item.stock}</strong> cuốn
                        {stockTier === 'lowStock' ? ' (sắp hết)' : ''}
                      </>
                    ) : (
                      <span style={{ color: '#b91c1c' }}>Hết hàng</span>
                    )}
                  </dd>
                </div>
              ) : null}
              <div className={cx('metaRow')}>
                <dt>Định dạng</dt>
                <dd>Sách giấy · Giao tận nơi</dd>
              </div>
            </dl>

            <div className={cx('pillGroup')}>
              <span className={cx('pillLabel')}>Chọn loại sách</span>
              <div className={cx('pills')}>
                <button
                  type="button"
                  className={cx('pill', formatBook === 'paper' && 'pillActive')}
                  onClick={() => setFormatBook('paper')}
                >
                  Sách giấy
                </button>
                <button type="button" className={cx('pill', 'pillDisabled')} disabled title="Sắp ra mắt">
                  Sách điện tử
                </button>
                <button type="button" className={cx('pill', 'pillDisabled')} disabled title="Sắp ra mắt">
                  Sách nói
                </button>
              </div>
            </div>

            <div className={cx('pillGroup')}>
              <span className={cx('pillLabel')}>Nội dung hiển thị</span>
              <div className={cx('pills')}>
                <button
                  type="button"
                  className={cx('pill', contentMode === 'full' && 'pillActive')}
                  onClick={() => setContentMode('full')}
                >
                  Đầy đủ
                </button>
                <button
                  type="button"
                  className={cx('pill', contentMode === 'summary' && 'pillActive')}
                  onClick={() => setContentMode('summary')}
                >
                  Tóm tắt
                </button>
              </div>
            </div>

            <div className={cx('priceBlock')}>
              {hasDiscount && (
                <span className={cx('priceOld')}>{formatVndDisplay(listVnd)}</span>
              )}
              <span className={cx('priceMain')}>{formatVndDisplay(saleDisplayVnd)}</span>
            </div>
            {isMemberOnlyBook && !isMember && (
              <p style={{ margin: '0 0 8px', color: '#b45309', fontWeight: 600, fontSize: '0.95rem' }}>
                Giá ưu đãi chỉ áp dụng cho tài khoản hội viên.
              </p>
            )}

            {stockTier === 'lowStock' && typeof item.stock === 'number' && (
              <p style={{ margin: '0 0 8px', color: '#b45309', fontWeight: 600, fontSize: '0.95rem' }}>
                Chỉ còn {item.stock} cuốn trong kho
              </p>
            )}
            {blockPurchase && (
              <p style={{ margin: '0 0 8px', color: '#b91c1c', fontWeight: 600, fontSize: '0.95rem' }}>
                Tạm hết hàng — có thể đặt trước khi có lô mới (liên hệ cửa hàng)
              </p>
            )}

            <div className={cx('qtyRow')}>
              <span className={cx('qtyLabel')}>Số lượng</span>
              <div className={cx('qtyControl')}>
                <button type="button" className={cx('qtyBtn')} onClick={() => setcount((c) => Math.max(1, c - 1))}>
                  −
                </button>
                <input
                  className={cx('qtyInput')}
                  readOnly
                  value={count}
                  aria-label="Số lượng"
                />
                <button
                  type="button"
                  className={cx('qtyBtn')}
                  disabled={blockPurchase || count >= maxBuy}
                  onClick={() => setcount((c) => Math.min(maxBuy, c + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div className={cx('ctaRow')}>
              <button
                type="button"
                className={cx('btnRead')}
                disabled={blockPurchase}
                onClick={handleCheckout}
              >
                <i className="fa-solid fa-bag-shopping" />
                {blockPurchase ? 'Hết hàng' : 'Mua ngay'}
              </button>
              <button
                type="button"
                className={cx('btnCart')}
                disabled={blockPurchase}
                onClick={handleCart}
              >
                <i className="fa-solid fa-cart-plus" />
                {blockPurchase ? 'Không thể thêm' : 'Thêm vào giỏ'}
              </button>
              <button type="button" className={cx('iconCircle')} aria-label="Yêu thích">
                <i className="fa-regular fa-heart" />
              </button>
              <button type="button" className={cx('iconCircle')} aria-label="Chia sẻ">
                <i className="fa-solid fa-share-nodes" />
              </button>
            </div>

            <div className={cx('shipNote')}>
              <i className="fa-solid fa-truck-fast" />
              <div>
                <strong>Miễn phí vận chuyển</strong> cho đơn từ 300.000đ · Giao nhanh 2–5 ngày
              </div>
            </div>
          </div>

          {auth?.isAuthenticated && !auth?.user?.isMember && (
            <aside className={cx('memberCard')} aria-label="Gói hội viên">
              <span className={cx('memberBadge')}>
                <i className="fa-solid fa-crown" /> Hội viên
              </span>
              <p className={cx('memberTitle')}>ĐỌC &amp; NGHE SÁCH KHÔNG GIỚI HẠN</p>
              <p className={cx('memberText')}>
                Ưu đãi giảm thêm, ưu tiên sách mới và nội dung độc quyền dành cho thành viên BookStore.
              </p>
              <button type="button" className={cx('memberCta')} onClick={handleBecomeMember}>
                Trở thành hội viên
              </button>
            </aside>
          )}
        </div>

        <section className={cx('descSection')} aria-labelledby="desc-heading">
          <h2 id="desc-heading" className={cx('descHeading')}>
            Giới thiệu sách
          </h2>
          <div className={cx('descBody')}>
            {contentMode === 'summary' ? (
              <p>
                {descPlain.length > 180
                  ? `${descPlain.slice(0, 180).trim()}…`
                  : descPlain || 'Đang cập nhật mô tả cho cuốn sách này.'}
              </p>
            ) : (
              <p>
                {descExpanded || !showDescToggle
                  ? descPlain || 'Đang cập nhật mô tả cho cuốn sách này.'
                  : `${descPlain.slice(0, descPreviewLen).trim()}…`}
                {showDescToggle && (
                  <button type="button" className={cx('descMore')} onClick={() => setDescExpanded((e) => !e)}>
                    {descExpanded ? ' Thu gọn' : ' Xem thêm'}
                  </button>
                )}
              </p>
            )}
          </div>
        </section>

        {Array.isArray(item.seriesBooks) && item.seriesBooks.length > 0 && (
          <section className={cx('Product-suggest')} aria-labelledby="series-suggest-heading">
            <h2 id="series-suggest-heading" className={cx('suggest-title')}>
              Cùng bộ sách{item.series && typeof item.series === 'object' && item.series.name
                ? `: ${item.series.name}`
                : ''}
            </h2>
            <CategoryBookRow books={item.seriesBooks} />
          </section>
        )}

        {Number(item.authorBooksTotal) > 0 && Array.isArray(item.authorBooks) && (
          <section className={cx('Product-suggest')} aria-labelledby="author-suggest-heading">
            <h2 id="author-suggest-heading" className={cx('suggest-title')}>
              Cùng tác giả{authorLabel && authorLabel !== 'Đang cập nhật' ? `: ${authorLabel}` : ''}
            </h2>
            <CategoryBookRow books={item.authorBooks} />
            {(() => {
              const size = Number(item.authorBooksPageSize) || 8;
              const total = Number(item.authorBooksTotal) || 0;
              const pages = Math.max(1, Math.ceil(total / size));
              if (pages <= 1) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className={cx('breadcrumbLink')}
                    style={{
                      cursor: authorPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: authorPage <= 1 ? 0.45 : 1,
                      border: 'none',
                      background: 'none',
                      font: 'inherit',
                      fontWeight: 600,
                    }}
                    disabled={authorPage <= 1}
                    onClick={() => setAuthorPage((p) => Math.max(1, p - 1))}
                  >
                    ← Trang trước
                  </button>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>
                    Trang {authorPage} / {pages}
                  </span>
                  <button
                    type="button"
                    className={cx('breadcrumbLink')}
                    style={{
                      cursor: authorPage >= pages ? 'not-allowed' : 'pointer',
                      opacity: authorPage >= pages ? 0.45 : 1,
                      border: 'none',
                      background: 'none',
                      font: 'inherit',
                      fontWeight: 600,
                    }}
                    disabled={authorPage >= pages}
                    onClick={() => setAuthorPage((p) => Math.min(pages, p + 1))}
                  >
                    Trang sau →
                  </button>
                </div>
              );
            })()}
          </section>
        )}

        <div className={cx('Product-suggest')}>
          <h2 className={cx('suggest-title')}>Sách cùng thể loại</h2>
          <ListItem category={item.category} id={item._id} prefetchedBooks={item.sameCategoryBooks} />
        </div>

        <div id="book-reviews" className={cx('Product-review')}>
          <Review book={item} />
        </div>

        {/* Lightbox xem ảnh lớn */}
        {showLightbox && allImages.length > 0 && (
          <div className={cx('lightboxOverlay')} onClick={handleCloseLightbox}>
            <div className={cx('lightboxContent')} onClick={(e) => e.stopPropagation()}>
              <button className={cx('lightboxClose')} onClick={handleCloseLightbox}>
                <i className="fa-solid fa-xmark" />
              </button>

              {allImages.length > 1 && (
                <>
                  <button className={cx('lightboxPrev')} onClick={handlePrevImage}>
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button className={cx('lightboxNext')} onClick={handleNextImage}>
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </>
              )}

              <img
                src={allImages[lightboxIndex]}
                alt={item.name}
                className={cx('lightboxImage')}
              />

              {allImages.length > 1 && (
                <div className={cx('lightboxCounter')}>
                  {lightboxIndex + 1} / {allImages.length}
                </div>
              )}

              <div className={cx('lightboxThumbs')}>
                {allImages.map((src, idx) => (
                  <button
                    key={idx}
                    className={cx('lightboxThumb', idx === lightboxIndex && 'lightboxThumbActive')}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setCurrentImage(src);
                    }}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Details;
