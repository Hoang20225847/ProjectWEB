import Footer from '../DefaultLayout/Footer'
import Header from '../DefaultLayout/Header'
import Navbar from './Navbar'


function ProfileLayout({children}) {
    return ( <div>
        <Header/>
        <div className='account-wrapper'>
            <div className="grid ">
            <div className="account-inner">
                <Navbar/>
                <div className="Account-content grid__column-10">
                    {children}
                    </div>
            </div>
            </div>
        </div>
        <Footer/>
    </div> );
}

export default ProfileLayout;