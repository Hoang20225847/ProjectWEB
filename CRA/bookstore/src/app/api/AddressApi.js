  import axios from'../../components/axios/axios.customize'
  export async function getAddress(email) {
    try {
      
      const data = await axios.get(`/api/address`);
      const found=data.filter(address =>address.email === email)
       console.log(found) 

        return found
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
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
  export async function setAddressDefault(id) {
    try {
      
        await axios.put(`/api/address/${id}`);
          console.log('Set Dia chi thanh cong')
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }
  export async function deleteAddress(id) {
    try {
      
        await axios.delete(`/api/address/${id}`);
          console.log('Xoa Dia chi thanh cong')
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }


