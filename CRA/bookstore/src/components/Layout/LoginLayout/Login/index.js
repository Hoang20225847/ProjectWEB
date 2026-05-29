import   '../../../assets/css/log.css'
import '@fortawesome/fontawesome-free/css/all.min.css';
function Login() {
    return ( 
        <div className="main">
        
        <form id="form-1" action="" method="POST" className="form">
            <h3 className="form__heading"> Đăng Kí</h3>
            <div className="form-group">
                <span className="form__title">Name</span>
                <input id="name" name="name" type="text" className="form__input  " placeholder="Name user"/>
                <span className="form__message"> </span>
            </div>
            <div className="form-group">
                <span className="form__title">Email</span>
                <input id="Email" type="text" name="email" className="form__input" placeholder="Email"/>
                <span className="form__message"> </span>
            </div>
            <div className="form-group">
                <span className="form__title">Mật Khẩu</span>
                <input id="password" type="password" name="password" className="form__input" placeholder="Mật Khẩu"/>
                <span className="form__message"> </span>
            </div>
            <div className="form-group">
                <span className="form__title">Nhập lai mật khẩu</span>
                <input id="repassword" type="password" name="repassword" className="form__input" placeholder="Nhập lại mật khẩu"/>
                <span className="form__message"> </span>
            </div>
            <div className="form-group">
                <button className="btn btn-primary">Đăng kí</button>
                <a href="" className="choice">Bạn đã có tài khoản? </a>
            </div>

            </form>
             

        
    </div>)
}

export default Login;