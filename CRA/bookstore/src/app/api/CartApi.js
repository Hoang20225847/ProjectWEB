  import axios from'../../components/axios/axios.customize'

  /** @returns {{ items: any[], removedFromCart: any[] }} */
  export async function getCart(email) {
    try {
      const data = await axios.get(`/api/cart?email=${email}`);
      if (!data || data.EC === 0) {
        return { items: [], removedFromCart: [] };
      }
      return {
        items: Array.isArray(data.items) ? data.items : [],
        removedFromCart: Array.isArray(data.removedFromCart) ? data.removedFromCart : [],
      };
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      return { items: [], removedFromCart: [] };
    }
  }
 export async function updateCart(email,updateData) {
    try {
      
      const data = await axios.put(`/api/cart/update`,{email,item:updateData});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }
  export async function removeItemCart(email,id) {
    try {
      
      const data = await axios.put(`/api/cart`,{email,id});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }

  /** Gọi sau getCart khi server trả `removedFromCart` (hết hàng / gỡ dòng / chỉnh SL). */
  export function notifyCartRemovedFromCart(removedFromCart, toast) {
    if (!removedFromCart?.length || !toast) return;
    const gone = removedFromCart.filter((r) =>
      ['outOfStock', 'notOrderable', 'notFound'].includes(r.reason),
    );
    const clamped = removedFromCart.filter((r) => r.reason === 'quantityClamped');
    if (gone.length) {
      toast.warning(
        `Đã gỡ khỏi giỏ hàng (hết hàng hoặc không còn bán): ${gone.map((g) => g.name).join(', ')}`,
      );
    }
    if (clamped.length) {
      toast.info(
        `Đã chỉnh số lượng theo tồn kho: ${clamped.map((c) => `${c.name} → ${c.newQty}`).join(', ')}`,
      );
    }
  }

