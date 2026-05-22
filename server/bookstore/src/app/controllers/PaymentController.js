function formatVndMessageDong(dong) {
  const n = Math.round(Number(dong) || 0);
  return `${n.toLocaleString('vi-VN')}đ`;
}

const AccountAdmin= require('../models/AccountAdmins')
const AccountUser= require('../models/AccountUsers')
const Order= require('../models/Orders')
const { createNotificationHelper } = require('./NotificationController');
const axios = require('axios')
const {VNPay,ignoreLogger,ProductCode,VnpLocale,dateFormat}= require('vnpay')
const { afterOrderItemsSold } = require('../services/orderBookUpdate');
const { enrichOrderItemsWithUnitImportCost } = require('../services/orderItemsEnrich');
const {
  quoteCheckout,
  incrementVoucherUse,
  decrementVoucherUse,
  consumeUserVoucher,
  releaseUserVoucher,
  consumeLoyaltyPoints,
  releaseLoyaltyPoints,
} = require('../services/membershipService');
const { getPublicApiUrl, getClientBaseUrl } = require('../../config/appConfig');

class PaymentController{
    
  async createQr(req,res,next)
  {
     const { email, items, address, salesChannel, voucherCode, redeemPoints } = req.body;
                    const ch = ['web', 'app', 'api'].includes(salesChannel) ? salesChannel : 'web';
                    const enrichedItems = await enrichOrderItemsWithUnitImportCost(items);
                    const goodsSubtotalDong = enrichedItems.reduce(
                      (s, it) => s + (Number(it.totalPrice) || 0),
                      0,
                    );
                    const quote = await quoteCheckout({ email, goodsSubtotalDong, voucherCode, redeemPoints, items: enrichedItems });
                    const totalAmount = quote.totalDong;
                    const newOrder = new Order({
                      email,
                      items: enrichedItems,
                      totalAmount,
                      goodsSubtotalDong: quote.goodsSubtotalDong,
                      memberDiscountDong: quote.memberDiscountDong,
                      voucherDiscountDong: quote.voucherDiscountDong,
                      pointsRedeemed: quote.pointsRedeemed || 0,
                      pointsDiscountDong: quote.pointsDiscountDong || 0,
                      shippingFeeDong: quote.shippingFeeDong,
                      membershipTierSlug: quote.tierSlug || '',
                      voucherCode:
                        quote.voucherDiscountDong > 0 && voucherCode
                          ? String(voucherCode).trim().toUpperCase()
                          : '',
                      address,
                      salesChannel: ch,
                    });
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
        const vnpay=new VNPay({
            tmnCode: 'E1JJOIAV',
    secureSecret: 'PRP3IVKG6OP5PFPKMSO6DSDFEHGR5KLW',
    vnpayHost: 'https://sandbox.vnpayment.vn',
    
    // Cấu hình tùy chọn
    testMode: true,                // Chế độ test
    hashAlgorithm: 'SHA512',      // Thuật toán mã hóa
    enableLog: true,              // Bật/tắt ghi log
    loggerFn: ignoreLogger,       // Hàm xử lý log tùy chỉnh
    
        })
        
       
        const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
  const vnpTxnRef = newOrder._id.toString();
  
        const paymentUrl = vnpay.buildPaymentUrl({
    /** Đồng VN đầy đủ; thư viện vnpay nhân thêm x100 theo chuẩn cổng */
    vnp_Amount: Number(totalAmount) || 0,
    vnp_IpAddr: req.ip,
    vnp_TxnRef: vnpTxnRef,
    vnp_OrderInfo: 'Thanh toan don hang 123456',
    vnp_OrderType: ProductCode.Other,
    vnp_ReturnUrl: `${getPublicApiUrl()}/payapi/check-payment-vnpay`,
    vnp_Locale: VnpLocale.VN, // 'vn' hoặc 'en'
    vnp_CreateDate: dateFormat(new Date()), // tùy chọn, mặc định là thời gian hiện tại
    vnp_ExpireDate: dateFormat(tomorrow), // tùy chọn
});
return res.status(200).json(paymentUrl);
  }
  async response(req,res,next) {
    try{
 const { vnp_TxnRef, vnp_ResponseCode } = req.query;
          const order = await Order.findById(vnp_TxnRef);
          const paymentSuccess = vnp_ResponseCode === '00';
          
           if (paymentSuccess) {
        order.isPay = true;  
        order.status = 'Chờ xử lý';
        
        // Tạo notification khi thanh toán thành công (không blocking)
        createNotificationHelper(
            order.email,
            'payment',
            'Thanh toán thành công',
            `Thanh toán đơn hàng #${vnp_TxnRef.toString().slice(-6)} đã được xác nhận qua VNPay.`,
            '/profile/purchase',
            order._id,
            null, null, null,
            { paymentMethod: 'VNPay', amount: order.totalAmount }
        ).catch(err => console.log('Lỗi tạo notification:', err));
      } else {
        order.status = 'Đã hủy'; 
        if (order.voucherCode) {
          const released = await releaseUserVoucher(order.email, order.voucherCode, order._id);
          if (released) {
            await decrementVoucherUse(order.voucherCode);
          }
          order.voucherConsumed = false;
        }
        if (order.pointsConsumed && (Number(order.pointsRedeemed) || 0) > 0) {
          const releasedPts = await releaseLoyaltyPoints(order.email, order.pointsRedeemed, order._id);
          if (releasedPts) order.pointsConsumed = false;
        }
        
        // Tạo notification khi thanh toán thất bại (không blocking)
        createNotificationHelper(
            order.email,
            'payment',
            'Thanh toán thất bại',
            `Thanh toán đơn hàng #${vnp_TxnRef.toString().slice(-6)} không thành công. Vui lòng thử lại.`,
            '/profile/purchase',
            order._id,
            null, null, null,
            { paymentMethod: 'VNPay', amount: order.totalAmount }
        ).catch(err => console.log('Lỗi tạo notification:', err));
      }
      await order.save();
    const FE_RETURN_URL = `${getClientBaseUrl()}/profile/purchase`;
    const redirectUrl = `${FE_RETURN_URL}?payment=${paymentSuccess ? 'success' : 'failed'}`;
    return res.redirect(redirectUrl);
    }catch(error)
    {
        return res.status(400).json(error)
    }
  }
  async createQrMomO(req,res,next){
    
    try{ const { email, items, address, salesChannel, voucherCode, redeemPoints } = req.body;
      const ch = ['web', 'app', 'api'].includes(salesChannel) ? salesChannel : 'web';
      const enrichedItems = await enrichOrderItemsWithUnitImportCost(items);
      const goodsSubtotalDong = enrichedItems.reduce(
        (s, it) => s + (Number(it.totalPrice) || 0),
        0,
      );
      const quote = await quoteCheckout({ email, goodsSubtotalDong, voucherCode, redeemPoints, items: enrichedItems });
      const totalAmount = quote.totalDong;
      const newOrder = new Order({
        email,
        items: enrichedItems,
        totalAmount,
        goodsSubtotalDong: quote.goodsSubtotalDong,
        memberDiscountDong: quote.memberDiscountDong,
        voucherDiscountDong: quote.voucherDiscountDong,
        pointsRedeemed: quote.pointsRedeemed || 0,
        pointsDiscountDong: quote.pointsDiscountDong || 0,
        shippingFeeDong: quote.shippingFeeDong,
        membershipTierSlug: quote.tierSlug || '',
        voucherCode:
          quote.voucherDiscountDong > 0 && voucherCode
            ? String(voucherCode).trim().toUpperCase()
            : '',
        address,
        salesChannel: ch,
      });
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
                        { totalAmount, itemCount: items.length }
                    ).catch(err => console.log('Lỗi tạo notification:', err));
                    const vnpTxnRef = newOrder._id.toString();
      var partnerCode = "MOMO";
var accessKey = "F8BBA842ECF85";
var secretkey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
var requestId = vnpTxnRef;
var momoOrderId = requestId;
var orderInfo = "pay with MoMo";
var redirectUrl = "https://momo.vn/return";
var ipnUrl = "https://callback.url/notify";
// var ipnUrl = redirectUrl = "https://webhook.site/454e7b77-f177-4ece-8236-ddf1c26ba7f8";
var amount = String(Math.round(Number(totalAmount) || 0));
var requestType = "captureWallet"
var extraData = ""; //pass empty value if your merchant does not have stores

//before sign HMAC SHA256 with format
//accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
var rawSignature = "accessKey="+accessKey+"&amount=" + amount+"&extraData=" + extraData+"&ipnUrl=" + ipnUrl+"&orderId=" + momoOrderId+"&orderInfo=" + orderInfo+"&partnerCode=" + partnerCode +"&redirectUrl=" + redirectUrl+"&requestId=" + requestId+"&requestType=" + requestType
//puts raw signature
console.log("--------------------RAW SIGNATURE----------------")
console.log(rawSignature)
//signature
const crypto = require('crypto');
var signature = crypto.createHmac('sha256', secretkey)
    .update(rawSignature)
    .digest('hex');
console.log("--------------------SIGNATURE----------------")
console.log(signature)

//json object send to MoMo endpoint
const requestBody = JSON.stringify({
    partnerCode : partnerCode,
    accessKey : accessKey,
    requestId : requestId,
    amount : amount,
    orderId : momoOrderId,
    orderInfo : orderInfo,
    redirectUrl : redirectUrl,
    ipnUrl : ipnUrl,
    extraData : extraData,
    requestType : requestType,
    signature : signature,
    lang: 'en'
});
const response= await axios.post('https://test-payment.momo.vn/v2/gateway/api/create',requestBody, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
return res.status(200).json(response.data.payUrl)}
catch(error)
{
  console.log(error)
  return res.status(400).json(error)
}
  }
    
       }

module.exports= new PaymentController;