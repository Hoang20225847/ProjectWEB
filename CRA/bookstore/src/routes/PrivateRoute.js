import { useContext } from "react";
import { AuthContext } from "../components/context/auth.context";
import { Navigate } from 'react-router-dom';

function PrivateRoute({ children }) {
  const { auth } = useContext(AuthContext);

  if (!auth.isAuthenticated && !auth.loading) {
    return <Navigate to="/login" replace />;
  }

  if (auth.loading) {
    return children;
  }

  /** Trang cá nhân / giỏ / thanh toán dành cho khách — admin dùng trang quản trị */
  if (auth.user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default PrivateRoute;