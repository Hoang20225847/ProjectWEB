const AccountAdmin= require('../models/AccountAdmins')
const AccountUser= require('../models/AccountUsers')
const NotificationController = require('./NotificationController');
const bcrypt=require('bcrypt')
const saltRounds=10;
const jwt =require('jsonwebtoken')
const mongoose = require('mongoose');
const { createVietnameseRegex } = require('../../utils/vietnameseSearch');

function requireAdmin(req, res) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ message: 'Chỉ quản trị viên mới được thực hiện thao tác này' });
        return false;
    }
    return true;
}

function mapCustomerRow(row) {
    return { ...row, accountKind: 'customer' };
}

function mapAdminRow(row) {
    return { ...row, accountKind: 'admin', role: row.role || 'admin' };
}

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
    /** GET /admin/users — chỉ tài khoản khách (collection account), không gồm quản trị */
    async getAccountList(req,res,next){
        try {
            if (!requireAdmin(req, res)) return;
            const accountList = await AccountUser.find({})
              .select('-password -resetPasswordTokenHash')
              .populate('membershipTier', 'name slug sortOrder active')
              .sort({ createdAt: -1 })
              .lean();
            return res.status(200).json(accountList.map(mapCustomerRow));
        } catch (error) {
            return next(error);
        }
    }

    /** GET /admin/admins — tài khoản quản trị (collection accountAdmin) */
    async getAdminAccountList(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;
            const rows = await AccountAdmin.find({})
              .select('-password')
              .sort({ createdAt: -1 })
              .lean();
            return res.status(200).json(rows.map(mapAdminRow));
        } catch (error) {
            return next(error);
        }
    }

    async searchCustomerAccounts(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;
            const keySearch = String(req.query.key || '').trim();
            const searchRegex = createVietnameseRegex(keySearch);
            if (!searchRegex) return res.status(200).json([]);
            const accounts = await AccountUser.find({
                $or: [{ email: { $regex: searchRegex } }, { name: { $regex: searchRegex } }],
            })
              .select('-password -resetPasswordTokenHash')
              .populate('membershipTier', 'name slug sortOrder active')
              .lean();
            return res.status(200).json(accounts.map(mapCustomerRow));
        } catch (error) {
            return next(error);
        }
    }

    async searchAdminAccounts(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;
            const keySearch = String(req.query.key || '').trim();
            const searchRegex = createVietnameseRegex(keySearch);
            if (!searchRegex) return res.status(200).json([]);
            const accounts = await AccountAdmin.find({
                $or: [{ email: { $regex: searchRegex } }, { name: { $regex: searchRegex } }],
            })
              .select('-password')
              .lean();
            return res.status(200).json(accounts.map(mapAdminRow));
        } catch (error) {
            return next(error);
        }
    }

    async updateAdminAccount(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;
            const id = req.params.id;
            if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
                return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
            }
            const { item } = req.body || {};
            if (!item) return res.status(400).json({ message: 'Thiếu dữ liệu cập nhật' });

            const account = await AccountAdmin.findById(id);
            if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản quản trị' });

            if (item.name != null) account.name = String(item.name).trim();
            if (item.avt != null) account.avt = String(item.avt).trim();
            if (item.password && String(item.password).trim() !== '') {
                // Admin login hiện so sánh plaintext — giữ tương thích với handleLogin
                account.password = String(item.password).trim();
            }
            await account.save();
            return res.status(200).json({ message: 'Cập nhật quản trị viên thành công' });
        } catch (error) {
            return next(error);
        }
    }

    async createAdminAccount(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;

            const name = String(req.body?.name || '').trim();
            const email = String(req.body?.email || '').trim().toLowerCase();
            const password = String(req.body?.password || '').trim();
            const confirmPassword = String(req.body?.confirmPassword || '').trim();
            const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!name) {
                return res.status(400).json({ message: 'Vui lòng nhập tên quản trị viên', field: 'name' });
            }
            if (name.length < 2) {
                return res.status(400).json({ message: 'Tên phải có ít nhất 2 ký tự', field: 'name' });
            }
            if (!email) {
                return res.status(400).json({ message: 'Vui lòng nhập email', field: 'email' });
            }
            if (!emailRe.test(email)) {
                return res.status(400).json({ message: 'Email không hợp lệ', field: 'email' });
            }
            if (!password || password.length < 6) {
                return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự', field: 'password' });
            }
            if (!confirmPassword) {
                return res.status(400).json({ message: 'Vui lòng nhập lại mật khẩu', field: 'confirmPassword' });
            }
            if (password !== confirmPassword) {
                return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp', field: 'confirmPassword' });
            }

            if (req.file) {
                const allowed = ['image/jpeg', 'image/png'];
                if (!allowed.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        message: 'Chỉ chấp nhận ảnh JPEG hoặc PNG',
                        field: 'avatar',
                    });
                }
                if (req.file.size > 1024 * 1024) {
                    return res.status(400).json({
                        message: 'Dung lượng ảnh tối đa 1MB',
                        field: 'avatar',
                    });
                }
            }

            const [existingAdmin, existingUser] = await Promise.all([
                AccountAdmin.findOne({ email }),
                AccountUser.findOne({ email }),
            ]);
            if (existingAdmin) {
                return res.status(400).json({
                    message: 'Email đã được dùng cho tài khoản quản trị',
                    field: 'email',
                });
            }
            if (existingUser) {
                return res.status(400).json({
                    message: 'Email đã được đăng ký là khách hàng — dùng email khác',
                    field: 'email',
                });
            }

            let avt;
            if (req.file) {
                const { getPublicApiUrl } = require('../../config/appConfig');
                avt = `${getPublicApiUrl()}/uploads/${req.file.filename}`;
            }

            const newAdmin = new AccountAdmin({
                name,
                email,
                password,
                avt: avt || undefined,
            });
            await newAdmin.save();

            const row = newAdmin.toObject();
            delete row.password;
            return res.status(201).json({
                message: 'Tạo quản trị viên thành công',
                account: mapAdminRow(row),
            });
        } catch (error) {
            if (error?.code === 11000) {
                return res.status(400).json({ message: 'Email đã tồn tại' });
            }
            return next(error);
        }
    }

    async removeAdminAccount(req, res, next) {
        try {
            if (!requireAdmin(req, res)) return;
            const id = req.params.id;
            if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
                return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
            }

            const account = await AccountAdmin.findById(id);
            if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản quản trị' });

            const selfEmail = String(req.user?.email || '').toLowerCase().trim();
            if (selfEmail && String(account.email).toLowerCase().trim() === selfEmail) {
                return res.status(403).json({ message: 'Không thể xóa tài khoản quản trị đang đăng nhập' });
            }

            const adminCount = await AccountAdmin.countDocuments({});
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Không thể xóa quản trị viên cuối cùng của hệ thống' });
            }

            await AccountAdmin.findByIdAndDelete(id);
            return res.status(200).json({ message: 'Đã xóa tài khoản quản trị' });
        } catch (error) {
            return next(error);
        }
    }
   
       }

module.exports= new AdminController;