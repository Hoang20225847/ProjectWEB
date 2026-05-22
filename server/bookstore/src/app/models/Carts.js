const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const CartDetail =new Schema({
    bookId:{type: mongoose.Schema.Types.ObjectId,ref:'Book',required:true},
    quantity:{type:Number,default:1},
    price:{type:Number},
    totalPrice:{type:Number},
   selected:{type:Boolean,default:true}
    
    
    
},{
    timestamps: true
})
const Cart=new mongoose.Schema({
    email:{type:String,required:true,unique:true},
    items:[CartDetail],
    totalPrice:{type:Number}
})
;


module.exports=mongoose.model('cart',Cart);