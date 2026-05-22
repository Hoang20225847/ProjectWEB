const Cart= require('../models/Carts')
const AccountUser= require('../models/AccountUsers')
const Book= require('../models/Books')
const { createNotificationHelper } = require('./NotificationController');
const { isWebOrderableListing, computeStockTier } = require('../utils/bookVisibility');
const { listPriceVndFromBookPrice } = require('../utils/moneyVnd');

function managedStockNumber(book) {
  if (!book || book.stock === undefined || book.stock === null) return null;
  const n = Number(book.stock);
  return Number.isFinite(n) ? n : null;
}

function listPriceVnd(raw) {
  return listPriceVndFromBookPrice(raw);
}

function discountedBookPriceVnd(book, { isMember = false } = {}) {
  const base = listPriceVnd(book?.price);
  if (book?.isMemberOnly && !isMember) return base;
  const discount = Number(book?.discount) || 0;
  return Math.max(0, Math.ceil(base * (1 - discount / 100)));
}

/**
 * @returns {{ removedFromCart: Array, newItems: Array, dirty: boolean }}
 */
async function sanitizeCartLines(cart) {
  const account = await AccountUser.findOne({ email: String(cart.email || '').toLowerCase().trim() })
    .select('isMember')
    .lean();
  const isMember = !!account?.isMember;
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
    const price = discountedBookPriceVnd(book, { isMember });
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
const bcrypt=require('bcrypt')
const saltRounds=10;
const jwt =require('jsonwebtoken')
class CartController{
    
   async create(req,res,next)
       {
              
           try{ // Lấy dữ liệu từ request body
            const { email,items } = req.body;
            console.log(req.body)
            
            // Validate input
            if (!email || !items || !items.bookId) {
                console.log('Missing required fields');
                return res.status(400).json({
                    message: "Thiếu thông tin bắt buộc"
                });
            }
        
                // Lấy thông tin sách để hiển thị trong notification
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
                const account = await AccountUser.findOne({ email: String(email || '').toLowerCase().trim() })
                    .select('isMember')
                    .lean();
                const unitPrice = discountedBookPriceVnd(book, { isMember: !!account?.isMember });
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
                    
                    // Tạo notification khi thêm vào giỏ hàng thành công (không blocking)
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
                    
                    // Tạo notification khi tạo giỏ hàng mới (không blocking)
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
    async removeItemCart(req,res,next){
        try{    console.log(req.body)
             const {email,id} = req.body; 
             
               const result = await Cart.findOneAndUpdate(
                { email },
                { $pull: { items: { bookId: id } } },
      { new: true } // trả về cart mới sau khi cập nhật
      
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