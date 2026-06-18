const Cart= require('../models/Carts')
const AccountUser= require('../models/AccountUsers')
const Book= require('../models/Books')
const { createNotificationHelper } = require('./NotificationController');
const { isWebOrderableListing, computeStockTier } = require('../utils/bookVisibility');
const { listPriceVndFromBookPrice } = require('../utils/moneyVnd');
const { discountedBookPriceVnd } = require('../utils/bookSalePricing');
const { getActiveFlashSaleMap } = require('../services/flashSaleService');
const { resolveMemberTierDiscountPercent } = require('../services/membershipService');

function managedStockNumber(book) {
  if (!book || book.stock === undefined || book.stock === null) return null;
  const n = Number(book.stock);
  return Number.isFinite(n) ? n : null;
}

/// <summary>
/// Tải ngữ cảnh giá giỏ hàng: hội viên, % giảm hạng, flash sale đang chạy.
/// </summary>
async function getCartPricingContext(email) {
  const account = await AccountUser.findOne({ email: String(email || '').toLowerCase().trim() })
    .select('isMember totalSpentDong')
    .lean();
  const isMember = !!account?.isMember;
  const memberTierDiscountPercent = isMember ? await resolveMemberTierDiscountPercent(account) : 0;
  const flashMap = await getActiveFlashSaleMap();
  return { isMember, memberTierDiscountPercent, flashMap };
}

/// <summary>
/// Tính đơn giá bán (đồng) của một sách theo flash sale, giảm sách và giảm hạng hội viên.
/// </summary>
function unitPriceForBook(book, ctx) {
  const flashMeta = ctx.flashMap.get(String(book._id));
  return discountedBookPriceVnd(book, {
    isMember: ctx.isMember,
    memberTierDiscountPercent: ctx.memberTierDiscountPercent,
    flashDiscountPercent: flashMeta?.discountPercent || 0,
  });
}

/// <summary>
/// So sánh dòng checkout client với DB: giá, tồn kho, trạng thái bán;
/// trả về danh sách thay đổi và items đã chuẩn hóa để đặt hàng.
/// </summary>
async function validateCheckoutItems(email, items) {
  const ctx = await getCartPricingContext(email);
  const changes = [];
  const validatedItems = [];

  for (const line of items || []) {
    const rawBid = line?.bookId?._id || line?.bookId;
    if (!rawBid) {
      changes.push({ bookId: '', name: 'Sản phẩm', reason: 'notFound' });
      continue;
    }

    const book = await Book.findById(rawBid).lean();
    if (!book) {
      changes.push({ bookId: String(rawBid), name: 'Sản phẩm', reason: 'notFound' });
      continue;
    }

    if (!isWebOrderableListing(book)) {
      changes.push({ bookId: String(book._id), name: book.name, reason: 'notOrderable' });
      continue;
    }

    if (computeStockTier(book) === 'outOfStock') {
      changes.push({ bookId: String(book._id), name: book.name, reason: 'outOfStock' });
      continue;
    }

    const stockNum = managedStockNumber(book);
    const price = unitPriceForBook(book, ctx);
    const oldPrice = Number(line.price) || 0;
    const oldQty = Math.max(0, Number(line.quantity) || 0);
    let qty = oldQty > 0 ? oldQty : 1;

    if (stockNum !== null && qty > stockNum) {
      changes.push({
        bookId: String(book._id),
        name: book.name,
        reason: 'quantityClamped',
        previousQty: qty,
        newQty: stockNum,
      });
      qty = stockNum;
    }

    if (oldPrice !== price) {
      changes.push({
        bookId: String(book._id),
        name: book.name,
        reason: 'priceChanged',
        oldPrice,
        newPrice: price,
      });
    }

    validatedItems.push({
      bookId: book,
      quantity: qty,
      price,
      totalPrice: qty * price,
      selected: line.selected !== false,
    });
  }

  return {
    changes,
    validatedItems,
    hasChanges: changes.length > 0,
    canProceed: validatedItems.length > 0,
  };
}

