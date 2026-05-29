import axios from '../../components/axios/axios.customize';
import { useNavigate, Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../components/context/auth.context';
import { toast } from 'react-toastify';

function LoginAdminPage() {
  const { setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    const email = event.target.email.value;
    const password = event.target.password.value;
    const formData = {
      email,
      password,
    };

    try {
      const data = await axios.post('/admin/login', formData);

      localStorage.setItem('access_token', data.access_token);
      setAuth({
        isAuthenticated: true,
        user: {
          id: data?.user?.id ?? '',
          email: data?.user?.email ?? '',
          name: data?.user?.name ?? ' ',
          avt: data?.user?.avt ?? '',
          role: data?.user?.role ?? '',
        },
      });
      navigate('/admin');
      toast.success(data.message);
    } catch (error) {
      if (error.response?.data?.EM) {
        toast.error(error.response.data.EM);
      } else {
        toast.error('Lỗi không xác định');
      }
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card__mark" aria-hidden />
      <header className="auth-card__header">
        <h1 className="auth-card__title">Đăng nhập quản trị</h1>
        <p className="auth-card__subtitle">
          Chỉ dành cho nhân viên quản lý cửa hàng.
        </p>
      </header>
      <form onSubmit={handleLogin} id="form-1" method="post" className="form">
        <div className="form-group">
          <label htmlFor="email" className="form__title">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            className="form__input"
            placeholder="admin@example.com"
            autoComplete="username"
          />
          <span className="form__message" />
        </div>
        <div className="form-group">
          <label htmlFor="password" className="form__title">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            name="password"
            className="form__input"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <span className="form__message" />
        </div>
        <div className="auth-card__actions">
          <button type="submit" className="btn btn--primary auth-card__submit">
            Đăng nhập
          </button>
          <nav className="choices" aria-label="Liên kết khác">
            <Link to="/login" className="choice">
              Đăng nhập khách hàng
            </Link>
            <Link to="/?preview=1" className="choice">
              Xem trang chủ (chế độ xem trước)
            </Link>
          </nav>
        </div>
      </form>
    </div>
  );
}

export default LoginAdminPage;
