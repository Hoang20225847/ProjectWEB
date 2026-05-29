import classNames from 'classnames/bind'
import styles from './Navbar.module.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';
import avt from'../../../assets/img/unnamed.jpg'
import  '../../../assets/css/main.css'
import { useContext,useState } from 'react';
import { AuthContext } from '../../../context/auth.context';
import { Link, useLocation } from 'react-router-dom';

const cx = classNames.bind(styles)
function Navbar() {
    const[filter,setFilter]= useState(0)
    const {auth}=useContext(AuthContext)

    return ( 
        
             <div className={`${cx('container')} grid__column-2`}>
                
                    <nav className={cx("Profile-nav")}>
                        <div className={cx('Profile-nav-current')} >
                            <img src={auth.user.avt} className={cx('nav-avt')}/>
                            <div className={cx('nav-info')}>
                                <span className={cx('nav-name')}>{auth.user.name}</span>
                                <div className={cx('change')}>
                                <i className="fa-solid fa-pencil"></i>
                                    <span className={cx('change-title')}>Sửa Hồ Sơ</span>
                                    </div>
                            </div>
                        </div>
                        <div className={cx('Nav-list')}>
                            <div className={(cx('Nav-list-title'))}>
                            <i className="fa-regular fa-user user-icon"></i>
                            <a href="/profile" className={cx('Nav-list-name')}>Tài Khoản Của Tôi</a>
                            </div>
                            <ul className={cx('Nav-list-item')}>
                                <Link to="/profile" onClick={(e)=>{

                                    setFilter(0);
                                }}  className={`${cx('nav-item')} ${filter == 0 ? 'input--primary' : ''}`}>Hồ Sơ</Link>
                                <Link to="/profile/address" onClick={(e)=>{

                                    setFilter(1);
                                }}  className={`${cx('nav-item')} ${filter == 1 ? 'input--primary' : ''}`}>Địa chỉ</Link>
                                <Link to="/profile/password" onClick={(e)=>{

                                    setFilter(2);
                                }}  className={`${cx('nav-item')} ${filter == 2 ? 'input--primary' : ''}`}>Đổi Mật Khẩu</Link>
                                
                            </ul>
                            <div className={(cx('Nav-list-title'))}>
                            <i className="fa-regular fa-clipboard user-icon"></i>
                            <Link onClick={(e)=>{

                                    setFilter(3);
                                }} to="/profile/purchase" className={`${cx('Nav-list-name')} ${filter == 3 ? 'input--primary' : ''}`}>Lịch Sử Đơn hàng</Link>
                            </div>
                            <div className={(cx('Nav-list-title'))}>
                            <i className="fa-solid fa-ticket user-icon"></i>
                            <Link to="/profile/vouchers" className={cx('Nav-list-name')}>Kho voucher</Link>
                            </div>
                            <div className={(cx('Nav-list-title'))}>
                            <i className="fa-regular fa-bell user-icon"></i>
                            <Link to="/notifications" className={cx('Nav-list-name')}>Thông Báo</Link>
                            </div>
                        </div>
                    </nav>
               
                
             </div>
        
    );
}

export default Navbar;