import   '../../../assets/css/main.css'

import book from '../../../assets/img/book1.webp'
import qrcode from '../../../assets/img/qr_code.png'
import appstore from '../../../assets/img/app_store.png'
import googleplay from '../../../assets/img/google_play.png'
import avt from '../../../assets/img/unnamed.jpg'
import logo from '../../../assets/img/logo.png'
import cart from '../../../assets/img/shopping.png'
import '@fortawesome/fontawesome-free/css/all.min.css';
function Footer() {
    return (
      <footer className="footer">
      <div className="grid">
          <div className="grid__row">
             <div className="grid__column-2-4">
              <h3 className="footer__heading">Chăm sóc khách hàng</h3>
              <ul className="footer__list">
                  <li className="footer__list-item">
                      <a href="" className="footer__list-item-link">
                          Trung tâm trợ giúp
                      </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              BookStore Mail
                          </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              Hướng dẫn mua hàng
                          </a>
                      </li>
                  
              </ul>

             </div> 
             <div className="grid__column-2-4">
              <h3 className="footer__heading">Giới thiệu</h3>
              <ul className="footer__list">
                  <li className="footer__list-item">
                      <a href="" className="footer__list-item-link">
                          Giới thiệu
                      </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              Tuyển dụng
                          </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              Điều khoản
                          </a>
                      </li>
                  
              </ul>

             </div> 
             <div className="grid__column-2-4">
              <h3 className="footer__heading">Vào cửa hàng trên ứng dụng</h3>
              <div className="footer__download">
                  
                  <img src={qrcode} alt="QR code" className="footer__download-qr"/> 
                  <div className="footer__download-apps">
                      <a href="" className="">
                       <img src={appstore} alt="" className="footer__dowload-img"/>
                      
                      </a>
                      <a href="" className="">
                          
                         <img src={googleplay} alt="" className="footer__dowload-img"/>
                         </a>
                      

                  </div>
              </div>
             </div>
             <div className="grid__column-2-4">
              <h3 className="footer__heading">Danh mục</h3>
              <ul className="footer__list">
                  <li className="footer__list-item">
                      <a href="" className="footer__list-item-link">
                          
                          Sách chính trị
                      </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                             Sách trinh thám
                          </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              Sách văn học
                          </a>
                      </li>
                  
              </ul>
             </div>
             <div className="grid__column-2-4">
              <h3 className="footer__heading">Theo dõi</h3>
              <ul className="footer__list">
                  <li className="footer__list-item">
                      <a href="" className="footer__list-item-link">
                          <i className="footer__list-item-icon  fa-brands fa-square-facebook"></i>
                          Facebook
                      </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              <i className="footer__list-item-icon fa-brands fa-square-instagram"></i>
                              Instagram
                          </a>
                      </li>
                      <li className="footer__list-item">

                          <a href="" className="footer__list-item-link">
                              <i className="footer__list-item-icon fa-brands fa-telegram"></i>
                              Telegram
                          </a>
                      </li>
                  
              </ul>
             </div>   
          </div>
      </div>
</footer>
      );
}

export default Footer;
