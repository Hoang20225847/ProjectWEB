import styles from '../Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import { useState } from 'react';
import { toast } from 'react-toastify';
const cx = classNames.bind(styles);

function EditAccountModal({ account, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: account.name,
    password: '',
    avt: account.avt || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên');
      return;
    }
    const updatedAccount = { ...account, ...formData };
    if (onSave) onSave(updatedAccount);
    onClose();
  };

  return (
    <div className={cx('modalOverlay')} onClick={onClose}>
      <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={cx('modalHeader')} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
          <h3>
            <i className="fa-solid fa-user-pen" style={{ marginRight: 8 }} />
            Sửa Tài Khoản
          </h3>
          <button type="button" className={cx('modalClose')} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={cx('modalBody')}>
          <div className={cx('formGroup')}>
            <label>Tên người dùng</label>
            <input
              name="name"
              className={cx('input')}
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên người dùng..."
              autoFocus
            />
          </div>

          <div className={cx('formGroup')}>
            <label>
              Mật khẩu mới
              <span style={{ fontSize: '1.1rem', color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                (để trống nếu không đổi)
              </span>
            </label>
            <input
              name="password"
              className={cx('input')}
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu mới..."
            />
          </div>

          <div className={cx('formGroup')}>
            <label>URL Avatar</label>
            <input
              name="avt"
              className={cx('input')}
              type="url"
              value={formData.avt}
              onChange={handleChange}
              placeholder="https://example.com/avatar.jpg"
            />
            {formData.avt && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={formData.avt}
                  alt="Avatar preview"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #e2e8f0',
                  }}
                  onError={(e) => (e.target.style.display = 'none')}
                />
                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Xem trước avatar</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cx('modalFooter')}>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
              Trở lại
            </button>
            <button type="submit" className="btn btn--primary">
              <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAccountModal;
