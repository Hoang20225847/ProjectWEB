import Header from "./Header";
import Sidebar from "./SideBar";
import Footer from "./Footer";
import Chatbot from "../../Chatbot";
import HeroSlider from "../../HeroSlider";
import { useLocation } from "react-router-dom";

function DefaultLayout({children}) {
    const { pathname } = useLocation();
    const isHome = pathname === "/";
    /** Trang chủ + /search: không hiện sidebar cột trái (tránh trùng danh mục) */
    const hideNavSidebar = pathname === "/" || pathname === "/search";
    return ( <div>
        <Header/>
        {isHome && (
            <div className="hero-slider-wrapper">
                <HeroSlider />
            </div>
        )}
        <div className="Container">
        <div className={`app__container${isHome ? " app__container--home" : ""}`}>
        <div className="grid">

            <div
              className={`grid__row app__content${isHome ? " app__content--home" : ""}${
                hideNavSidebar && !isHome ? " app__content--full" : ""
              }`}
            >
            {!hideNavSidebar && <Sidebar />}
            
                {children}
            
        </div>
        </div>
        </div>
        </div>
        <Footer/>
        <Chatbot />
    </div> );
}

export default DefaultLayout;