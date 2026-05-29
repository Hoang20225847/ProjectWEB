import axios from '../../components/axios/axios.customize';
import { useNavigate, Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../components/context/auth.context';
import { toast } from 'react-toastify';

function LoginPage() {
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
      const data = await axios.post('/login', formData);
      localStorage.setItem('access_token', data.access_token);
      const newAuth = {
        isAuthenticated: true,
        user: {
          id: data?.user?.id ?? '',
          email: data?.user?.email ?? '',
          name: data?.user?.name ?? '',
          avt: data?.user?.avt ?? '',
          role: data?.user?.role ?? '',
          isMember: data?.user?.isMember ?? false,
          phone: data?.user?.phone ?? '',
          membershipTierSlug: data?.user?.membershipTierSlug ?? '',
          membershipTierName: data?.user?.membershipTierName ?? '',
          loyaltyPoints: data?.user?.loyaltyPoints ?? 0,
          totalSpentDong: data?.user?.totalSpentDong ?? 0,
          memberSince: data?.user?.memberSince ?? null,
          membershipProgress: data?.user?.membershipProgress ?? null,
        },
      };

      setAuth(newAuth);
      navigate('/');
      toast.success('Đăng nhập thành công');
    } catch (error) {
      if (error.response?.data?.EM) {
        toast.error('Tài khoản hoặc mật khẩu sai ');
      } else {
        toast.error('Lỗi không xác định');
      }
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card__mark" aria-hidden />
      <header className="auth-card__header">
        <h1 className="auth-card__title">Đăng nhập</h1>
        <p className="auth-card__subtitle">
          Đăng nhập để tiếp tục mua sách và theo dõi đơn hàng của bạn.
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
            placeholder="you@example.com"
            autoComplete="email"
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
          <nav className="choices" aria-label="Liên kết tài khoản">
            <Link to="/regis" className="choice">
              Chưa có tài khoản? Đăng ký
            </Link>
            <Link to="/admin/login" className="choice">
              Đăng nhập quản trị
            </Link>
            <Link to="/forgot-password" className="choice">
              Quên mật khẩu?
            </Link>
            <Link to="/" className="choice">
              Về trang chủ
            </Link>
          </nav>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
