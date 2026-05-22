const AccountAdmin= require('../models/AccountAdmins')
const AccountUser= require('../models/AccountUsers')
const NotificationController = require('./NotificationController');
const bcrypt=require('bcrypt')
const saltRounds=10;
const jwt =require('jsonwebtoken')
class AdminController{
    
  
    async handleLogin(req,res,next)
       {
              
              
            // Lấy dữ liệu từ request body
            const {  email, password } = req.body;
            
            // Kiểm tra xem có tài khoản với email này chưa
            const existingAdmin = await AccountAdmin.findOne({ email });
            console.log(existingAdmin)
            if (existingAdmin) {
                let isMatchPassword=false;
                if(password === existingAdmin.password)
                {
                    isMatchPassword=true;
                }
                if(!isMatchPassword)
                    {
                        return res.status(400).json({
                            EC:2,
                            EM:'EMAIL/PASSWORD Khong hop le1'})
                        }else {
                            const payload={
                                email:existingAdmin.email,
                                name:existingAdmin.name,
                                avt:existingAdmin.avt,
                                role:existingAdmin.role
                            }
                            const access_token=jwt.sign(payload,'ce86b645-b01e-4681-a77c-00ca11579502',{
                                expiresIn:'1d',
                            })
                    //creat an acess token
                    return  res.status(200).json({access_token,
                        user:{
                            name:existingAdmin.name,
                            email:existingAdmin.email,
                            avt:existingAdmin.avt,
                            role:existingAdmin.role
                        },
                        message:'Dang nhap thanh cong'
                    })
                }
                
            }
           else{
             return res.status(400).json({
                EC:1,
                EM:'EMAIL/PASSWORD Khong hop le'
             })
           }
                
            // Trả về phản hồi thành công
            

         
    }
    async getAccountList(req,res,next){
            const AccountList= await AccountUser.find({})
              .populate('membershipTier', 'name slug sortOrder active')
              .lean();
            if(!AccountList){
                return res.status(400).json({
                    EC:1,
                    EM:'Chưa có Users'
                })
            }
            else{
                return res.status(200).json(AccountList)
            }
    }
   
       }

module.exports= new AdminController;