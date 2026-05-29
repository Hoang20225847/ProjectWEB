function formatVndMessageDong(dong) {
  const n = Math.round(Number(dong) || 0);
  return `${n.toLocaleString('vi-VN')}đ`;
}

const Order = require('../models/Orders');
const { createNotificationHelper } = require('./NotificationController');
const axios = require('axios');
const { ProductCode, VnpLocale, dateFormat } = require('vnpay');
const { getPublicApiUrl, getClientBaseUrl } = require('../../config/appConfig');
const { getVNPayClient } = require('../../config/vnpayConfig');
const {
  createCheckoutOrder,
  cancelUnpaidOnlineOrder,
  confirmOnlinePayment,
  resolveClientIp,
} = require('../../services/checkoutOrderService');

class PaymentController {
  /** VNPay sandbox — tạo đơn chờ thanh toán, redirect sang cổng */
  async createQr(req, res, next) {
    try {
      const { order, quote } = await createCheckoutOrder(req.body, {
        paymentChannel: 'vnpay',
        deductInventory: false,
      });

      const vnpay = getVNPayClient();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const vnpTxnRef = order._id.toString();
      const orderInfo = `Thanh toan don hang ${vnpTxnRef.slice(-6)}`;

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: Number(quote.totalDong) || 0,
        vnp_IpAddr: resolveClientIp(req),
        vnp_TxnRef: vnpTxnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: `${getPublicApiUrl()}/payapi/check-payment-vnpay`,
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(new Date()),
        vnp_ExpireDate: dateFormat(tomorrow),
      });

      return res.status(200).json(paymentUrl);
    } catch (err) {
      const status = err.status || 400;
      return res.status(status).json({
        message: err.message || 'Không tạo được link thanh toán VNPay',
      });
    }
  }

  /** VNPay redirect — xác thực chữ ký, cập nhật đơn, chuyển về frontend */
  async response(req, res) {
    const FE_RETURN_URL = `${getClientBaseUrl()}/profile/purchase`;

    try {
      const vnpay = getVNPayClient();
      const verify = vnpay.verifyReturnUrl(req.query);

      if (!verify.isVerified) {
        return res.redirect(`${FE_RETURN_URL}?payment=failed&reason=checksum`);
      }

      const vnpTxnRef = verify.vnp_TxnRef || req.query.vnp_TxnRef;
      if (!vnpTxnRef) {
        return res.redirect(`${FE_RETURN_URL}?payment=failed&reason=missing_ref`);
      }

      const order = await Order.findById(vnpTxnRef);
      if (!order) {
        return res.redirect(`${FE_RETURN_URL}?payment=failed&reason=order_not_found`);
      }

      if (order.isPay) {
        return res.redirect(`${FE_RETURN_URL}?payment=success`);
      }

      const expectedAmount = Math.round(Number(order.totalAmount) || 0);
      const paidAmount = Math.round(Number(verify.vnp_Amount) || 0);
      if (expectedAmount > 0 && paidAmount > 0 && expectedAmount !== paidAmount) {
        await cancelUnpaidOnlineOrder(order);
        createNotificationHelper(
          order.email,
          'payment',
          'Thanh toán thất bại',
          `Số tiền VNPay không khớp đơn #${vnpTxnRef.toString().slice(-6)}.`,
          '/profile/purchase',
          order._id,
          null,
          null,
          null,
          { paymentMethod: 'VNPay', amount: order.totalAmount },
        ).catch((e) => console.log('Lỗi tạo notification:', e));
        return res.redirect(`${FE_RETURN_URL}?payment=failed&reason=amount`);
      }

      const paymentSuccess = verify.isSuccess && verify.vnp_ResponseCode === '00';

      if (paymentSuccess) {
        await confirmOnlinePayment(order);
        createNotificationHelper(
          order.email,
          'payment',
          'Thanh toán VNPay thành công',
          `Đơn hàng #${vnpTxnRef.toString().slice(-6)} đã thanh toán qua VNPay (${formatVndMessageDong(order.totalAmount)}).`,
          '/profile/purchase',
          order._id,
          null,
          null,
          null,
          { paymentMethod: 'VNPay', amount: order.totalAmount },
        ).catch((e) => console.log('Lỗi tạo notification:', e));
        return res.redirect(`${FE_RETURN_URL}?payment=success&method=vnpay`);
      }

      await cancelUnpaidOnlineOrder(order);
      createNotificationHelper(
        order.email,
        'payment',
        'Thanh toán thất bại',
        verify.message ||
          `Thanh toán đơn hàng #${vnpTxnRef.toString().slice(-6)} không thành công. Vui lòng thử lại.`,
        '/profile/purchase',
        order._id,
        null,
        null,
        null,
        { paymentMethod: 'VNPay', amount: order.totalAmount },
      ).catch((e) => console.log('Lỗi tạo notification:', e));

      return res.redirect(`${FE_RETURN_URL}?payment=failed&method=vnpay`);
    } catch (error) {
      console.error('[VNPay] return handler error:', error);
      return res.redirect(`${FE_RETURN_URL}?payment=failed&reason=server`);
    }
  }

  async createQrMomO(req, res) {
    try {
      const { order, quote } = await createCheckoutOrder(req.body, {
        paymentChannel: 'momo',
        deductInventory: false,
      });

      const vnpTxnRef = order._id.toString();
      const partnerCode = 'MOMO';
      const accessKey = 'F8BBA842ECF85';
      const secretkey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
      const requestId = vnpTxnRef;
      const momoOrderId = requestId;
      const orderInfo = 'pay with MoMo';
      const redirectUrl = `${getClientBaseUrl()}/profile/purchase?payment=success&method=momo`;
      const ipnUrl = `${getPublicApiUrl()}/payapi/momo-ipn`;
      const amount = String(Math.round(Number(quote.totalDong) || 0));
      const requestType = 'captureWallet';
      const extraData = '';

      const rawSignature =
        `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
        `&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
        `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const crypto = require('crypto');
      const signature = crypto.createHmac('sha256', secretkey).update(rawSignature).digest('hex');

      const requestBody = JSON.stringify({
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId: momoOrderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: 'vi',
      });

      const response = await axios.post(
        'https://test-payment.momo.vn/v2/gateway/api/create',
        requestBody,
        { headers: { 'Content-Type': 'application/json' } },
      );
      return res.status(200).json(response.data.payUrl);
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        message: error?.response?.data?.message || error.message || 'Không tạo được link MoMo',
      });
    }
  }
}

module.exports = new PaymentController();
