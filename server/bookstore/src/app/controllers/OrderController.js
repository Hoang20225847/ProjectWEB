const Order = require('../models/Orders');

function formatVndMessageDong(dong) {
  const n = Math.round(Number(dong) || 0);
  return `${n.toLocaleString('vi-VN')}đ`;
}
const { createNotificationHelper, notifyAllAdmins } = require('./NotificationController');
const mongoose = require('mongoose');
const { afterOrderItemsSold } = require('../services/orderBookUpdate');
const Book = require('../models/Books');
const AccountUser = require('../models/AccountUsers');
const { isWebOrderableListing } = require('../utils/bookVisibility');
const { getActiveFlashSaleMap } = require('../services/flashSaleService');
const { createVietnameseRegex } = require('../../utils/vietnameseSearch');
const {
  quoteCheckout,
  incrementVoucherUse,
  decrementVoucherUse,
  consumeUserVoucher,
  releaseUserVoucher,
  consumeLoyaltyPoints,
  releaseLoyaltyPoints,
  onOrderCompleted,
} = require('../services/membershipService');

/**
 * Populate sách trong từng dòng đơn — client (Purchase, ManageOrder) cần bookId.name / img.
 * Lưu ý: kể cả khi sách đã bị soft-delete (status=archived, deletedAt!=null) hoặc xóa cứng,
 * frontend nên fallback sang `bookSnapshot` để vẫn hiển thị được lịch sử đơn.
 */
const ORDER_ITEMS_BOOK_POPULATE = {
  path: 'items.bookId',
  select: 'name img slug status deletedAt',
};

function listPriceVnd(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const n = Number.parseInt(digits || '0', 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1000 ? n : n * 1000;
}

function discountedBookPriceVnd(book, { isMember = false, flashDiscountPercent = 0 } = {}) {
  const base = listPriceVnd(book?.price);
  if (book?.isMemberOnly && !isMember) return base;
  const baseDisc = Number(book?.discount) || 0;
  const flashDisc = Math.max(0, Number(flashDiscountPercent) || 0);
  const discount = flashDisc > 0 ? flashDisc : baseDisc;
  return Math.max(0, Math.ceil(base * (1 - discount / 100)));
}

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function repairOrderBookRefs(options = {}) {
  const { dryRun = false } = options;
  const orders = await Order.find({}, { items: 1 }).lean();
  const allBooks = await Book.find({}, { _id: 1, name: 1 }).lean();
  const bookById = new Map(allBooks.map((b) => [String(b._id), String(b._id)]));

  // Match by name only when name is unique to avoid mapping wrong book.
  const uniqueBookIdByName = new Map();
  const dupName = new Set();
  allBooks.forEach((b) => {
    const key = normalizeText(b.name);
    if (!key) return;
    const id = String(b._id);
    if (uniqueBookIdByName.has(key)) {
      dupName.add(key);
      uniqueBookIdByName.delete(key);
      return;
    }
    if (!dupName.has(key)) uniqueBookIdByName.set(key, id);
  });

  const updates = [];
  let totalItems = 0;
  let repairedItems = 0;
  let unresolvedItems = 0;

  for (const order of orders) {
    const nextItems = [];
    let changed = false;
    for (const item of order.items || []) {
      totalItems += 1;
      const raw = item?.bookId;
      let resolvedBookId = null;

      if (raw instanceof mongoose.Types.ObjectId) {
        const id = String(raw);
        resolvedBookId = bookById.has(id) ? id : null;
      } else if (typeof raw === 'string') {
        const id = raw.trim();
        if (mongoose.Types.ObjectId.isValid(id) && bookById.has(id)) {
          resolvedBookId = id;
        }
      } else if (raw && typeof raw === 'object') {
        const rawId = raw._id ? String(raw._id) : '';
        if (rawId && mongoose.Types.ObjectId.isValid(rawId) && bookById.has(rawId)) {
          resolvedBookId = rawId;
        } else {
          const byName = uniqueBookIdByName.get(normalizeText(raw.name || ''));
          if (byName) resolvedBookId = byName;
        }
      }

      if (!resolvedBookId) {
        unresolvedItems += 1;
        nextItems.push(item);
        continue;
      }

      const currentId =
        raw instanceof mongoose.Types.ObjectId
          ? String(raw)
          : typeof raw === 'string'
          ? raw.trim()
          : raw && typeof raw === 'object' && raw._id
          ? String(raw._id)
          : '';
      if (currentId !== resolvedBookId || !(raw instanceof mongoose.Types.ObjectId)) {
        changed = true;
        repairedItems += 1;
      }
      nextItems.push({
        ...item,
        bookId: new mongoose.Types.ObjectId(resolvedBookId),
      });
    }

    if (changed) {
      updates.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { items: nextItems } },
        },
      });
    }
  }

  if (!dryRun && updates.length > 0) {
    await Order.collection.bulkWrite(updates, { ordered: false });
  }

  return {
    dryRun,
    totalOrders: orders.length,
    totalItems,
    updatedOrders: updates.length,
    repairedItems,
    unresolvedItems,
  };
}

