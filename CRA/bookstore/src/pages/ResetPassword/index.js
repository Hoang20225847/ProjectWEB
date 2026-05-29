import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../components/axios/axios.customize';

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tokenFromUrl = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const hasToken = !!tokenFromUrl;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!tokenFromUrl.trim() || !newPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu không khớp');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post('/reset-password', {
        token: tokenFromUrl.trim(),
        newPassword,
      });
      toast.success(res?.message || 'Đặt lại mật khẩu thành công');
      navigate('/login');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể đặt lại mật khẩu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card__mark" aria-hidden />
      <header className="auth-card__header">
        <h1 className="auth-card__title">Đặt lại mật khẩu</h1>
        <p className="auth-card__subtitle">Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.</p>
      </header>

      {!hasToken ? (
        <div className="form">
          <div className="form-group">
            <p className="form__message" style={{ display: 'block' }}>
              Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại link mới.
            </p>
          </div>
          <div className="auth-card__actions">
            <nav className="choices" aria-label="Liên kết tài khoản">
              <Link to="/forgot-password" className="choice">Gửi lại link</Link>
              <Link to="/login" className="choice">Về đăng nhập</Link>
            </nav>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="reset-password" className="form__title">Mật khẩu mới</label>
          <input id="reset-password" type="password" className="form__input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="reset-confirm-password" className="form__title">Nhập lại mật khẩu mới</label>
          <input id="reset-confirm-password" type="password" className="form__input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        <div className="auth-card__actions">
          <button type="submit" disabled={submitting} className="btn btn--primary auth-card__submit">
            {submitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </button>
          <nav className="choices" aria-label="Liên kết tài khoản">
            <Link to="/forgot-password" className="choice">Gửi lại link</Link>
            <Link to="/login" className="choice">Về đăng nhập</Link>
          </nav>
        </div>
      </form>
      )}
    </div>
  );
}

export default ResetPasswordPage;
