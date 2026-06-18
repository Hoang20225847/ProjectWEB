import styles from '../Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import { useEffect, useRef, useState } from 'react';
import { createAdminAccount } from '../../app/api/AccountApi.js';
import {
  ACCEPT_AVATAR_IMAGE,
  createEmptyAdminFormErrors,
  mapCreateAdminServerError,
  validateAdminForm,
  validateAvatarFile,
} from '../../utils/validateAdminForm.js';

const cx = classNames.bind(styles);

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className={cx('fieldError')} role="alert">
      <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
      {message}
    </p>
  );
}

function AddAdminModal({ onClose, onAddSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [errors, setErrors] = useState(createEmptyAdminFormErrors);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const avatarInputRef = useRef(null);
  const previewUrlRef = useRef('');

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      return { ...prev, [field]: '', form: '' };
    });
    if (successMessage) setSuccessMessage('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const avatarError = validateAvatarFile(file);
    if (avatarError) {
      setAvatarFile(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setAvatarPreview('');
      setErrors((prev) => ({ ...prev, avatar: avatarError, form: '' }));
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarFile(file);
    setAvatarPreview(url);
    clearFieldError('avatar');
  };

  const handleRemoveAvatar = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setAvatarFile(null);
    setAvatarPreview('');
    clearFieldError('avatar');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');

    const { errors: nextErrors, isValid } = validateAdminForm({
      ...formData,
      avatarFile,
    });

    if (!isValid) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors(createEmptyAdminFormErrors());

    try {
      await createAdminAccount({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        avatarFile,
      });
      setSuccessMessage('Tạo quản trị viên thành công.');
      if (onAddSuccess) onAddSuccess();
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setErrors(mapCreateAdminServerError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cx('modalOverlay')} role="presentation">
      <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
        <div className={cx('modalHeader')} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <h3>
            <i className="fa-solid fa-user-shield" style={{ marginRight: 8 }} />
            Tạo Quản Trị Viên
          </h3>
          <button type="button" className={cx('modalClose')} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={cx('modalBody')} noValidate>
      

          {errors.form ? (
            <div className={cx('formAlert', 'formAlertError')} role="alert">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>{errors.form}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className={cx('formAlert', 'formAlertSuccess')} role="status">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <div className={cx('formGroup')}>
            <label htmlFor="admin-name">
              Tên quản trị <span className={cx('requiredMark')}>*</span>
            </label>
            <input
              id="admin-name"
              name="name"
              className={cx('input', { inputHasError: !!errors.name })}
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên hiển thị..."
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'admin-name-error' : undefined}
            />
            <FieldError id="admin-name-error" message={errors.name} />
          </div>

          <div className={cx('formGroup')}>
            <label htmlFor="admin-email">
              Email <span className={cx('requiredMark')}>*</span>
            </label>
            <input
              id="admin-email"
              name="email"
              className={cx('input', { inputHasError: !!errors.email })}
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'admin-email-error' : undefined}
            />
            <FieldError id="admin-email-error" message={errors.email} />
          </div>

          <div className={cx('formGroup')}>
            <label htmlFor="admin-password">
              Mật khẩu <span className={cx('requiredMark')}>*</span>
            </label>
            <input
              id="admin-password"
              name="password"
              className={cx('input', { inputHasError: !!errors.password })}
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'admin-password-error' : undefined}
            />
            <FieldError id="admin-password-error" message={errors.password} />
          </div>

          <div className={cx('formGroup')}>
            <label htmlFor="admin-confirm-password">
              Nhập lại mật khẩu <span className={cx('requiredMark')}>*</span>
            </label>
            <input
              id="admin-confirm-password"
              name="confirmPassword"
              className={cx('input', { inputHasError: !!errors.confirmPassword })}
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'admin-confirm-password-error' : undefined}
            />
            <FieldError id="admin-confirm-password-error" message={errors.confirmPassword} />
          </div>

          <div className={cx('formGroup')}>
            <label>Ảnh đại diện</label>
            <div className={cx('avatarPicker', { avatarPickerError: !!errors.avatar })}>
              <div className={cx('avatarPickerPreview')}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Xem trước avatar" />
                ) : (
                  <div className={cx('avatarPickerPlaceholder')}>
                    <i className="fa-solid fa-user" />
                  </div>
                )}
              </div>
              <div className={cx('avatarPickerActions')}>
                <button type="button" className={cx('avatarPickerBtn')} onClick={handleAvatarPick}>
                  <i className="fa-solid fa-image" style={{ marginRight: 6 }} />
                  Chọn ảnh
                </button>
                {avatarPreview ? (
                  <button type="button" className={cx('avatarPickerBtn', 'avatarPickerBtnGhost')} onClick={handleRemoveAvatar}>
                    Xóa ảnh
                  </button>
                ) : null}
                <p className={cx('avatarPickerHint')}>JPEG, PNG — tối đa 1MB (tùy chọn)</p>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept={ACCEPT_AVATAR_IMAGE}
                className={cx('avatarPickerInput')}
                onChange={handleAvatarChange}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <FieldError id="admin-avatar-error" message={errors.avatar} />
          </div>

          <div className={cx('modalFooter')}>
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-plus'}`} style={{ marginRight: 6 }} />
              {submitting ? 'Đang tạo...' : 'Tạo quản trị viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddAdminModal;
