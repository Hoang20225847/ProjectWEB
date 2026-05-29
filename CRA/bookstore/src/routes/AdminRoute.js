import { useContext } from "react";
import { AuthContext } from "../components/context/auth.context";
import { Navigate } from 'react-router-dom';
function AdminRoute({children}) {
            const {auth,setAuth} =useContext(AuthContext)
             console.log("Auth status:", auth);
             let isAdmin=false;
             if(auth.user.role === 'admin' )
             {
                isAdmin=true;
             }
             else{
                isAdmin=false
             }
             console.log(isAdmin)
            if(!auth.isAuthenticated&&!auth.loading)
            {
                return (
                <Navigate to="/admin/login" replace />)
            }
            if(!isAdmin&&!auth.loading){
               setAuth({isAuthenticated:false,
                                    user:{
                                    email:"",
                                    name:"",
                                    role:""
                            }})
                            localStorage.clear("access_token")
                return (
                <Navigate to="/admin/login" replace />)
            }
           
            
    return children;
}

export default AdminRoute;