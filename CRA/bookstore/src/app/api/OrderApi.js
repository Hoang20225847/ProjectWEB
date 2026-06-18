  import axios from'../../components/axios/axios.customize'

  /// <summary>
  /// Danh sách đơn hàng admin; sắp xếp mới nhất trước theo createdAt.
  /// </summary>
  export async function getListOrder() {
    try {
      const data = await axios.get(`/api/listorder`);
        data.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
        return data
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }

  /// <summary>
  /// Đơn hàng của một email khách hàng.
  /// </summary>
  export async function getOrder(email) {
    try {
      const data = await axios.get(`/api/order?email=${email}`);
        return data;
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }

  /// <summary>
  /// Cập nhật giỏ hàng (endpoint /api/cart/update — dùng chung với quản lý cart).
  /// </summary>
 export async function updateOrder(email,updateData) {
    try {
      const data = await axios.put(`/api/cart/update`,{email,item:updateData});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }

  /// <summary>
  /// Xóa đơn hàng theo id (admin).
  /// </summary>
   export async function removeOrder(id) {
  try {
    const response = await axios.delete(`/api/orders/${id}`);
      console.log(response)

  } catch (err) {
    console.error('Lỗi .....:', err);
  }
  
}

  /// <summary>
  /// Chuyển trạng thái đơn; action truyền qua query/body (VD: confirm, cancel, complete).
  /// </summary>
  export async function statusOrder(id, action){
 try{
  const query = action ? `?action=${encodeURIComponent(action)}` : '';
  const response = await axios.put(`/api/orders/${id}${query}`, action ? { action } : {})
  console.log(response)
  return response;
 }catch(error){
  console.log(error);
  throw error;
 }
  }

  /// <summary>
  /// Đánh dấu đơn đã được khách review.
  /// </summary>
  export async function reviewOrder(id){
    try{
  const response = await axios.put(`/api/order/${id}`)
  console.log(response)
 }catch(error){
  console.log(error);
  }
}
