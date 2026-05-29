import styles from '../Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import axios from '../axios/axios.customize';
import { toast } from 'react-toastify';
import { useEffect, useRef, useState } from 'react';
import { getCategoryList } from '../../app/api/siteApi.js';
import { BOOK_FORMAT_OPTIONS } from '../../utils/bookFormat.js';
import { parseVndInputToDong } from '../function/function.js';
import { resolveMediaUrl } from '../../config/api.js';
import { slugifyBookNamePreview } from '../../utils/bookCoverSlug.js';
import {
  ACCEPT_BOOK_IMAGE,
  uploadBookCoverFile,
  validateBookImageFile,
} from '../../utils/bookImageUpload.js';
import {
  EXTRA_IMAGE_SLOTS,
  buildFormStateFromBook,
  coverStateFromBook,
  extraImagesFromBook,
  toNumOrNull,
} from './bookFormModalUtils.js';

const cx = classNames.bind(styles);

function FieldLabel({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor}>
      {children}
      {required ? <span className={cx('requiredMark')} aria-hidden="true"> *</span> : null}
    </label>
  );
}

function FormSection({ title, children }) {
  return (
    <section className={cx('bookFormSection')}>
      {title ? <h4 className={cx('bookFormSectionTitle')}>{title}</h4> : null}
      {children}
    </section>
  );
}

function imageDisplaySrc({ preview, existingUrl }) {
  if (preview) return preview;
  if (existingUrl) return resolveMediaUrl(existingUrl);
  return '';
}

