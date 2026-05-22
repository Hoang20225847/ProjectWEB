const AccountUser = require('../models/AccountUsers');
const { registerMembership, cancelMembership } = require('../services/membershipService');
const { sendResetPasswordLink } = require('../services/mailService');
const bcrypt=require('bcrypt')
const crypto = require('crypto');
const saltRounds=10;
const jwt =require('jsonwebtoken')

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

class UserController{
    
   async create(req,res,next)
       {
              
              
            // Lấy dữ liệu từ request body
            const { name, email, password } = req.body;
            const hashPassword= await bcrypt.hash(password,saltRounds)
            // Kiểm tra xem có tài khoản với email này chưa
            const existingUser = await AccountUser.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email đã được đăng ký!' });
                
            }

            // Tạo tài khoản mới
            const newUser = new AccountUser({
                name,
                email,
                password:hashPassword, // Bạn cần mã hóa password nếu dùng trong thực tế (sử dụng bcrypt hoặc các thư viện tương tự)
            });

            // Lưu tài khoản mới vào cơ sở dữ liệu
            await newUser.save();
                
            // Trả về phản hồi thành công
            return res.status(201).json({
                message: 'Tạo tài khoản thành công!'
            });

         
    }
    async handleLogin(req,res,next)
       {
              
              
            // Lấy dữ liệu từ request body
            const {  email, password } = req.body;

            // Kiểm tra xem có tài khoản với email này chưa
            const existingUser = await AccountUser.findOne({ email }).populate('membershipTier');
            if (existingUser) {
                if (existingUser.deletedAt) {
                    return res.status(403).json({
                        EC: 3,
                        EM: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
                    });
                }
                const isMatchPassword =await bcrypt.compare(password,existingUser.password)
                if(!isMatchPassword)
                    {
                        return res.status(400).json({
                            EC:2,
                            EM:'EMAIL/PASSWORD Khong hop le'})
                        }else {
                            const payload={
                                _id: existingUser._id,
                                email:existingUser.email,
                                name:existingUser.name,
                                avt:existingUser.avt,
                                role:existingUser.role,
                                isMember:existingUser.isMember || false,
                                membershipTierSlug: existingUser.membershipTier?.slug || '',
                                loyaltyPoints: existingUser.loyaltyPoints || 0,
                            }
                            const access_token=jwt.sign(payload,'ce86b645-b01e-4681-a77c-00ca11579502',{
                                expiresIn:'1d',
                            })
                    //creat an acess token
                    return  res.status(200).json({access_token,
                        user:{
                            id: existingUser._id,
                            name:existingUser.name,
                            email:existingUser.email,
                            avt:existingUser.avt,
                            role:existingUser.role,
                            isMember:existingUser.isMember || false,
                            phone:existingUser.phone || '',
                            membershipTierSlug: existingUser.membershipTier?.slug || '',
                            membershipTierName: existingUser.membershipTier?.name || '',
                            loyaltyPoints: existingUser.loyaltyPoints || 0,
                            totalSpentDong: existingUser.totalSpentDong || 0,
                            memberSince: existingUser.memberSince || null,
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
    async rePassword(req,res,next)
           {   const{email,password,newpassword} =req.body;
                console.log(req.body)
                try{
                  const account = await AccountUser.findOne({email:req.body.email});
                  
                  if(account)
                  {
                    const isMatchPassword =await bcrypt.compare(password,account.password)
                    if(!isMatchPassword)
                    {
                        return res.status(400).json({
                            EC:2,
                            EM:"Sai mật khẩu"
                        })
                    }
                    else{
                        const hashPassword=await bcrypt.hash(newpassword,saltRounds)
                        account.password=hashPassword;
                        account.save()
                        return res.status(200).json("Thay đổi thành công")
                    }
                  }
                  else{
                    return res.status(400).json("Khoong thay nick")
                   }
                
                  
                }
                catch(error)
                {  console.error("Error updating account:", error);  // Log chi tiết lỗi
                  next(error)};
                  
                
    }
    async forgotPassword(req, res, next) {
      try {
        const email = normalizeEmail(req.body?.email);
        if (!email) {
          return res.status(400).json({ message: 'Vui lòng nhập email' });
        }

        const account = await AccountUser.findOne({ email });
        if (!account) {
          return res.status(404).json({
            message: 'Tài khoản này không tồn tại. Vui lòng đăng ký tài khoản mới.',
            code: 'ACCOUNT_NOT_FOUND',
          });
        }

        const token = generateResetToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        account.resetPasswordTokenHash = tokenHash;
        account.resetPasswordExpiresAt = expiresAt;
        await account.save();

        const clientBaseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
        const resetLink = `${clientBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        await sendResetPasswordLink({ toEmail: email, resetLink });

        return res.status(200).json({
          message: 'Đã gửi link đặt lại mật khẩu về email của bạn.',
        });
      } catch (error) {
        next(error);
      }
    }

    async resetPasswordByCode(req, res, next) {
      try {
        const token = String(req.body?.token || '').trim();
        const newPassword = String(req.body?.newPassword || '');

        if (!token || !newPassword) {
          return res.status(400).json({ message: 'Thiếu thông tin đặt lại mật khẩu' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ message: 'Mật khẩu mới phải từ 6 ký tự' });
        }

        const tokenHash = hashToken(token);
        const account = await AccountUser.findOne({ resetPasswordTokenHash: tokenHash });
        if (!account) {
          return res.status(400).json({ message: 'Thông tin không hợp lệ' });
        }

        const isExpired = !account.resetPasswordExpiresAt || account.resetPasswordExpiresAt.getTime() < Date.now();
        if (isExpired) {
          return res.status(400).json({ message: 'Link đặt lại mật khẩu đã hết hạn' });
        }

        account.password = await bcrypt.hash(newPassword, saltRounds);
        account.resetPasswordTokenHash = '';
        account.resetPasswordExpiresAt = null;
        await account.save();

        return res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
      } catch (error) {
        next(error);
      }
    }
     async updateAccount(req,res,next)
       {    
            try{ 
                const {item}=req.body;
                console.log(item);
              const account = await AccountUser.findOne({email:item.email});
              if(!account)
              {
                return res.status(404).json({message:"Not Account"})
              }
             
              account.name = item.name;
                account.avt = item.avt;
                if (item.password && item.password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(item.password,saltRounds);
                account.password = hashedPassword;
    }
            await account.save();
              return res.status(200).json('Thành Công')
            }
            catch(error)
            {  console.error("Error updating account:", error);  // Log chi tiết lỗi
              next(error)};
              
            
}
 async updateMembership(req,res,next)
 {    
      try{ 
          const { email, isMember, register } = req.body;
          const em = String(email || '').toLowerCase().trim();
          if (!em) {
            return res.status(400).json({ message: 'Thiếu email' });
          }
          let reg = register;
          if (reg === undefined && typeof isMember === 'boolean') reg = isMember;
          const wantRegister = reg === true || reg === 'true';
          const wantCancel = reg === false || reg === 'false' || reg === 'cancel';

          if (wantRegister && !wantCancel) {
            const r = await registerMembership(em);
            if (!r.ok) return res.status(404).json({ message: r.message });
            const account = await AccountUser.findOne({ email: em }).populate('membershipTier');
            return res.status(200).json({
              message: 'Đăng ký hội viên thành công',
              isMember: account.isMember,
              membershipTierSlug: account.membershipTier?.slug || '',
              membershipTierName: account.membershipTier?.name || '',
              loyaltyPoints: account.loyaltyPoints || 0,
              totalSpentDong: account.totalSpentDong || 0,
              memberSince: account.memberSince || null,
            });
          }
          if (wantCancel) {
            const r = await cancelMembership(em);
            if (!r.ok) return res.status(404).json({ message: r.message });
            return res.status(200).json({
              message: 'Đã hủy đăng ký hội viên',
              isMember: false,
            });
          }
          return res.status(400).json({ message: 'Thiếu tham số register hoặc isMember' });
      }
      catch(error)
      {  console.error("Error updating membership:", error);
        next(error)};
 }
 async uploadAvt(req,res,next){
 try{
  const email= req.body.email;
  const file= req.file;
  if(!file){
    return res.status(400).json({message:'error'})
  }
  const user = await AccountUser.findOne({email});
  if(!user){
    return res.status(404).json({message:'Not Found Account'})
    
  }
  const { getPublicApiUrl } = require('../../config/appConfig');
  user.avt = `${getPublicApiUrl()}/uploads/${file.filename}`;
  await user.save();
  return res.status(200).json({
    message:'Cập nhật avartar thành công',
    avt:user.avt
  })
 }catch(error)
 {
  return res.status(400).json('Upload that bai')
 }
}  

       }

module.exports= new UserController;