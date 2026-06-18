import Header from "./Header";
import Sidebar from "./SideBar";
import Footer from "./Footer";
import HeroSlider from "../../HeroSlider";
import { useLocation } from "react-router-dom";

function DefaultLayout({children}) {
    const { pathname } = useLocation();
    const isHome = pathname === "/";
    const isCatalogBrowse = pathname === "/search" || pathname === "/flash-sale";
    /** Trang chủ + catalog browse: không hiện sidebar cột trái */
    const hideNavSidebar = pathname === "/" || isCatalogBrowse;
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
              }${isCatalogBrowse ? " app__content--search" : ""}`}
            >
            {!hideNavSidebar && <Sidebar />}
            
                {children}
            
        </div>
        </div>
        </div>
        </div>
        {!isCatalogBrowse && <Footer/>}
    </div> );
}

export default DefaultLayout;