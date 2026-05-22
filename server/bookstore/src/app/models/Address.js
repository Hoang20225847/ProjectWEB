const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const Address =new Schema({
   email: { 
    type: String, 
    required: true 
  },
  stt: { 
    type: Number, 
    required: true 
  },
 name:{type:String,required:true
 },
 phone:{type:String,required:true},
 details:{type:String,required:true},
 province:{type:String,required:true},
  isDefault: { 
    type: Boolean, 
    default: false
  },
}, {
  timestamps: true // tự động thêm createdAt và updatedAt
});


module.exports=mongoose.model('address',Address);