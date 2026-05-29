import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  getAllHeroImages,
  createHeroImage,
  updateHeroImage,
  deleteHeroImage,
  reorderHeroImages,
} from '../../app/api/HeroImageApi.js';
import AdminColumnSettingsPanel from '../../components/Admin/AdminColumnSettingsPanel.js';
import AdminPaginationBar from '../../components/Admin/AdminPaginationBar.js';
import { useAdminTableColumns } from '../../hooks/useAdminTableColumns.js';
import { useAdminListPreferences } from '../../hooks/useAdminListPreferences.js';
import { useAdminPagedRows } from '../../hooks/useAdminPagedRows.js';
import { LS_HERO_COLS, HERO_TABLE_SPEC } from '../../config/adminDashboardSpecs.js';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Link } from 'react-router-dom';

import { resolveMediaUrl } from '../../config/api';

const cx = classNames.bind(styles);

function ManageHeroImage() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [formData, setFormData] = useState({
    imageFile: null,
    imageUrl: '',
    altText: '',
    link: '',
    order: 0,
    isActive: true,
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const [showColSettings, setShowColSettings] = useState(false);
  const [filterActive, setFilterActive] = useState('all');

  const cols = useAdminTableColumns(LS_HERO_COLS, HERO_TABLE_SPEC);
  const { isActive, gridTemplateColumns } = cols;
  const gridStyle = { gridTemplateColumns };

  const loadImages = async () => {
    setIsLoading(true);
    try {
      const data = await getAllHeroImages();
      setImages(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Không thể tải danh sách hero images');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadImages();
  }, []);

  const sortedImages = useMemo(() => [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [images]);

  const filteredImages = useMemo(() => {
    if (filterActive === 'active') return sortedImages.filter((i) => i.isActive !== false);
    if (filterActive === 'inactive') return sortedImages.filter((i) => i.isActive === false);
    return sortedImages;
  }, [sortedImages, filterActive]);

  const listPrefs = useAdminListPreferences();
  const { page, setPage, totalPages, pagedRows } = useAdminPagedRows(filteredImages, listPrefs);

  const handleOpenAdd = () => {
    setEditingImage(null);
    setFormData({
      imageFile: null,
      imageUrl: '',
      altText: '',
      link: '',
      order: images.length,
      isActive: true,
    });
    setPreviewUrl('');
    setShowModal(true);
  };

  const handleOpenEdit = (image) => {
    setEditingImage(image);
    setFormData({
      imageFile: null,
      imageUrl: image.imageUrl || '',
      altText: image.altText || '',
      link: image.link || '',
      order: image.order || 0,
      isActive: image.isActive !== false,
    });
    setPreviewUrl(image.imageUrl || '');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingImage(null);
    setFormData({
      imageFile: null,
      imageUrl: '',
      altText: '',
      link: '',
      order: 0,
      isActive: true,
    });
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, imageFile: file, imageUrl: '' });
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData({ ...formData, imageUrl: url, imageFile: null });
    setPreviewUrl(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.imageFile && !formData.imageUrl) {
      toast.error('Vui lòng chọn ảnh hoặc nhập URL ảnh');
      return;
    }

    const data = new FormData();
    if (formData.imageFile) data.append('image', formData.imageFile);
    data.append('imageUrl', formData.imageUrl);
    data.append('altText', formData.altText);
    data.append('link', formData.link);
    data.append('order', formData.order);
    data.append('isActive', formData.isActive);

    try {
      if (editingImage) {
        await updateHeroImage(editingImage._id, data);
        toast.success('Cập nhật thành công');
      } else {
        await createHeroImage(data);
        toast.success('Thêm thành công');
      }
      handleCloseModal();
      loadImages();
    } catch {
      toast.error(editingImage ? 'Cập nhật thất bại' : 'Thêm thất bại');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa hero image "${item.altText || 'này'}"?`)) return;
    try {
      await deleteHeroImage(item._id);
      toast.success('Đã xóa hero image');
      loadImages();
    } catch {
      toast.error('Xóa thất bại');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateHeroImage(item._id, {
        altText: item.altText,
        link: item.link,
        order: item.order,
        isActive: !item.isActive,
      });
      loadImages();
    } catch {
      toast.error('Cập nhật trạng thái thất bại');
    }
  };

  const handleMoveOrder = async (id, direction) => {
    const sorted = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((x) => x._id === id);
    if (idx < 0) return;
    const j = direction === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= sorted.length) return;

    const updates = [
      { id: sorted[idx]._id, order: sorted[j].order },
      { id: sorted[j]._id, order: sorted[idx].order },
    ];

    try {
      await reorderHeroImages(updates);
      loadImages();
    } catch {
      toast.error('Không thể thay đổi thứ tự');
    }
  };

  const handleResetFilters = () => {
    setFilterActive('all');
  };

  if (isLoading) {
    return (
      <div className={cx('loading')}>
        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10, fontSize: '1.8rem' }} />
        Đang tải dữ liệu...
      </div>
    );
  }

  return (
    <div>
      <div className={cx('admin-nav')}>
        <div className={`${cx('logo-search')} admin-title`}>
          <div>
            <i className="fa-solid fa-images" />
            <span className="admin-title-name">Quản Lý Hero Slider</span>
          </div>
        </div>

        <button onClick={handleOpenAdd} className={`btn btn--admin btn-add`}>
          <i className="fa-solid fa-plus" />
          Thêm Ảnh Mới
        </button>
      </div>

      <div className={cx('dashboardToolbar')}>
        <div className={cx('dashboardToolbarFilters')}>
          <div className={cx('dashboardFilterGroup')}>
            <span className={cx('dashboardFilterLabel')}>Trên trang chủ</span>
            <select
              className={cx('dashboardFilterSelect')}
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hiển thị</option>
              <option value="inactive">Đang ẩn</option>
            </select>
          </div>
        </div>
        <div className={cx('dashboardToolbarActions')}>
          <button type="button" className={cx('dashboardSettingsBtn')} onClick={handleResetFilters}>
            <i className="fa-solid fa-rotate-left" />
            Reset filter
          </button>
          <Link to="/admin/Settings" className={cx('dashboardSettingsBtn')} style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-gear" />
            Cài đặt
          </Link>
          <button type="button" className={cx('dashboardSettingsBtn')} onClick={() => setShowColSettings(true)}>
            <i className="fa-solid fa-table-columns" />
            Cột bảng
          </button>
        </div>
      </div>

      <div className={cx('data-card')}>
        <div className={cx('data-card-header')}>
          <h3 className={cx('data-card-title')}>
            <i className="fa-solid fa-images" style={{ marginRight: 8, color: '#2dd4bf' }} />
            Danh Sách Hero Slider ({filteredImages.length}
            {filteredImages.length !== sortedImages.length ? ` / ${sortedImages.length}` : ''})
          </h3>
        </div>
        <div className={cx('data-card-body')}>
          <div className={cx('hero-table-header')} style={gridStyle}>
            {isActive('thumb') && <span style={{ textAlign: 'left' }}>Hình Ảnh</span>}
            {isActive('alt') && <span>Alt Text</span>}
            {isActive('link') && <span>Link</span>}
            {isActive('orderCol') && <span>Thứ Tự</span>}
            {isActive('status') && <span>Trạng Thái</span>}
            {isActive('action') && <span style={{ textAlign: 'right' }}>Thao tác</span>}
          </div>

          {sortedImages.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-images" />
              <p>Chưa có hero image nào</p>
              <p className="empty-desc">Nhấn &quot;Thêm Ảnh Mới&quot; để tạo</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className={cx('emptyState')}>
              <i className="fa-solid fa-filter" />
              <p>Không có slide khớp bộ lọc</p>
            </div>
          ) : (
            pagedRows.map((item, idx) => {
              const globalIdx = sortedImages.findIndex((x) => x._id === item._id);
              return (
                <div
                  key={item._id}
                  className={cx('hero-table-row')}
                  style={{ ...gridStyle, animationDelay: `${idx * 0.05}s` }}
                >
                  {isActive('thumb') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <img
                        src={resolveMediaUrl(item.imageUrl)}
                        alt={item.altText || 'Hero'}
                        className={cx('hero-thumb')}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/80x50?text=No+Img';
                        }}
                      />
                      <span
                        style={{
                          fontSize: '1.35rem',
                          color: '#475569',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.altText || '—'}
                      </span>
                    </div>
                  )}

                  {isActive('alt') && (
                    <span
                      style={{
                        fontSize: '1.35rem',
                        color: '#64748b',
                        textAlign: 'center',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.altText || '—'}
                    </span>
                  )}

                  {isActive('link') && (
                    <span style={{ textAlign: 'center' }}>
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2dd4bf', fontSize: '1.3rem', fontWeight: 500, textDecoration: 'none' }}
                          title={item.link}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Mở link
                        </a>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: '1.3rem' }}>—</span>
                      )}
                    </span>
                  )}

                  {isActive('orderCol') && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className={cx('reorder-controls')}>
                        <button
                          type="button"
                          title="Đưa lên"
                          className={cx('reorder-btn')}
                          disabled={globalIdx <= 0}
                          onClick={() => handleMoveOrder(item._id, 'up')}
                        >
                          <i className="fa-solid fa-chevron-up" style={{ fontSize: '1.1rem' }} />
                        </button>
                        <span className={cx('reorder-number')}>{item.order}</span>
                        <button
                          type="button"
                          title="Đưa xuống"
                          className={cx('reorder-btn')}
                          disabled={globalIdx < 0 || globalIdx >= sortedImages.length - 1}
                          onClick={() => handleMoveOrder(item._id, 'down')}
                        >
                          <i className="fa-solid fa-chevron-down" style={{ fontSize: '1.1rem' }} />
                        </button>
                      </div>
                    </div>
                  )}

                  {isActive('status') && (
                    <span style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`${cx('toggle-btn')} ${item.isActive !== false ? cx('toggle-btn--active') : cx('toggle-btn--inactive')}`}
                        onClick={() => handleToggleActive(item)}
                      >
                        {item.isActive !== false ? (
                          <>
                            <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />
                            Hiển thị
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-eye-slash" style={{ marginRight: 4 }} />
                            Ẩn
                          </>
                        )}
                      </button>
                    </span>
                  )}

                  {isActive('action') && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => handleOpenEdit(item)} className={cx('btn-controll')} title="Sửa">
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className={`${cx('btn-controll')} delete`}
                        title="Xóa"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {listPrefs.paginationEnabled && filteredImages.length > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredImages.length}
              pageSize={listPrefs.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <AdminColumnSettingsPanel
        open={showColSettings}
        onClose={() => setShowColSettings(false)}
        title="Cột bảng — Hero slider"
        optionalColumns={cols.optionalColumns}
        purgedColumns={cols.purgedColumns}
        isActive={cols.isActive}
        toggleVisible={cols.toggleVisible}
        purgeColumn={cols.purgeColumn}
        restorePurged={cols.restorePurged}
        resetDefaults={cols.resetDefaults}
      />

      {showModal && (
        <div className={cx('modalOverlay')} onClick={handleCloseModal}>
          <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
            <div className={cx('modalHeader')}>
              <h3>
                <i className="fa-solid fa-image" style={{ marginRight: 8 }} />
                {editingImage ? 'Sửa Hero Image' : 'Thêm Hero Image'}
              </h3>
              <button type="button" className={cx('modalClose')} onClick={handleCloseModal}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={cx('modalBody')}>
              <div className={cx('formGroup')}>
                <label>Xem trước</label>
                <div className={cx('imagePreview')}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" />
                  ) : (
                    <div className={cx('noImage')}>
                      <i className="fa-solid fa-image" style={{ fontSize: '2rem', marginBottom: 8 }} />
                      Chưa chọn ảnh
                    </div>
                  )}
                </div>
              </div>

              <div className={cx('formGroup')}>
                <label>Upload ảnh</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={cx('fileInput')}
                />
              </div>

              <div className={cx('formGroup')}>
                <label>Hoặc nhập URL ảnh</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/image.jpg"
                  className={cx('input')}
                />
              </div>

              <div className={cx('formGroup')}>
                <label>Alt text (mô tả ảnh)</label>
                <input
                  type="text"
                  value={formData.altText}
                  onChange={(e) => setFormData({ ...formData, altText: e.target.value })}
                  placeholder="Mô tả ngắn cho ảnh"
                  className={cx('input')}
                />
              </div>

              <div className={cx('formGroup')}>
                <label>Link (khi click vào ảnh)</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com/promo"
                  className={cx('input')}
                />
              </div>

              <div className={cx('formGroup')}>
                <label>Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  className={cx('input')}
                  min="0"
                />
              </div>

              <div className={cx('formGroup')}>
                <label className={cx('checkboxLabel')}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Hiển thị trên trang chủ
                </label>
              </div>

              <div className={cx('modalFooter')}>
                <button type="button" className={`btn btn--secondary`} onClick={handleCloseModal}>
                  Hủy
                </button>
                <button type="submit" className={`btn btn--primary`}>
                  {editingImage ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageHeroImage;
