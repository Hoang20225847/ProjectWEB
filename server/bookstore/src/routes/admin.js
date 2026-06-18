const express = require ('express');
const router =express.Router();
const AdminController =require('../app/controllers/AdminController')
const upload = require('../MiddleWare/upload');
router.post('/login',AdminController.handleLogin);
router.get('/users',AdminController.getAccountList);
router.get('/users/search', AdminController.searchCustomerAccounts);
router.get('/admins', AdminController.getAdminAccountList);
router.post('/admins', upload.single('avatar'), AdminController.createAdminAccount);
router.get('/admins/search', AdminController.searchAdminAccounts);
router.put('/admins/:id', AdminController.updateAdminAccount);
router.delete('/admins/:id', AdminController.removeAdminAccount);


module.exports=router