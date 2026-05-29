import { AuthContext } from '../../components/context/auth.context';
import Header from '../Home'
import axios from '../../components/axios/axios.customize'
import { useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
function Password() {
 const {auth}=useContext(AuthContext)

  const handleSubmit = async(event) =>{
    event.preventDefault();
    const password=event.target.password.value;
    const newpassword=event.target.newpassword.value;
    const renewpassword=event.target.renewpassword.value;
    if(newpassword != renewpassword)
    {
      toast.error('Mật khẩu mới nhập không khớp')
      return;
    }
    console.log(auth.user.email)
    const formData ={
      email:auth.user.email,
      password,
      newpassword
    } 
    
    try{
      const data=await axios.post('/repassword',formData)
      toast.success(data)
         event.target.reset();
    }
    catch(error){
      toast.error(error.response?.data?.EM )
    }
  }
    return ( 
       <div className='Account-container' >
               <div className="Account-Title">
                 <span className="Account-Title-Name" >Đổi Mật Khẩu</span>
                 <span className="Account-Tittle-Description">Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu cho người khác</span>
               </div>
              <form onSubmit={handleSubmit} >
                 <div className="Profile-content">
                           <div className="Account-info">
                             <div className="Account-info-name">
                               <span className="Account-info-text">Mật Khẩu cũ</span>
                              <input type="password" name="password" className='repassword-input' placeholder='Mật Khẩu cũ' />
                             </div>
                             <div className="Account-info-name">
                               <span className="Account-info-text account-info-text__name">Mật Khẩu mới </span>
                               <input type="password" name="newpassword" className='repassword-input' placeholder='Mật Khẩu mới' />
                             </div>
                             <div className="Account-info-name">
                               <span className="Account-info-text">Nhập lại mật khẩu</span>
                               <div className="password-footer">
                                <input type="password" name="renewpassword" className='repassword-input' placeholder='Xác nhận mật khẩu' />
                                <button type="submit" className='btn btn-repassword'>Xác nhận</button>
                                </div>
                             </div>
                            
                            
                           </div>
                           
                         </div>
              </form>
              </div>
       
     );
}

export default Password;