/// <summary>
/// Đồng bộ từng dòng giỏ với DB: gỡ sách hết hàng/ngừng bán, chỉnh SL theo tồn, cập nhật giá.
/// </summary>
async function sanitizeCartLines(cart) {
  const ctx = await getCartPricingContext(cart.email);
  const removedFromCart = [];
  const newItems = [];
  let dirty = false;

  for (const line of cart.items) {
    const rawBid = line.bookId && line.bookId._id ? line.bookId._id : line.bookId;
    if (!rawBid) {
      removedFromCart.push({ bookId: '', name: 'Sản phẩm', reason: 'notFound' });
      dirty = true;
      continue;
    }
    let book =
      line.bookId && typeof line.bookId === 'object' && line.bookId._id && line.bookId.name != null
        ? line.bookId
        : null;
    if (!book) {
      book = await Book.findById(rawBid).lean();
    } else if (typeof book.toObject === 'function') {
      book = book.toObject();
    }

    if (!book) {
      removedFromCart.push({ bookId: String(rawBid), name: 'Sản phẩm', reason: 'notFound' });
      dirty = true;
      continue;
    }

    if (!isWebOrderableListing(book)) {
      removedFromCart.push({ bookId: String(book._id), name: book.name, reason: 'notOrderable' });
      dirty = true;
      continue;
    }

    if (computeStockTier(book) === 'outOfStock') {
      removedFromCart.push({ bookId: String(book._id), name: book.name, reason: 'outOfStock' });
      dirty = true;
      continue;
    }

    const stockNum = managedStockNumber(book);
    let qty = Math.max(0, Number(line.quantity) || 0);
    const price = unitPriceForBook(book, ctx);
    const oldPrice = Number(line.price) || 0;

    if (stockNum !== null && qty > stockNum) {
      removedFromCart.push({
        bookId: String(book._id),
        name: book.name,
        reason: 'quantityClamped',
        previousQty: qty,
        newQty: stockNum,
      });
      qty = stockNum;
      dirty = true;
    }

    if (oldPrice !== price || Number(line.totalPrice) !== qty * price) {
      dirty = true;
    }

    newItems.push({
      bookId: book._id,
      quantity: qty,
      price,
      totalPrice: qty * price,
      selected: line.selected !== false,
    });
  }

  if (newItems.length !== cart.items.length) dirty = true;

  return { removedFromCart, newItems, dirty };
}
class CartController{

   /// <summary>
   /// Thêm sách vào giỏ: kiểm tra tồn kho, tính giá hiện tại, gộp dòng trùng bookId.
   /// </summary>
   async create(req,res,next)
       {
           try{
            const { email,items } = req.body;

            if (!email || !items || !items.bookId) {
                console.log('Missing required fields');
                return res.status(400).json({
                    message: "Thiếu thông tin bắt buộc"
                });
            }
        
                let bookInfo = { name: 'sản phẩm', img: null };
                let book;
                try {
                    book = await Book.findById(items.bookId).lean();
                    if (!book) {
                        return res.status(400).json({ message: 'Không tìm thấy sách' });
                    }
                    if (!isWebOrderableListing(book)) {
                        return res.status(400).json({
                            message: 'Sách này không được bán trên web (chưa publish hoặc đã ngừng KD)',
                        });
                    }
                    if (computeStockTier(book) === 'outOfStock') {
                        return res.status(400).json({
                            message: 'Sách đã hết hàng, không thể thêm vào giỏ hàng.',
                        });
                    }
                    bookInfo = { name: book.name, img: book.img };
                } catch (e) {
                    console.log('Lỗi lấy thông tin sách:', e);
                    return res.status(400).json({ message: 'Không kiểm tra được sách' });
                }

                const addQty = Math.max(1, Number(items.quantity) || 1);
                const ctx = await getCartPricingContext(email);
                const unitPrice = unitPriceForBook(book, ctx);
                const existingCart = await Cart.findOne({ email });
                const stockNum = managedStockNumber(book);
                if (stockNum !== null) {
                    const existingItem = existingCart?.items?.find(
                        (it) => it.bookId.toString() === String(items.bookId),
                    );
                    const combined = existingItem ? Number(existingItem.quantity) + addQty : addQty;
                    if (combined > stockNum) {
                        return res.status(400).json({
                            message: existingItem
                                ? `Trong giỏ đã có ${existingItem.quantity} cuốn; tối đa còn ${stockNum} cuốn trong kho.`
                                : `Chỉ còn ${stockNum} cuốn trong kho.`,
                        });
                    }
                }

                if (existingCart) {
                    const existingItem = existingCart.items.find(
                        (item) => item.bookId.toString() === items.bookId,
                    );
                    if (existingItem) {
                        existingItem.quantity += addQty;
                        existingItem.price = unitPrice;
                        existingItem.totalPrice = existingItem.quantity * unitPrice;
                    }
                    else{
                        existingCart.items.push({
                            ...items,
                            quantity: addQty,
                            price: unitPrice,
                            totalPrice: addQty * unitPrice,
                        })
                    }
                    await existingCart.save()
                    
                    createNotificationHelper(
                        email,
                        'cart',
                        'Thêm vào giỏ hàng thành công',
                        `Bạn đã thêm "${bookInfo.name}" vào giỏ hàng.`,
                        '/cart',
                        null,
                        items.bookId,
                        bookInfo.img,
                        bookInfo.name,
                        { quantity: addQty, totalPrice: addQty * unitPrice }
                    ).catch(err => console.log('Lỗi tạo notification:', err));
                    
                    return  res.status(200).json({message:"Thêm vào giỏ hàng thành công"})
                }
                else{
                    const newCart=new Cart({
                     email,
                     items: {
                        ...items,
                        quantity: addQty,
                        price: unitPrice,
                        totalPrice: addQty * unitPrice,
                     },
                    })  
                    await newCart.save();
                    
                    createNotificationHelper(
                        email,
                        'cart',
                        'Thêm vào giỏ hàng thành công',
                        `Bạn đã thêm "${bookInfo.name}" vào giỏ hàng.`,
                        '/cart',
                        null,
                        items.bookId,
                        bookInfo.img,
                        bookInfo.name,
                        { quantity: addQty, totalPrice: addQty * unitPrice }
                    ).catch(err => console.log('Lỗi tạo notification:', err));
                    
                    return res.status(200).json({
                        message:"Them vao gio hang thanh cong"
                    })
                }}
                catch(error){
                    console.log('Lỗi khi thêm giỏ hàng:', error);
                    return res.status(400).json({
                        message:"Thêm giỏ hàng thất bại: " + (error.message || 'Lỗi không xác định')
                    })
                }
            
         
    }
   
