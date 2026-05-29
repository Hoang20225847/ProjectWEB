import '../../assets/css/log.css';

function LoginLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-page__inner">{children}</div>
    </div>
  );
}

export default LoginLayout;
