const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const Order =new Schema({
    email: {type: String,required: true,index: true
  },
  items: [
    {
      /** Lưu ObjectId — tránh bookId dạng object làm hỏng thống kê COGS */
      bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
      /** Giá nhập / vốn đơn vị (đồng VNĐ) tại thời điểm tạo đơn — dùng cho COGS */
      unitImportCost: { type: Number },
      /**
       * Snapshot thông tin sách lúc đặt đơn — hiển thị kể cả khi sách bị xóa/sửa sau này.
       * Không nên thay đổi sau khi đơn được tạo.
       */
      bookSnapshot: {
        name: { type: String, default: '' },
        img: { type: String, default: '' },
        author: { type: String, default: '' },
        listPriceAtOrder: { type: Number, default: 0 },
      },
    }
  ],
  totalAmount: { type: Number, required: true },
  /** Chi tiết hội viên / vận chuyển (đồng) — do server tính */
  goodsSubtotalDong: { type: Number },
  memberDiscountDong: { type: Number, default: 0 },
  voucherDiscountDong: { type: Number, default: 0 },
  shippingFeeDong: { type: Number },
  membershipTierSlug: { type: String, default: '', trim: true },
  voucherCode: { type: String, default: '', trim: true, uppercase: true },
  /** Đã ghi nhận tiêu thụ voucher cho đơn này hay chưa */
  voucherConsumed: { type: Boolean, default: false },
  /** Điểm hội viên đã dùng để giảm giá ở đơn này */
  pointsRedeemed: { type: Number, default: 0, min: 0 },
  pointsDiscountDong: { type: Number, default: 0, min: 0 },
  /** Đã trừ điểm thực tế ở ví điểm chưa */
  pointsConsumed: { type: Boolean, default: false },
  address:{
   name:{type:String},
   phone:{type:String,required:true},
 details:{type:String,required:true},
 province:{type:String,required:true}
  },
  status: {
    type: String,
    enum: ['Chờ xử lý', 'Đang giao', 'Hoàn thành', 'Đã hủy'],
    default: 'Chờ xử lý'
  },
  /** Kênh tạo đơn — dùng cho thống kê doanh thu theo kênh */
  salesChannel: {
    type: String,
    enum: ['web', 'app', 'api'],
    default: 'web',
  },
  isPay:{type:Boolean,default:false},
  Paymedthod:{type:Number},
  review:{type:Boolean,default:false}
    
    
    
},{
    timestamps:true,
});


module.exports=mongoose.model('Order',Order);