   /// <summary>
   /// Lấy giỏ hàng và tự đồng bộ dòng qua sanitizeCartLines; trả removedFromCart cho client.
   /// </summary>
   async getCart(req,res,next){
        try{
             const { email } = req.query;
            const cart= await Cart.findOne({email}).populate({
              path: 'items.bookId',
              populate: { path: 'category' },
            })
                if(!cart || !cart.items || cart.items.length === 0){
                    return res.status(200).json({
                        email: email || null,
                        items: [],
                        removedFromCart: [],
                        EC:0,
                        EM:'Giỏ hàng rỗng'
                    })
                }

                const { removedFromCart, newItems, dirty } = await sanitizeCartLines(cart);
                if (dirty) {
                    cart.items = newItems;
                    await cart.save();
                    await cart.populate({
                        path: 'items.bookId',
                        populate: { path: 'category' },
                    });
                }

                return res.status(200).json({
                    email: cart.email,
                    items: cart.items,
                    removedFromCart,
                });
        }
        catch(error){
            console.log('Loi')
            res.status(400).json('Lỗi dữ liệu')
        }
   }
   async updateCart(req,res,next){
        try{
             const { email,item } = req.body;
               const existingCart = await Cart.findOne({ email });
               if (!existingCart) {
                   return res.status(400).json({ message: 'Không tìm thấy giỏ hàng' });
               }
               existingCart.items = item;
               const { removedFromCart, newItems } = await sanitizeCartLines(existingCart);
               existingCart.items = newItems;
                await existingCart.save();
                await existingCart.populate({
                    path: 'items.bookId',
                    populate: { path: 'category' },
                });
                return res.status(200).json({
                    message:'update thanh cong',
                    items: existingCart.items,
                    removedFromCart,
                })
        }
        catch(error){
            console.log('Loi')
            res.status(400).json('Lỗi dữ liệu')
        }
   }
   /// <summary>
   /// API validate trước checkout: gọi validateCheckoutItems, trả changes + validatedItems.
   /// </summary>
   async validateCheckout(req, res, next) {
        try {
            const { email, items } = req.body;
            if (!email || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ message: 'Thiếu thông tin đơn hàng' });
            }
            const result = await validateCheckoutItems(email, items);
            return res.status(200).json(result);
        } catch (error) {
            console.log('Lỗi validate checkout:', error);
            return res.status(400).json({ message: 'Không kiểm tra được đơn hàng' });
        }
   }

    async removeItemCart(req,res,next){
        try{    console.log(req.body)
             const {email,id} = req.body; 
             
               const result = await Cart.findOneAndUpdate(
                { email },
                { $pull: { items: { bookId: id } } },
      { new: true }
      
    );
    return res.status(200).json('thanh cong')
        }
        catch(error){
            console.log('Loi')
            res.status(400).json('Lỗi dữ liệu')
        }
   }


       }

module.exports= new CartController;