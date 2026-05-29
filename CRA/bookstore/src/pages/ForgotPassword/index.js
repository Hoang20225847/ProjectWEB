import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../components/axios/axios.customize';
import './ForgotPassword.css';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập email');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post('/forgot-password', { email: email.trim() });
      toast.success(res?.message || 'Đã gửi link đặt lại mật khẩu');
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      const apiCode = error?.response?.data?.code;

      if (apiCode === 'ACCOUNT_NOT_FOUND') {
        setNotFoundMessage(apiMessage || 'Tài khoản này không tồn tại.');
        setShowNotFoundModal(true);
      } else {
        toast.error(apiMessage || 'Không gửi được link đặt lại mật khẩu');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card__mark" aria-hidden />
      <header className="auth-card__header">
        <h1 className="auth-card__title">Quên mật khẩu</h1>
        <p className="auth-card__subtitle">Nhập email để nhận link đặt lại mật khẩu.</p>
      </header>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="forgot-email" className="form__title">Email</label>
          <input
            id="forgot-email"
            type="email"
            className="form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="auth-card__actions">
          <button type="submit" disabled={submitting} className="btn btn--primary auth-card__submit">
            {submitting ? 'Đang gửi...' : 'Gửi link đặt lại'}
          </button>
          <nav className="choices" aria-label="Liên kết tài khoản">
            <Link to="/login" className="choice">Quay lại đăng nhập</Link>
          </nav>
        </div>
      </form>

      {showNotFoundModal && (
        <div
          className="forgot-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-not-found-title"
        >
          <div className="forgot-modal-card">
            <div className="forgot-modal-badge">Thông báo</div>
            <h3 id="account-not-found-title" className="forgot-modal-title">
              Tài khoản chưa đăng ký
            </h3>
            <p className="forgot-modal-message">
              {notFoundMessage}
            </p>
            <p className="forgot-modal-hint">
              Bạn có muốn chuyển sang trang đăng ký tài khoản mới không?
            </p>
            <div className="forgot-modal-actions">
              <button
                type="button"
                className="btn btn--secondary forgot-modal-btn"
                onClick={() => setShowNotFoundModal(false)}
              >
                Để sau
              </button>
              <button
                type="button"
                className="btn btn--primary forgot-modal-btn forgot-modal-btn--primary"
                onClick={() => navigate('/regis')}
              >
                Đăng ký ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ForgotPasswordPage;
