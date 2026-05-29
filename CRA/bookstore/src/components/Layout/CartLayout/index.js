import Footer from '../DefaultLayout/Footer'
import Header from '../DefaultLayout/Header'



function CartLayout({children}) {
    return ( <div>
        <Header/>
        <div className="wrapper">
            {children}
        </div>
        <Footer/>
    </div> );
}

export default CartLayout;