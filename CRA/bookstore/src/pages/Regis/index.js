import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Validator from '../../components/function/Validator';
import { toast } from 'react-toastify';

function RegisterPage() {
  const handleRegis = async (data) => {
    if (data.password !== data.repassword) {
      toast.error('Mật khẩu và mật khẩu nhập lại không khớp!');
      return;
    }
    const formData = {
      name: data.name,
      email: data.email,
      password: data.password,
    };
    try {
      const response = await fetch('/regis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Đăng ký thành công!');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        const error = await response.json();
        console.error('Đăng ký thất bại:', error.message);
        toast.error(error?.message || 'Đăng ký thất bại');
      }
    } catch (error) {
      console.error('Có lỗi khi gửi yêu cầu:', error);
      toast.error('Không thể kết nối máy chủ');
    }
  };

  useEffect(() => {
    Validator({
      form: '#form-1',
      formGroupSelector: '.form-group',
      errorSelector: '.form__message',
      rules: [
        Validator.isRequired('#name'),
        Validator.isEmail('#Email'),
        Validator.MinLength('#password', 6),
        Validator.isRequired('#repassword'),
      ],
      onSubmit: handleRegis,
    });
  }, []);

  return (
    <div className="auth-card">
      <div className="auth-card__mark" aria-hidden />
      <header className="auth-card__header">
        <h1 className="auth-card__title">Đăng ký</h1>
        <p className="auth-card__subtitle">
          Tạo tài khoản mới để đặt hàng và nhận ưu đãi từ hiệu sách.
        </p>
      </header>
      <form id="form-1" className="form">
        <div className="form-group">
          <label htmlFor="name" className="form__title">
            Họ và tên
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="form__input"
            placeholder="Nguyễn Văn A"
            autoComplete="name"
          />
          <span className="form__message" />
        </div>
        <div className="form-group">
          <label htmlFor="Email" className="form__title">
            Email
          </label>
          <input
            id="Email"
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
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
          />
          <span className="form__message" />
        </div>
        <div className="form-group">
          <label htmlFor="repassword" className="form__title">
            Nhập lại mật khẩu
          </label>
          <input
            id="repassword"
            type="password"
            name="repassword"
            className="form__input"
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
          />
          <span className="form__message" />
        </div>
        <div className="auth-card__actions">
          <button type="submit" className="btn btn--primary auth-card__submit">
            Đăng ký
          </button>
          <nav className="choices" aria-label="Liên kết tài khoản">
            <Link to="/login" className="choice">
              Đã có tài khoản? Đăng nhập
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

export default RegisterPage;
