const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const AccountUser =new Schema({
    name:{type:String,required:true,maxLength:255},
    email:{type:String,required:true,unique:true},
    avt:{type:String,default:"https://i.pinimg.com/originals/c6/e5/65/c6e56503cfdd87da299f72dc416023d4.jpg"},
    password:{type:String,required:true},
    Address:{type:String,default:''},
    role:{type:String,default:"user"},
    isMember:{type:Boolean,default:false},
    /** Hạng hiện tại (theo totalSpentDong) */
    membershipTier: { type: Schema.Types.ObjectId, ref: 'MembershipTier', default: null },
    memberSince: { type: Date, default: null },
    memberExpiredAt: { type: Date, default: null },
    /** Tổng chi tiêu tích lũy (đồng) — cộng khi đơn Hoàn thành */
    totalSpentDong: { type: Number, default: 0, min: 0 },
    /** Số dư điểm (đồng bộ với PointTransaction.balanceAfter mới nhất) */
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    phone:{type:String,default:''},
    resetPasswordTokenHash: { type: String, default: '' },
    resetPasswordExpiresAt: { type: Date, default: null },
    /**
     * Soft delete: khi != null, tài khoản bị vô hiệu hóa và không thể đăng nhập
     * nhưng vẫn còn document để Order/Cart/Address/Review không bị mất chủ.
     */
    deletedAt: { type: Date, default: null, index: true },
    /** Lý do disable / xóa — phục vụ admin tracking */
    deletedReason: { type: String, default: '' },
},{
    timestamps:true,
});


module.exports=mongoose.model('account',AccountUser);