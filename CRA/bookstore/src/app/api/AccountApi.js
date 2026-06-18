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

  export async function getAdminAccounts() {
    try {
      const data = await axios.get('/admin/admins');
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return data;
    } catch (err) {
      console.error('Lỗi khi lấy danh sách quản trị:', err);
      return [];
    }
  }

  export async function searchCustomerAccounts(key) {
    try {
      return await axios.get(`/admin/users/search?key=${encodeURIComponent(key)}`);
    } catch (err) {
      console.error('Lỗi tìm kiếm khách hàng:', err);
      return [];
    }
  }

  export async function searchAdminAccounts(key) {
    try {
      return await axios.get(`/admin/admins/search?key=${encodeURIComponent(key)}`);
    } catch (err) {
      console.error('Lỗi tìm kiếm quản trị:', err);
      return [];
    }
  }

  export async function createAdminAccount(payload) {
    try {
      const fd = new FormData();
      fd.append('name', payload.name);
      fd.append('email', payload.email);
      fd.append('password', payload.password);
      fd.append('confirmPassword', payload.confirmPassword);
      if (payload.avatarFile) {
        fd.append('avatar', payload.avatarFile);
      }
      const res = await axios.post('/admin/admins', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res?.account || res;
    } catch (err) {
      console.error('Lỗi tạo quản trị:', err);
      throw err;
    }
  }

  export async function updateAdminAccount(id, item) {
    try {
      return await axios.put(`/admin/admins/${id}`, { item });
    } catch (err) {
      console.error('Lỗi cập nhật quản trị:', err);
      throw err;
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
    throw err;
  }
}

export async function removeAdminAccount(id) {
  try {
    return await axios.delete(`/admin/admins/${id}`);
  } catch (err) {
    console.error('Lỗi xóa quản trị:', err);
    throw err;
  }
}