async function releaseVoucherIfNeeded(orderDoc) {
  if (!orderDoc?.voucherCode || !orderDoc?.email) return;
  const released = await releaseUserVoucher(orderDoc.email, orderDoc.voucherCode, orderDoc._id);
  if (released) {
    await decrementVoucherUse(orderDoc.voucherCode);
  }
  await Order.updateOne({ _id: orderDoc._id }, { $set: { voucherConsumed: false } });
}

async function releasePointsIfNeeded(orderDoc) {
  const points = Math.max(0, Math.round(Number(orderDoc?.pointsRedeemed) || 0));
  if (!orderDoc?.email || points <= 0 || !orderDoc?.pointsConsumed) return;
  const released = await releaseLoyaltyPoints(orderDoc.email, points, orderDoc._id);
  if (released) {
    await Order.updateOne({ _id: orderDoc._id }, { $set: { pointsConsumed: false } });
  }
}
class OrderController{
    
   async create(req,res,next)
       {
              
              
           try{ // Lấy dữ liệu từ request body
            const { email, items, address, salesChannel, voucherCode, redeemPoints } = req.body;
            console.log(req.body)
                const account = await AccountUser.findOne({ email: String(email || '').toLowerCase().trim() })
                  .select('isMember')
                  .lean();
                const isMember = !!account?.isMember;
                const flashMap = await getActiveFlashSaleMap();
                let enrichedItems = items;
                if (Array.isArray(items)) {
                  enrichedItems = [];
                  for (const it of items) {
                    const rawId = it?.bookId?._id || it?.bookId;
                    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) continue;
                    const b = await Book.findById(rawId).select('status deletedAt name author img stock costPrice price discount isMemberOnly').lean();
                    if (!b) {
                      return res.status(400).json({ message: 'Có sách không tồn tại trong đơn' });
                    }
                    if (b.deletedAt) {
                      return res.status(400).json({
                        message: `Sách "${b.name || rawId}" đã ngừng kinh doanh.`,
                      });
                    }
                    if (!isWebOrderableListing(b)) {
                      return res.status(400).json({
                        message: `Sách "${b.name || rawId}" không được bán trên web (chưa publish hoặc đã ngừng KD)`,
                      });
                    }
                    const qty = Number(it.quantity) || 0;
                    if (typeof b.stock === 'number' && !Number.isNaN(b.stock) && b.stock < qty) {
                      return res.status(400).json({
                        message: `Tồn kho không đủ cho "${b.name || 'sách'}" (còn ${b.stock}, cần ${qty})`,
                      });
                    }
                    const flashMeta = flashMap.get(String(rawId));
                    const flashDiscountPercent = flashMeta ? flashMeta.discountPercent : 0;
                    const unitPrice = discountedBookPriceVnd(b, { isMember, flashDiscountPercent });
                    enrichedItems.push({
                      bookId: new mongoose.Types.ObjectId(String(rawId)),
                      quantity: Math.floor(Number(it.quantity)) || 0,
                      price: unitPrice,
                      totalPrice: (Math.floor(Number(it.quantity)) || 0) * unitPrice,
                      unitImportCost: Number(b.costPrice) || 0,
                      bookSnapshot: {
                        name: String(b.name || '').slice(0, 260),
                        img: String(b.img || ''),
                        author: String(b.author || '').slice(0, 200),
                        listPriceAtOrder: listPriceVnd(b.price),
                      },
                    });
                  }
                  if (enrichedItems.length !== items.length) {
                    return res.status(400).json({ message: 'Đơn hàng có mục không hợp lệ (bookId)' });
                  }
                }
                const goodsSubtotalDong = enrichedItems.reduce(
                  (s, it) => s + (Number(it.totalPrice) || 0),
                  0,
                );
                const quote = await quoteCheckout({
                  email,
                  goodsSubtotalDong,
                  voucherCode,
                  redeemPoints,
                  items: enrichedItems,
                });
                const totalAmount = quote.totalDong;
                const ch = ['web', 'app', 'api'].includes(salesChannel) ? salesChannel : 'web';
                const newOrder = new Order({
                  email,
                  items: enrichedItems,
                  totalAmount,
                  goodsSubtotalDong: quote.goodsSubtotalDong,
                  memberDiscountDong: quote.memberDiscountDong,
                  voucherDiscountDong: quote.voucherDiscountDong,
                  shippingFeeDong: quote.shippingFeeDong,
                  pointsRedeemed: quote.pointsRedeemed || 0,
                  pointsDiscountDong: quote.pointsDiscountDong || 0,
                  membershipTierSlug: quote.tierSlug || '',
                  voucherCode:
                    quote.voucherDiscountDong > 0 && voucherCode
                      ? String(voucherCode).trim().toUpperCase()
                      : '',
                  address,
                  salesChannel: ch,
                });
                if (quote.voucherDiscountDong > 0 && quote.voucherCodeApplied) {
                  // defer mark until record consumed succeeds
                }
                await newOrder.save();
                if (quote.voucherDiscountDong > 0 && quote.voucherCodeApplied) {
                  const consumed = await consumeUserVoucher(email, quote.voucherCodeApplied, newOrder._id);
                  if (!consumed) {
                    await Order.findByIdAndDelete(newOrder._id);
                    return res.status(400).json({ message: 'Voucher không còn hợp lệ cho tài khoản này' });
                  }
                  await incrementVoucherUse(quote.voucherCodeApplied);
                  newOrder.voucherConsumed = true;
                  await newOrder.save();
                }
                if ((quote.pointsRedeemed || 0) > 0) {
                  const consumedPoints = await consumeLoyaltyPoints(email, quote.pointsRedeemed, newOrder._id);
                  if (!consumedPoints) {
                    if (quote.voucherDiscountDong > 0 && quote.voucherCodeApplied) {
                      await releaseUserVoucher(email, quote.voucherCodeApplied, newOrder._id);
                      await decrementVoucherUse(quote.voucherCodeApplied);
                    }
                    await Order.findByIdAndDelete(newOrder._id);
                    return res.status(400).json({ message: 'Điểm hiện tại không đủ, vui lòng thử lại' });
                  }
                  newOrder.pointsConsumed = true;
                  await newOrder.save();
                }
                await afterOrderItemsSold(enrichedItems, { orderId: newOrder._id });
                
                // Tạo notification khi đặt hàng thành công (không blocking)
                const orderId = newOrder._id;
                createNotificationHelper(
                    email,
                    'order',
                    'Đặt hàng thành công',
                    `Đơn hàng #${orderId.toString().slice(-6)} đã được đặt thành công với tổng giá trị ${formatVndMessageDong(totalAmount)}.`,
                    `/profile/purchase`,
                    orderId,
                    null, null, null,
                    { totalAmount, itemCount: items.length }
                ).catch(err => console.log('Lỗi tạo notification:', err));

                notifyAllAdmins({
                    type: 'order',
                    title: 'Đơn hàng mới',
                    message: `${email} vừa đặt đơn #${orderId.toString().slice(-6)} (tổng: ${formatVndMessageDong(totalAmount)}).`,
                    link: `/admin/Orders?orderId=${orderId}`,
                    orderId,
                    bookId: null,
                    bookImage: null,
                    bookTitle: null,
                    metadata: { customerEmail: email, totalAmount, itemCount: items.length },
                }).catch((err) => console.log('Lỗi thông báo admin (đơn hàng):', err));
                
                return res.status(200).json({message:'Đặt Hàng Thành Công'})
    
                
                }
                catch(error){
                    return res.status(400).json({
                        message:"Đăt hàng thất bại"
                    })
                }
            
         
    }
   
   async getOrder(req,res,next){
        try{
             const { email } = req.query; 
            const orders = await Order.find({ email })
              .populate(ORDER_ITEMS_BOOK_POPULATE)
              .sort({ createdAt: -1 });
           
                if(!orders){
                    return res.status(200).json({
                        EC:0,
                        EM:'Chưa có đơn hàng nào'
                    })
                }
                else{
                     res.status(200).json(orders);
                }
        }
        catch(error){
            console.log('Loi')
            res.status(400).json('Lỗi dữ liệu')
        }
   }
    
   async getListOrder(req,res,next){
        try{
            
            const listorders = await Order.find({}).populate(ORDER_ITEMS_BOOK_POPULATE)
           
                if(!listorders){
                    return res.status(200).json({
                        EC:0,
                        EM:'Chưa có đơn hàng nào'
                    })
                }
                else{
                     res.status(200).json(listorders);
                }
        }
        catch(error){
            console.log('Loi')
            res.status(400).json('Lỗi dữ liệu')
        }
   }

   async removeOrder(req, res) {
       try {
           const id = req.params.id;
           if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
               return res.status(400).json({ message: 'orderId không hợp lệ' });
           }
           const order = await Order.findById(id);
           if (!order) {
               return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
           }

           const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
           const isAdmin = req.user?.role === 'admin';

           if (order.status !== 'Đã hủy' && !(force && isAdmin)) {
               return res.status(400).json({
                   message: `Chỉ xóa được đơn ở trạng thái "Đã hủy" (hiện tại: "${order.status}"). Vui lòng hủy đơn trước, hoặc admin có thể truyền ?force=true.`,
                   currentStatus: order.status,
               });
           }

           try {
               await releaseVoucherIfNeeded(order);
               await releasePointsIfNeeded(order);
           } catch (relErr) {
               console.error('[removeOrder] release voucher/points failed:', relErr?.message || relErr);
           }

           await Order.findByIdAndDelete(id);
           return res.status(200).json({ message: 'Đã xóa đơn hàng', orderId: String(id) });
       } catch (error) {
           console.error('removeOrder error:', error);
           return res.status(400).json({ message: 'Lỗi dữ liệu', error: String(error.message || error) });
       }
   }     

   async updateOrder(req,res,next){
    try{
        const item = req.body;
        if (!item?._id) {
          return res.status(400).json({ message: 'Thiếu _id đơn hàng' });
        }
        const prev = await Order.findById(item._id).lean();
        if (!prev) {
          return res.status(404).json({ message: 'Không tìm thấy đơn' });
        }
        const nextStatus =
          item.status !== undefined && item.status !== null && item.status !== ''
            ? item.status
            : prev.status;
        const isCancellingNow = nextStatus === 'Đã hủy' && prev.status !== 'Đã hủy';

        /**
         * Bảo vệ dữ liệu lịch sử: KHÔNG cho phép sửa các trường tài chính / nhận diện
         * sau khi đơn đã tạo. Chỉ admin mới được sửa đơn, và cũng chỉ sửa status/isPay/
         * address/Paymedthod/review/salesChannel/voucherCode (nếu chưa consume).
         */
        const PROTECTED = new Set([
          '_id', 'email', 'items', 'totalAmount', 'goodsSubtotalDong',
          'memberDiscountDong', 'voucherDiscountDong', 'shippingFeeDong',
          'membershipTierSlug', 'voucherConsumed', 'pointsRedeemed',
          'pointsDiscountDong', 'pointsConsumed', 'createdAt', 'updatedAt',
        ]);
        const setDoc = {};
        for (const [k, v] of Object.entries(item)) {
          if (PROTECTED.has(k)) continue;
          setDoc[k] = v;
        }
        if (Object.keys(setDoc).length === 0) {
          return res.status(400).json({
            message: 'Không có trường nào hợp lệ để cập nhật (items/email/totalAmount đã bị khóa).',
          });
        }
        if (nextStatus === 'Hoàn thành') {
          setDoc.isPay = true;
        }
        await Order.findByIdAndUpdate(item._id, { $set: setDoc }, { new: true });
        if (isCancellingNow) {
          try {
            await releaseVoucherIfNeeded(prev);
            await releasePointsIfNeeded(prev);
          } catch (voucherErr) {
            console.error('release voucher on cancel (updateOrder):', voucherErr);
          }
        }
        if (nextStatus === 'Hoàn thành' && prev.status !== 'Hoàn thành') {
          const after = await Order.findById(item._id).lean();
          if (after) {
            try {
              await onOrderCompleted(after);
            } catch (memErr) {
              console.error('membership onOrderCompleted (updateOrder):', memErr);
            }
          }
        }
        return res.status(200).json('Thanh Cong');
    }
    catch(error)
    {
        return res.status(400).json('Loi du lieu')
    }
   }
    async getOrderSearch(req,res,next){

      try{
        const keySearch = String(req.query.key || '').trim();
        const searchRegex = createVietnameseRegex(keySearch);
        if (!searchRegex) {
          return res.status(200).json([]);
        }
     
           let objectid;
        if(mongoose.Types.ObjectId.isValid(keySearch))
        {
             objectid=new mongoose.Types.ObjectId(keySearch);
            
        }

        const orders = await Order.find({
          $or: [
            { _id: objectid },
            { email: { $regex: searchRegex } },
            { status: { $regex: searchRegex } },
          ],
        }).populate(ORDER_ITEMS_BOOK_POPULATE);

        return res.status(200).json(orders);
      }
      catch(error){
        console.error(error)
         res.status(500).json({ error: 'Lỗi khi tìm kiếm sách' });
      }
     }    
     async statusOrder(req,res,next){
        try{
             console.log(req.params.id)
             const updateOrder = await Order.findOne({_id:req.params.id});
             if(!updateOrder){
                console.log('NOT FOUND')
                return res.status(404).json('Order not found');
             }
            
            let newStatus = '';
            let oldStatus = updateOrder.status;
            let notificationTitle = '';
            let notificationMessage = '';
            const action = String(req.body?.action || req.query?.action || '').toLowerCase().trim();
            
            // Logic chuyển trạng thái đơn hàng
            if (action === 'cancel' && updateOrder.status === 'Chờ xử lý') {
                newStatus = 'Đã hủy';
                notificationTitle = 'Đơn hàng đã bị hủy';
                notificationMessage = `Đơn hàng #${updateOrder._id.toString().slice(-6)} đã được hủy theo yêu cầu của bạn.`;
            } else if(updateOrder.status === "Chờ xử lý"){
                newStatus = "Đang giao"; // Admin xác nhận đơn hàng
                notificationTitle = 'Đơn hàng đang được giao';
                notificationMessage = `Đơn hàng #${updateOrder._id.toString().slice(-6)} đã được xác nhận và đang trong quá trình vận chuyển.`;
            } else if(updateOrder.status === "Đang giao"){
                newStatus = "Hoàn thành";
                notificationTitle = 'Đơn hàng đã hoàn thành';
                notificationMessage = `Đơn hàng #${updateOrder._id.toString().slice(-6)} đã được giao thành công. Cảm ơn bạn đã mua sắm!`;
            } else {
                return res.status(400).json('Không thể cập nhật trạng thái này');
            }
            
            updateOrder.status = newStatus;
            if (newStatus === 'Hoàn thành') {
              updateOrder.isPay = true;
            }
            console.log(updateOrder.address);
             await updateOrder.save();
             if (newStatus === 'Đã hủy' && oldStatus !== 'Đã hủy') {
               try {
                 await releaseVoucherIfNeeded(updateOrder);
                 await releasePointsIfNeeded(updateOrder);
               } catch (voucherErr) {
                 console.error('release voucher on cancel (statusOrder):', voucherErr);
               }
             }
             if (newStatus === 'Hoàn thành') {
               try {
                 await onOrderCompleted(updateOrder);
               } catch (memErr) {
                 console.error('membership onOrderCompleted:', memErr);
               }
             }
             
             // Tạo notification khi trạng thái đơn hàng được cập nhật (không blocking)
             if (notificationTitle) {
                 createNotificationHelper(
                     updateOrder.email,
                     'order_status',
                     notificationTitle,
                     notificationMessage,
                     '/profile/purchase',
                     updateOrder._id,
                     null, null, null,
                     { oldStatus, newStatus }
                 ).catch(err => console.log('Lỗi tạo notification:', err));
             }
             
             return res.status(200).json('Thanh Cong')
        }catch(error)
        {   
            console.log(error);
            return res.status(400).json('that bai')
        }
     }
     async reviewOrder(req,res,next){
        try{
            
             const updateOrder = await Order.findById(req.params.id)
             if(!updateOrder){
                console.log('NOT FOUND')
             }
                updateOrder.review=true;
                console.log("Sau khi update",updateOrder)
             await updateOrder.save()
             console.log("Saved!")
             return res.status(200).json('Thanh Cong')
             
        }catch(error)
        {   
            console.log(error);
            return res.status(400).json('that bai')
        }
     }
     async repairBookRefs(req, res) {
        try {
          if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Chỉ admin mới được sửa dữ liệu đơn hàng' });
          }
          const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';
          const result = await repairOrderBookRefs({ dryRun });
          return res.status(200).json({
            message: dryRun
              ? 'Đã kiểm tra dữ liệu Order.items.bookId (chưa ghi DB)'
              : 'Đã sửa dữ liệu Order.items.bookId',
            ...result,
          });
        } catch (error) {
          return res.status(500).json({
            message: 'Lỗi sửa dữ liệu Order.items.bookId',
            error: String(error.message),
          });
        }
     }
       }
       

const orderController = new OrderController();
orderController.repairOrderBookRefs = repairOrderBookRefs;
module.exports= orderController;