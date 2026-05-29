  import axios from'../../components/axios/axios.customize'
  export async function getListOrder() {
    try {
      
      const data = await axios.get(`/api/listorder`);
       
        data.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
        return data
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }
  export async function getOrder(email) {
    try {
      
      const data = await axios.get(`/api/order?email=${email}`);
        return data;
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }
 export async function updateOrder(email,updateData) {
    try {
      
      const data = await axios.put(`/api/cart/update`,{email,item:updateData});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }
   export async function removeOrder(id) {
  try {
    const response = await axios.delete(`/api/orders/${id}`);
      console.log(response)

  } catch (err) {
    console.error('Lỗi .....:', err);
  }
  
}
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
  export async function reviewOrder(id){
    try{
  const response = await axios.put(`/api/order/${id}`)
  console.log(response)
 }catch(error){
  console.log(error);
  }
}
