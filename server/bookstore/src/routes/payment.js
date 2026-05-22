const express = require ('express');
const router =express.Router();
const PaymentController =require('../app/controllers/PaymentController')
router.post('/VnPay',PaymentController.createQr);
router.get('/check-payment-vnpay',PaymentController.response)
router.post('/Momo',PaymentController.createQrMomO)
module.exports=router