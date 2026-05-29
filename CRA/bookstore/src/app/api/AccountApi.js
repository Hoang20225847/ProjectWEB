  import axios from'../../components/axios/axios.customize'
  export async function getAccount() {
    try {
      
      const data = await axios.get(`/admin/users`);
       
        data.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
        return data
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }
  export async function getMyAccount() {
    try {
      // axios instance đã unwrap response.data — không dùng .data thêm lần
      return await axios.get('/api/account/my');
    } catch (err) {
      console.error('Lỗi khi lấy tài khoản:', err);
    }
  }
  export async function getAddressDefault(email) {
    try {
      
      const data = await axios.get(`/api/address`);
      const found=data.find(address =>address.email === email && address.isDefault === true)
       
        return found
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
    
  }
  export async function removeAccount(id) {
  try {
    const response = await axios.delete(`/api/account/${id}`);
      console.log(response)

  } catch (err) {
    console.error('Lỗi .....:', err);
  }
}

