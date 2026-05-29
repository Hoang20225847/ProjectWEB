import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../components/context/auth.context';

/**
 * Admin đã đăng nhập không dùng storefront như khách.
 * Thêm ?preview=1 vào URL nếu cần xem trước giao diện cửa hàng.
 */
function StorefrontGuard({ children }) {
  const { auth } = useContext(AuthContext);
  const location = useLocation();
  const preview = new URLSearchParams(location.search).get('preview') === '1';

  if (auth.loading) {
    return children;
  }

  if (auth.isAuthenticated && auth.user?.role === 'admin' && !preview) {
    return <Navigate to="/admin" replace state={{ redirectedFrom: location.pathname }} />;
  }

  return children;
}

export default StorefrontGuard;
