function formatVndMessageDong(dong) {
  const n = Math.round(Number(dong) || 0);
  return `${n.toLocaleString('vi-VN')}đ`;
}

const axios = require('axios');
const { getPublicApiUrl, getClientBaseUrl } = require('../../config/appConfig');
const { createCheckoutOrder } = require('../../services/checkoutOrderService');

class PaymentController {
  /** MoMo sandbox — tạo đơn chờ thanh toán, redirect sang cổng demo */
  async createQrMomO(req, res) {
    try {
      const { order, quote } = await createCheckoutOrder(req.body, {
        paymentChannel: 'momo',
        deductInventory: false,
      });

      const orderRef = order._id.toString();
      const partnerCode = 'MOMO';
      const accessKey = 'F8BBA842ECF85';
      const secretkey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
      const requestId = orderRef;
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
