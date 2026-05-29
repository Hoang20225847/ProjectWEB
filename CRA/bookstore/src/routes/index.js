import Home from '../pages/Home';
import Filter from '../pages/Filter';
import Profile from '../pages/Profile';
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import LoginAdmin from '../pages/LoginAdmin';
import Regis from '../pages/Regis';
import Details from '../pages/Details';
import Cart from '../pages/Cart';
import Checkout from '../pages/Checkout';
import Purchase from '../pages/Purchase';
import ProfileVouchers from '../pages/ProfileVouchers';
import Address from '../pages/Address';
import ManageBook from '../pages/ManageBook';
import ManageUser from '../pages/ManageUser';
import ManageOrder from '../pages/ManageOrder';
import ManageCategory from '../pages/ManageCategory';
import ManageHeroImage from '../pages/ManageHeroImage';
import AdminSettings from '../pages/AdminSettings';
import Password  from '../pages/Password';
import Category from '../pages/Categori';
import Notifications from '../pages/Notifications';
import Statistics from '../pages/Statistics';
import UserStatistics from '../pages/UserStatistics';
import ManageInventory from '../pages/ManageInventory';
import ManageSeries from '../pages/ManageSeries';
import ManageAuthors from '../pages/ManageAuthors';
import ManageMembership from '../pages/ManageMembership';
import ManageVoucher from '../pages/ManageVoucher';
import ManageFlashSale from '../pages/ManageFlashSale';
import FlashSaleProducts from '../pages/FlashSaleProducts';
import ManagePublishers from '../pages/ManagePublishers';
import ManageSuppliers from '../pages/ManageSuppliers';
import ManageChatbot from '../pages/ManageChatbot';
import {ProfileLayout} from '../components/Layout'
import {DetailLayout} from '../components/Layout'
import {LoginLayout}           from '../components/Layout'
import {CartLayout} from '../components/Layout'
import {AdminLayout} from '../components/Layout'




//Public routes
const PublicRoutes = [
 { path:'/',component:Home},
 { path:'/search',component:Category},
 { path:'/filter',component:Filter},
 { path:'/flash-sale',component:FlashSaleProducts},
 { path:'/login',component:Login,Layout:LoginLayout},
 { path:'/forgot-password',component:ForgotPassword,Layout:LoginLayout},
 { path:'/reset-password',component:ResetPassword,Layout:LoginLayout},
 { path:'/regis',component:Regis,Layout:LoginLayout},
 { path:"/details/:slug",component:Details,Layout:DetailLayout},
  {path:"/admin/login",component:LoginAdmin,Layout:LoginLayout},
  

 



]
const PrivateRoutes = [
 { path:'/profile',component:Profile,Layout:ProfileLayout},
  { path:'/cart',component:Cart,Layout:CartLayout},
   { path:'/profile/address',component:Address,Layout:ProfileLayout},
{ path:'/profile/password',component:Password,Layout:ProfileLayout},
 { path:'/profile/purchase',component:Purchase,Layout:ProfileLayout},
 { path:'/profile/vouchers',component:ProfileVouchers,Layout:ProfileLayout},
  {path:'/checkout',component:Checkout,Layout:CartLayout},
  {path:'/notifications',component:Notifications,Layout:ProfileLayout},
  {path:'/statistics',component:UserStatistics,Layout:ProfileLayout}
]
const AdminRoutes=[
  {path:"/admin/Settings",component:AdminSettings,Layout:AdminLayout},
  {path:"/admin/Statistics",component:Statistics,Layout:AdminLayout},
  {path:"/admin/Inventory",component:ManageInventory,Layout:AdminLayout},
  {path:"/admin",component:ManageBook,Layout:AdminLayout},
  {path:"/admin/Users",component:ManageUser,Layout:AdminLayout},
   {path:"/admin/Orders",component:ManageOrder,Layout:AdminLayout},
   {path:"/admin/Categories",component:ManageCategory,Layout:AdminLayout},
  {path:"/admin/Series",component:ManageSeries,Layout:AdminLayout},
  {path:"/admin/Authors",component:ManageAuthors,Layout:AdminLayout},
  { path: '/admin/Membership', component: ManageMembership, Layout: AdminLayout },
  { path: '/admin/Vouchers', component: ManageVoucher, Layout: AdminLayout },
  { path: '/admin/FlashSale', component: ManageFlashSale, Layout: AdminLayout },
  { path: '/admin/Publishers', component: ManagePublishers, Layout: AdminLayout },
  { path: '/admin/Suppliers', component: ManageSuppliers, Layout: AdminLayout },
   {path:"/admin/HeroImages",component:ManageHeroImage,Layout:AdminLayout},
   {path:"/admin/Chatbot",component:ManageChatbot,Layout:AdminLayout}
]
export {PublicRoutes,PrivateRoutes,AdminRoutes}