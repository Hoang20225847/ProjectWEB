const express = require('express');
const router = express.Router();
const PaymentController = require('../app/controllers/PaymentController');

router.post('/Momo', PaymentController.createQrMomO);

module.exports = router;
