import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../components/context/auth.context';

/**
 * Chặn user đã đăng nhập truy cập vào các trang xác thực
 * (đăng nhập, đăng ký, quên mật khẩu, ...).
 * - Khách: hiển thị trang bình thường.
 * - User thường đã login: đẩy về trang chủ.
 * - Admin đã login: đẩy về trang quản trị.
 */
function GuestRoute({ children }) {
  const { auth } = useContext(AuthContext);

  if (auth.loading) {
    return children;
  }

  if (auth.isAuthenticated) {
    if (auth.user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

export default GuestRoute;
