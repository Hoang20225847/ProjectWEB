import {useState} from 'react'

import Header from "../DefaultLayout/Header";
import '@fortawesome/fontawesome-free/css/all.min.css';
import Footer from "../DefaultLayout/Footer";
import Review from '../../../pages/Details/Review'



function DetailLayout({children}) {
    

    return ( 
    <div>
        <Header/>
       <div>
         {children}
         
         </div>
      
        <Footer/>
    </div> );
}

export default DetailLayout;