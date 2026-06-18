  import axios from'../../components/axios/axios.customize'

  /// <summary>
  /// Lấy giỏ hàng; server có thể trả removedFromCart khi đồng bộ tồn kho/giá.
  /// </summary>
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

  /// <summary>
  /// Ghi đè toàn bộ items giỏ hàng (dùng sau checkout hoặc chỉnh SL hàng loạt).
  /// </summary>
 export async function updateCart(email,updateData) {
    try {
      const data = await axios.put(`/api/cart/update`,{email,item:updateData});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }

  /// <summary>
  /// Xóa một dòng khỏi giỏ theo bookId.
  /// </summary>
  export async function removeItemCart(email,id) {
    try {
      const data = await axios.put(`/api/cart`,{email,id});
        console.log(data);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      throw err
    }
  }

  /// <summary>
  /// Kiểm tra đơn trước khi đặt hàng; trả hasChanges, canProceed, changes[], validatedItems[].
  /// </summary>
  export async function validateCheckoutItems(email, items) {
    try {
      const data = await axios.post('/api/cart/validate-checkout', { email, items });
      return {
        hasChanges: !!data?.hasChanges,
        canProceed: !!data?.canProceed,
        changes: Array.isArray(data?.changes) ? data.changes : [],
        validatedItems: Array.isArray(data?.validatedItems) ? data.validatedItems : [],
      };
    } catch (err) {
      console.error('Lỗi validate checkout:', err);
      throw err;
    }
  }

  /// <summary>
  /// Hiển thị toast khi getCart trả removedFromCart (hết hàng, chỉnh SL, ngừng bán).
  /// </summary>
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
