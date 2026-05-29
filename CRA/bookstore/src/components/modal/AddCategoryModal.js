import styles from '../Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import axios from '../axios/axios.customize';
import { toast } from 'react-toastify';

const cx = classNames.bind(styles);

function AddCategoryModal({ onClose, onAddSuccess }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const slug = e.target.slug.value.trim();
    if (!name) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }
    try {
      await axios.post('/api/categories', {
        name,
        slug: slug || undefined,
      });
      toast.success('Đã thêm danh mục thành công');
      if (onAddSuccess) onAddSuccess();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Thêm thất bại';
      toast.error(msg);
    }
  };

  return (
    <div className={cx('modalOverlay')} onClick={onClose}>
      <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={cx('modalHeader')} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <h3>
            <i className="fa-solid fa-folder-plus" style={{ marginRight: 8 }} />
            Thêm Danh Mục Mới
          </h3>
          <button type="button" className={cx('modalClose')} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={cx('modalBody')}>
          <div className={cx('formGroup')}>
            <label>Tên danh mục *</label>
            <input
              name="name"
              className={cx('input')}
              type="text"
              placeholder="Ví dụ: Tiểu thuyết, Truyện ngắn..."
              autoFocus
            />
          </div>

          <div className={cx('formGroup')}>
            <label>
              Slug (URL)
              <span style={{ fontSize: '1.1rem', color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                (tự động tạo nếu để trống)
              </span>
            </label>
            <input
              name="slug"
              className={cx('input')}
              type="text"
              placeholder="tu-dong-tao-tu-ten"
            />
          </div>

          <p style={{
            fontSize: '1.3rem',
            color: '#94a3b8',
            background: '#f8fafc',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.12)',
            margin: '4px 0 0',
          }}>
            <i className="fa-solid fa-info-circle" style={{ marginRight: 6, color: '#94a3b8' }} />
            Thứ tự tự xếp cuối danh sách. Có thể chỉnh lại bằng nút mũi tên trong bảng.
          </p>

          {/* Footer */}
          <div className={cx('modalFooter')}>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
              Trở lại
            </button>
            <button type="submit" className="btn btn--primary">
              <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
              Hoàn thành
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCategoryModal;