function BookFormModal({ book = null, onClose, onSuccess }) {
  const isEdit = Boolean(book?._id);

  const [categories, setCategories] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [authorsList, setAuthorsList] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => buildFormStateFromBook(book));
  const [showSeriesNewInput, setShowSeriesNewInput] = useState(false);
  const [showAuthorNewInput, setShowAuthorNewInput] = useState(false);
  const [showPublisherNewInput, setShowPublisherNewInput] = useState(false);
  const [showSupplierNewInput, setShowSupplierNewInput] = useState(false);
  const [seriesNewDraft, setSeriesNewDraft] = useState('');
  const [authorNewDraft, setAuthorNewDraft] = useState('');
  const [publisherPick, setPublisherPick] = useState(book?.publisher ?? '');
  const [supplierPick, setSupplierPick] = useState(book?.supplier ?? '');
  const [publisherNewDraft, setPublisherNewDraft] = useState('');
  const [supplierNewDraft, setSupplierNewDraft] = useState('');
  const [cover, setCover] = useState(() => coverStateFromBook(book));
  const [extraImages, setExtraImages] = useState(() => extraImagesFromBook(book));
  const coverInputRef = useRef(null);
  const previewObjectUrlRef = useRef(null);
  const extraPreviewUrlsRef = useRef({});
  const extraInputRefs = useRef({});

  const resetFromBook = (b) => {
    setFormData(buildFormStateFromBook(b));
    setCover(coverStateFromBook(b));
    setExtraImages(extraImagesFromBook(b));
    setPublisherPick(b?.publisher ?? '');
    setSupplierPick(b?.supplier ?? '');
    setShowSeriesNewInput(false);
    setShowAuthorNewInput(false);
    setShowPublisherNewInput(false);
    setShowSupplierNewInput(false);
    setSeriesNewDraft('');
    setAuthorNewDraft('');
    setPublisherNewDraft('');
    setSupplierNewDraft('');
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    Object.values(extraPreviewUrlsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    extraPreviewUrlsRef.current = {};
    if (coverInputRef.current) coverInputRef.current.value = '';
    EXTRA_IMAGE_SLOTS.forEach((slot) => {
      if (extraInputRefs.current[slot]) extraInputRefs.current[slot].value = '';
    });
  };

  useEffect(() => {
    resetFromBook(book);
  }, [book?._id]);

  useEffect(() => {
    (async () => {
      const list = await getCategoryList();
      setCategories(Array.isArray(list) ? list : []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await axios.get('/api/series');
        setSeriesList(Array.isArray(s) ? s : []);
      } catch {
        setSeriesList([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const a = await axios.get('/api/authors');
        setAuthorsList(Array.isArray(a) ? a : []);
      } catch {
        setAuthorsList([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await axios.get('/api/publishers');
        setPublishers(Array.isArray(p) ? p : []);
      } catch {
        setPublishers([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await axios.get('/api/suppliers');
        setSuppliers(Array.isArray(s) ? s : []);
      } catch {
        setSuppliers([]);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      Object.values(extraPreviewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const clearCoverSelection = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setCover((prev) => ({ ...prev, file: null, preview: '' }));
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleCoverFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateBookImageFile(file);
    if (err) {
      toast.error(err);
      e.target.value = '';
      return;
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    previewObjectUrlRef.current = URL.createObjectURL(file);
    setCover((prev) => ({
      ...prev,
      file,
      preview: previewObjectUrlRef.current,
    }));
  };

  const revokeExtraPreview = (slot) => {
    const url = extraPreviewUrlsRef.current[slot];
    if (url) {
      URL.revokeObjectURL(url);
      delete extraPreviewUrlsRef.current[slot];
    }
  };

  const handleExtraFileChange = (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateBookImageFile(file);
    if (err) {
      toast.error(err);
      e.target.value = '';
      return;
    }
    revokeExtraPreview(slot);
    const preview = URL.createObjectURL(file);
    extraPreviewUrlsRef.current[slot] = preview;
    setExtraImages((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], file, preview },
    }));
  };

  const clearExtraImage = (slot) => {
    revokeExtraPreview(slot);
    setExtraImages((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], file: null, preview: '' },
    }));
    if (extraInputRefs.current[slot]) extraInputRefs.current[slot].value = '';
  };

  const bookName = formData.name;
  const coverExt = cover.file?.name
    ? (cover.file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || '.jpg')
    : '.jpg';
  const expectedFilename = bookName.trim()
    ? `${slugifyBookNamePreview(bookName)}${coverExt === '.jpeg' ? '.jpg' : coverExt}`
    : '';
  const coverSrc = imageDisplaySrc(cover);
  const coverHasNewPick = Boolean(cover.file || cover.preview);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const name = formData.name.trim();
    const publisher = showPublisherNewInput ? publisherNewDraft.trim() : publisherPick.trim();
    const supplier = showSupplierNewInput ? supplierNewDraft.trim() : supplierPick.trim();
    const seriesNewName = showSeriesNewInput ? seriesNewDraft.trim() : '';
    const authorNewName = showAuthorNewInput ? authorNewDraft.trim() : '';

    if (!name) {
      toast.error('Vui lòng nhập tên sách');
      setIsSubmitting(false);
      return;
    }
    const priceDong = parseVndInputToDong(formData.price);
    if (!priceDong) {
      toast.error('Vui lòng nhập giá hợp lệ (VD: 150.000đ hoặc 150000)');
      setIsSubmitting(false);
      return;
    }
    if (!isEdit && !cover.file && !cover.existingUrl) {
      toast.error('Vui lòng chọn ảnh bìa sách');
      setIsSubmitting(false);
      return;
    }
    if (isEdit && !cover.file && !cover.existingUrl) {
      toast.error('Sách cần có ảnh bìa');
      setIsSubmitting(false);
      return;
    }

    try {
      if (showPublisherNewInput && publisher) {
        try {
          await axios.post('/api/publishers', { name: publisher });
        } catch (err) {
          const msg = String(err?.response?.data?.message || '').toLowerCase();
          if (!msg.includes('duplicate') && !msg.includes('trùng')) throw err;
        }
      }
      if (showSupplierNewInput && supplier) {
        try {
          await axios.post('/api/suppliers', { name: supplier });
        } catch (err) {
          const msg = String(err?.response?.data?.message || '').toLowerCase();
          if (!msg.includes('duplicate') && !msg.includes('trùng')) throw err;
        }
      }

      let img = cover.existingUrl || '';
      if (cover.file) {
        img = await uploadBookCoverFile(cover.file, name, 'cover');
        if (!img) throw new Error('Upload ảnh bìa không trả về đường dẫn');
      }

      const imgExtras = {};
      for (const slot of EXTRA_IMAGE_SLOTS) {
        const slotState = extraImages[slot];
        let url = slotState.existingUrl || '';
        if (slotState.file) {
          url = await uploadBookCoverFile(slotState.file, name, String(slot));
        }
        if (url) imgExtras[`img${slot}`] = url;
      }

      const genresArr = String(formData.genres || '')
        .split(',')
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);

      const baseFields = {
        name,
        description: formData.description.trim(),
        image: img,
        img,
        ...imgExtras,
        category: formData.category,
        price: String(priceDong),
        publisher,
        pages: toNumOrNull(formData.pages),
        weight: toNumOrNull(formData.weight),
        productionYear: toNumOrNull(formData.productionYear),
        publishedYear: toNumOrNull(formData.publishedYear),
        format: formData.format || null,
        brand: formData.brand.trim() || undefined,
        supplier: supplier || undefined,
        language: formData.language || undefined,
        genres: genresArr.length ? genresArr : undefined,
        ageRange: formData.ageRange.trim() || undefined,
        manufacturingOrigin: formData.manufacturingOrigin.trim() || undefined,
        brandOrigin: formData.brandOrigin.trim() || undefined,
        coverColor: formData.coverColor.trim() || undefined,
        isMemberOnly: formData.isMemberOnly === 'true',
      };

      if (seriesNewName) {
        baseFields.seriesNewName = seriesNewName;
      } else if (formData.series) {
        baseFields.series = formData.series;
      } else if (isEdit) {
        baseFields.series = null;
      }

      if (authorNewName) {
        baseFields.authorNewName = authorNewName;
      } else if (formData.authorRef) {
        baseFields.authorRef = formData.authorRef;
      } else if (isEdit) {
        baseFields.authorRef = '';
      }

      if (isEdit) {
        const payload = {
          ...book,
          ...baseFields,
          discount: Number.parseInt(formData.discount, 10) || 0,
          isFavourite: formData.isFavourite === 'true',
          status: formData.status || 'draft',
        };
        await axios.put('/api/books', payload);
        if (onSuccess) onSuccess(payload);
        toast.success('Cập nhật sách thành công!');
      } else {
        const newBook = await axios.post('/api/books', baseFields);
        if (onSuccess) onSuccess(newBook);
        toast.success('Thêm sách thành công!');
      }
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (isEdit ? 'Cập nhật sách thất bại' : 'Thêm sách không thành công');
      toast.error(msg);
    }
    setIsSubmitting(false);
  };

  const publisherNames = publishers.map((p) => p.name);
  const publisherInList = !publisherPick || publisherNames.includes(publisherPick);

  return (
    <div className={cx('modalOverlay')} onClick={onClose}>
      <div className={cx('modalContent')} onClick={(ev) => ev.stopPropagation()}>
        <div
          className={cx('modalHeader', { 'modalHeader--edit': isEdit })}
          style={isEdit ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : undefined}
        >
          <h3>
            <i
              className={isEdit ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-plus-circle'}
              style={{ marginRight: 8 }}
            />
            {isEdit ? 'Sửa thông tin sách' : 'Thêm sách mới'}
          </h3>
          <button type="button" className={cx('modalClose')} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={cx('modalBody')}>
          <p className={cx('bookFormRequiredLegend')}>
            <span className={cx('requiredMark')} aria-hidden="true">*</span> Trường bắt buộc
          </p>

          <FormSection title="Thông tin cơ bản">
            <div className={cx('formGroup')}>
              <FieldLabel required>Tên sách</FieldLabel>
              <input
                name="name"
                className={cx('input')}
                type="text"
                placeholder="Nhập tên sách..."
                value={formData.name}
                onChange={handleChange}
                autoFocus
              />
            </div>

            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel required>Giá niêm yết</FieldLabel>
                  <input
                    name="price"
                    className={cx('input')}
                    type="text"
                    inputMode="text"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="Ví dụ: 150.000đ"
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel required>Thể loại</FieldLabel>
                  <select
                    name="category"
                    className={cx('select-admin')}
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Chọn thể loại --</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={cx('formGroup')}>
              <FieldLabel>Mô tả sách</FieldLabel>
              <textarea
                rows={4}
                name="description"
                className={cx('input-big')}
                value={formData.description}
                onChange={handleChange}
                placeholder="Nhập mô tả chi tiết về cuốn sách..."
              />
            </div>
          </FormSection>

          <FormSection title="Hình ảnh">
            <div className={cx('formGroup')}>
              <FieldLabel required={!isEdit}>Ảnh bìa</FieldLabel>
            {isEdit && (
              <p className={cx('modalFieldHint')}>
                Chọn file mới để thay ảnh; bỏ qua nếu giữ ảnh hiện tại.
              </p>
            )}
            <div className={cx('imagePreview')}>
              {coverSrc ? (
                <img src={coverSrc} alt="Xem trước ảnh bìa" />
              ) : (
                <div className={cx('noImage')}>
                  <i className="fa-solid fa-image" style={{ fontSize: '2rem', marginBottom: 8 }} />
                  Chưa chọn ảnh
                </div>
              )}
            </div>
            {expectedFilename && (
              <p className={cx('modalFieldHint')}>
                File lưu tại uploads: <strong>{expectedFilename}</strong>
                {cover.file ? ` (${cover.file.name})` : ''}
              </p>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept={ACCEPT_BOOK_IMAGE}
              className={cx('fileInput')}
              onChange={handleCoverFileChange}
            />
            {(coverHasNewPick || cover.existingUrl) && (
              <button
                type="button"
                className={cx('coverClearBtn')}
                onClick={clearCoverSelection}
              >
                <i className="fa-solid fa-trash-can" aria-hidden />
                {coverHasNewPick ? ' Xóa ảnh đã chọn' : ' Bỏ chọn file mới'}
              </button>
            )}
          </div>

          <div className={cx('formGroup')}>
            <FieldLabel>Ảnh phụ (tối đa 4 — gallery trang chi tiết)</FieldLabel>
            <p className={cx('modalFieldHint')}>
              Tùy chọn. Tên file: <strong>{slugifyBookNamePreview(bookName) || 'ten-sach'}-1.jpg</strong> … -4.jpg
              {isEdit ? ' — chọn file mới để thay từng ảnh.' : ''}
            </p>
            <div className={cx('bookExtraImagesGrid')}>
              {EXTRA_IMAGE_SLOTS.map((slot) => {
                const slotState = extraImages[slot];
                const displaySrc = imageDisplaySrc(slotState);
                const slug = slugifyBookNamePreview(bookName) || 'sach';
                return (
                  <div key={slot} className={cx('bookImageSlot')}>
                    <span className={cx('bookImageSlotLabel')}>Ảnh phụ {slot}</span>
                    <div className={cx('imagePreview', 'imagePreview--small')}>
                      {displaySrc ? (
                        <img src={displaySrc} alt={`Ảnh phụ ${slot}`} />
                      ) : (
                        <div className={cx('noImage')}>
                          <i className="fa-solid fa-images" />
                          <span>Chưa có</span>
                        </div>
                      )}
                    </div>
                    <p className={cx('modalFieldHint')}>
                      <strong>{slug}-{slot}.jpg</strong>
                      {slotState.file ? ` · ${slotState.file.name}` : ''}
                    </p>
                    <input
                      ref={(el) => {
                        extraInputRefs.current[slot] = el;
                      }}
                      type="file"
                      accept={ACCEPT_BOOK_IMAGE}
                      className={cx('fileInput')}
                      onChange={(ev) => handleExtraFileChange(slot, ev)}
                    />
                    {(slotState.preview || slotState.file) && (
                      <button
                        type="button"
                        className={cx('coverClearBtn')}
                        onClick={() => clearExtraImage(slot)}
                      >
                        <i className="fa-solid fa-trash-can" aria-hidden /> Xóa file mới
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </FormSection>

          <FormSection title="Phân loại & tác giả">
            <div className={cx('formGroup')}>
              <div className={cx('modalLabelRow')}>
                <FieldLabel htmlFor="book-form-author">Tác giả</FieldLabel>
                <button
                  type="button"
                  className={cx('modalAddFieldBtn')}
                  aria-expanded={showAuthorNewInput}
                  onClick={() =>
                    setShowAuthorNewInput((v) => {
                      if (v) setAuthorNewDraft('');
                      return !v;
                    })
                  }
                >
                  <i className={showAuthorNewInput ? 'fa-solid fa-minus' : 'fa-solid fa-plus'} aria-hidden />
                </button>
              </div>
              <select
                id="book-form-author"
                name="authorRef"
                className={cx('select-admin')}
                value={formData.authorRef}
                onChange={handleChange}
              >
                <option value="">— Chưa chọn —</option>
                {authorsList.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {showAuthorNewInput && (
                <input
                  className={cx('input')}
                  type="text"
                  value={authorNewDraft}
                  onChange={(ev) => setAuthorNewDraft(ev.target.value)}
                  placeholder="VD: Nguyễn Nhật Ánh"
                  autoComplete="off"
                />
              )}
            </div>

            <div className={cx('formGroup')}>
              <div className={cx('modalLabelRow')}>
                <FieldLabel htmlFor="book-form-series">Bộ sách (series)</FieldLabel>
                <button
                  type="button"
                  className={cx('modalAddFieldBtn')}
                  aria-expanded={showSeriesNewInput}
                  onClick={() =>
                    setShowSeriesNewInput((v) => {
                      if (v) setSeriesNewDraft('');
                      return !v;
                    })
                  }
                >
                  <i className={showSeriesNewInput ? 'fa-solid fa-minus' : 'fa-solid fa-plus'} aria-hidden />
                </button>
              </div>
              <select
                id="book-form-series"
                name="series"
                className={cx('select-admin')}
                value={formData.series}
                onChange={handleChange}
              >
                <option value="">— Không thuộc series —</option>
                {seriesList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {showSeriesNewInput && (
                <input
                  className={cx('input')}
                  type="text"
                  value={seriesNewDraft}
                  onChange={(ev) => setSeriesNewDraft(ev.target.value)}
                  placeholder="VD: Harry Potter (bộ mới)"
                  autoComplete="off"
                />
              )}
            </div>

            <div className={cx('formGroup')}>
              <FieldLabel>Tag thể loại (phẩy)</FieldLabel>
              <input
                name="genres"
                className={cx('input')}
                type="text"
                value={formData.genres}
                onChange={handleChange}
                placeholder="comedy, romance"
              />
            </div>
          </FormSection>

          <FormSection title="Xuất bản & in ấn">
            <div className={cx('formGroup')}>
              <div className={cx('modalLabelRow')}>
                <FieldLabel htmlFor="book-form-publisher">Nhà xuất bản</FieldLabel>
              <button
                type="button"
                className={cx('modalAddFieldBtn')}
                aria-expanded={showPublisherNewInput}
                onClick={() =>
                  setShowPublisherNewInput((v) => {
                    if (v) setPublisherNewDraft('');
                    return !v;
                  })
                }
              >
                <i className={showPublisherNewInput ? 'fa-solid fa-minus' : 'fa-solid fa-plus'} aria-hidden />
              </button>
            </div>
            <select
              id="book-form-publisher"
              className={cx('select-admin')}
              value={publisherPick}
              onChange={(ev) => setPublisherPick(ev.target.value)}
            >
              <option value="">— Chưa chọn —</option>
              {!publisherInList && publisherPick && (
                <option value={publisherPick}>{publisherPick}</option>
              )}
              {publishers.map((p) => (
                <option key={p._id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            {showPublisherNewInput && (
              <input
                className={cx('input')}
                type="text"
                value={publisherNewDraft}
                onChange={(ev) => setPublisherNewDraft(ev.target.value)}
                placeholder="VD: NXB Tổng hợp TP.HCM"
                autoComplete="off"
              />
            )}
          </div>

            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Năm xuất bản</FieldLabel>
                  <input
                    name="publishedYear"
                    className={cx('input')}
                    type="number"
                    min="0"
                    max="9999"
                    value={formData.publishedYear}
                    onChange={handleChange}
                    placeholder="VD: 2024"
                  />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Năm sản xuất</FieldLabel>
                  <input
                    name="productionYear"
                    className={cx('input')}
                    type="number"
                    min="0"
                    max="9999"
                    value={formData.productionYear}
                    onChange={handleChange}
                    placeholder="VD: 2023"
                  />
                </div>
              </div>
            </div>

            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Số trang</FieldLabel>
                  <input
                    name="pages"
                    className={cx('input')}
                    type="number"
                    min="0"
                    value={formData.pages}
                    onChange={handleChange}
                    placeholder="VD: 320"
                  />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Trọng lượng (g)</FieldLabel>
                  <input
                    name="weight"
                    className={cx('input')}
                    type="number"
                    min="0"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="VD: 450"
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <FieldLabel>Kiểu bìa</FieldLabel>
                  <select name="format" className={cx('select-admin')} value={formData.format} onChange={handleChange}>
                    {BOOK_FORMAT_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Bổ sung & phân phối">
            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <FieldLabel>Thương hiệu</FieldLabel>
                <input
                  name="brand"
                  className={cx('input')}
                  type="text"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="VD: OEM"
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <div className={cx('modalLabelRow')}>
                  <FieldLabel htmlFor="book-form-supplier">Nhà cung cấp</FieldLabel>
                  <button
                    type="button"
                    className={cx('modalAddFieldBtn')}
                    aria-expanded={showSupplierNewInput}
                    onClick={() =>
                      setShowSupplierNewInput((v) => {
                        if (v) setSupplierNewDraft('');
                        return !v;
                      })
                    }
                  >
                    <i className={showSupplierNewInput ? 'fa-solid fa-minus' : 'fa-solid fa-plus'} aria-hidden />
                  </button>
                </div>
                <select
                  id="book-form-supplier"
                  className={cx('select-admin')}
                  value={supplierPick}
                  onChange={(ev) => setSupplierPick(ev.target.value)}
                >
                  <option value="">— Chưa chọn —</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {showSupplierNewInput && (
                  <input
                    className={cx('input')}
                    type="text"
                    value={supplierNewDraft}
                    onChange={(ev) => setSupplierNewDraft(ev.target.value)}
                    placeholder="VD: Fahasa, Nhã Nam..."
                    autoComplete="off"
                  />
                )}
              </div>
            </div>
          </div>

            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Ngôn ngữ</FieldLabel>
                  <select name="language" className={cx('select-admin')} value={formData.language} onChange={handleChange}>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">Tiếng Anh</option>
                    <option value="zh">Tiếng Trung</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <FieldLabel>Độ tuổi</FieldLabel>
                  <input
                    name="ageRange"
                    className={cx('input')}
                    type="text"
                    value={formData.ageRange}
                    onChange={handleChange}
                    placeholder="VD: 18+"
                  />
                </div>
              </div>
            </div>

            <div className={cx('formGroup')}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <FieldLabel>Nơi gia công</FieldLabel>
                  <input
                    name="manufacturingOrigin"
                    className={cx('input')}
                    type="text"
                    value={formData.manufacturingOrigin}
                    onChange={handleChange}
                    placeholder="VD: Trung Quốc"
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <FieldLabel>Xuất xứ TH</FieldLabel>
                  <input
                    name="brandOrigin"
                    className={cx('input')}
                    type="text"
                    value={formData.brandOrigin}
                    onChange={handleChange}
                    placeholder="VD: Trung Quốc"
                  />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <FieldLabel>Màu bìa</FieldLabel>
                  <input
                    name="coverColor"
                    className={cx('input')}
                    type="text"
                    value={formData.coverColor}
                    onChange={handleChange}
                    placeholder="VD: Đen"
                  />
                </div>
              </div>
            </div>

            <div className={cx('formGroup')}>
              <FieldLabel>Sách hội viên</FieldLabel>
              <select
                name="isMemberOnly"
                className={cx('select-admin')}
                value={formData.isMemberOnly}
                onChange={handleChange}
              >
                <option value="true">Có — chỉ hội viên mới được giảm giá</option>
                <option value="false">Không</option>
              </select>
            </div>
          </FormSection>

          {isEdit && (
            <FormSection title="Hiển thị & khuyến mãi">
              <div className={cx('formGroup')}>
                <FieldLabel>Trạng thái hiển thị trên web</FieldLabel>
                <select
                  name="status"
                  className={cx('select-admin')}
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="draft">Soạn thảo — chưa lên danh mục công khai</option>
                  <option value="published">Đã xuất bản — hiện trong danh mục và tìm kiếm</option>
                  <option value="unlisted">Ẩn danh mục — chỉ mở bằng link trực tiếp</option>
                  <option value="archived">Ngừng kinh doanh (không đưa lại published)</option>
                </select>
                {book.publishedAt && (
                  <p className={cx('modalFieldHint')}>
                    Lần xuất bản gần nhất:{' '}
                    <strong>{new Date(book.publishedAt).toLocaleString('vi-VN')}</strong>
                  </p>
                )}
              </div>

              <div className={cx('formGroup')}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Khuyến mãi (%)</FieldLabel>
                    <input
                      name="discount"
                      className={cx('input')}
                      type="number"
                      value={formData.discount}
                      onChange={handleChange}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Yêu thích</FieldLabel>
                    <select
                      name="isFavourite"
                      className={cx('select-admin')}
                      value={formData.isFavourite}
                      onChange={handleChange}
                    >
                      <option value="true">Có — Yêu thích</option>
                      <option value="false">Không</option>
                    </select>
                  </div>
                </div>
              </div>
            </FormSection>
          )}

          <div className={cx('modalFooter')}>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
              Trở lại
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? (
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
              ) : (
                <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
              )}
              {isEdit ? 'Lưu thay đổi' : 'Hoàn thành'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookFormModal;
