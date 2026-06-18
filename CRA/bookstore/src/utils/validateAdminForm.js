export const ACCEPT_AVATAR_IMAGE = 'image/jpeg,image/png';
export const MAX_AVATAR_BYTES = 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmptyAdminFormErrors() {
  return {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    avatar: '',
    form: '',
  };
}

export function validateAvatarFile(file) {
  if (!file) return null;
  const allowed = ACCEPT_AVATAR_IMAGE.split(',');
  if (!allowed.includes(file.type)) {
    return 'Chỉ chấp nhận ảnh JPEG hoặc PNG';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Dung lượng ảnh tối đa 1MB';
  }
  return null;
}

/** @returns {{ errors: ReturnType<typeof createEmptyAdminFormErrors>, isValid: boolean }} */
export function validateAdminForm({ name, email, password, confirmPassword, avatarFile }) {
  const errors = createEmptyAdminFormErrors();
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPassword = String(password || '');
  const trimmedConfirm = String(confirmPassword || '');

  if (!trimmedName) {
    errors.name = 'Vui lòng nhập tên quản trị viên';
  } else if (trimmedName.length < 2) {
    errors.name = 'Tên phải có ít nhất 2 ký tự';
  } else if (trimmedName.length > 255) {
    errors.name = 'Tên không được vượt quá 255 ký tự';
  }

  if (!trimmedEmail) {
    errors.email = 'Vui lòng nhập email';
  } else if (!EMAIL_RE.test(trimmedEmail)) {
    errors.email = 'Email không hợp lệ';
  }

  if (!trimmedPassword) {
    errors.password = 'Vui lòng nhập mật khẩu';
  } else if (trimmedPassword.length < 6) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
  }

  if (!trimmedConfirm) {
    errors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
  } else if (trimmedPassword !== trimmedConfirm) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  }

  const avatarError = validateAvatarFile(avatarFile);
  if (avatarError) errors.avatar = avatarError;

  const isValid = !errors.name && !errors.email && !errors.password && !errors.confirmPassword && !errors.avatar;
  return { errors, isValid };
}

export function mapCreateAdminServerError(err) {
  const errors = createEmptyAdminFormErrors();
  const data = err?.response?.data;
  const message = data?.message || data?.EM || err?.message || 'Tạo quản trị viên thất bại';
  const field = data?.field;

  if (field && Object.prototype.hasOwnProperty.call(errors, field)) {
    errors[field] = message;
    return errors;
  }

  const lower = String(message).toLowerCase();
  if (lower.includes('email')) {
    errors.email = message;
    return errors;
  }
  if (lower.includes('mật khẩu') || lower.includes('password')) {
    if (lower.includes('xác nhận') || lower.includes('khớp')) {
      errors.confirmPassword = message;
    } else {
      errors.password = message;
    }
    return errors;
  }

  errors.form = message;
  return errors;
}
