import { createContext,useState } from "react";
export const AuthContext=createContext({ 
    isAuthenticated:false,
    user:{id:"",
        email:"",
        name:"",
        avt:"",
        role:"",
        isMember:false,
        phone:"",
        membershipTierSlug: "",
        membershipTierName: "",
        loyaltyPoints: 0,
        totalSpentDong: 0,
        memberSince: null,
        membershipProgress: null,
    },
    loading:true
})
 export function AuthWrapper (props) {
  const [auth, setAuth] = useState({isAuthenticated:false,
    user:{
      id:"",
        email:"",
        name:"",
        avt:"",
        role:"",
        isMember:false,
        phone:"",
        membershipTierSlug: "",
        membershipTierName: "",
        loyaltyPoints: 0,
        totalSpentDong: 0,
        memberSince: null,
        membershipProgress: null,
    },
  loading:true
});
  // ...
  return (
    <AuthContext.Provider value={{auth,setAuth}}>
      {props.children}
    </AuthContext.Provider>
  ); 
}