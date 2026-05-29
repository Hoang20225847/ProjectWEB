import{ BrowserRouter as Router,Routes,Route} from 'react-router-dom'
import { Fragment, useContext, useEffect } from 'react';
import {PublicRoutes,PrivateRoutes,AdminRoutes} from './routes'
import axios from './components/axios/axios.customize'
import {DefaultLayout, LoginLayout} from './components/Layout'
import { AuthContext } from './components/context/auth.context';
import PrivateRoute from './routes/PrivateRoute'
import AdminRoute from './routes/AdminRoute'
import StorefrontGuard from './routes/StorefrontGuard'
import GuestRoute from './routes/GuestRoute'
//import Content from './Content'

function App() {
  const {setAuth} =useContext(AuthContext)
  useEffect(()=>{
    const fetchAccount = async ()=>{
      try{  
        const res=await axios.get('/api/account')
        console.log("Response từ /api/account:", res);
      if(res && res.user)
      { 
        setAuth({
          isAuthenticated:true,
          user:{
            id:res.user.id,
            email:res.user.email,
            name:res.user.name,
            avt:res.user.avt,
            role:res.user.role,
            isMember:res.user.isMember || false,
            phone:res.user.phone || '',
            membershipTierSlug: res.user.membershipTierSlug || '',
            membershipTierName: res.user.membershipTierName || '',
            loyaltyPoints: res.user.loyaltyPoints ?? 0,
            totalSpentDong: res.user.totalSpentDong ?? 0,
            memberSince: res.user.memberSince || null,
            membershipProgress: res.user.membershipProgress ?? null,
          },
          loading:false
        })
      }
      else{
        setAuth({
          isAuthenticated:false,
          user:{
            id:"",
            email:"",
            name:" ",
            avt:"",
            role:""
          },
          loading:false
        })
      }}
      catch(error){
        console.error("Lỗi khi fetchAccount:", error.message);
        setAuth({
        isAuthenticated: false,
        user: {
          email: "",
          name: "",
          avt:"",
          role:"",
        },
        loading:false,
      });
      }
    }
    fetchAccount()
  },[setAuth])
  return (
    <Router>
      <div className="App">
        <Routes>
         {PublicRoutes.map((route,index) =>{
          let Layout=DefaultLayout
          if(route.Layout){
            Layout=route.Layout
          }
          else
          if(route.Layout===null){
            Layout=Fragment
            
          }
          const Page =route.component
          const isAuthPage = route.Layout === LoginLayout
          const inner = (
            <Layout>
              <Page/>
            </Layout>
          )
          let element
          if (isAuthPage) {
            // Trang đăng nhập / đăng ký / quên mật khẩu: nếu đã login thì đẩy về trang chủ.
            element = <GuestRoute>{inner}</GuestRoute>
          } else {
            // Trang storefront công khai: chặn admin xem như khách.
            element = <StorefrontGuard>{inner}</StorefrontGuard>
          }
          return (
            <Route
              key={index}
              path={route.path}
              element={element}
            />
          )
         })}
         {PrivateRoutes.map((route,index) =>{
          let Layout=DefaultLayout
          if(route.Layout){
            Layout=route.Layout
          }
          else
          if(route.Layout===null){
            Layout=Fragment
          }
          const Page =route.component
          return <Route key={index} path={route.path} element={<PrivateRoute><Layout><Page/></Layout></PrivateRoute>}/>
         })}
         {AdminRoutes.map((route,index) =>{
          let Layout=DefaultLayout
          if(route.Layout){
            Layout=route.Layout
          }
          else
          if(route.Layout===null){
            Layout=Fragment
          }
          const Page =route.component
          return <Route key={index} path={route.path} element={<AdminRoute><Layout><Page/></Layout></AdminRoute>}/>
         })}

        </Routes>
      </div>
    </Router>
    

    
  );
}

export default App;
