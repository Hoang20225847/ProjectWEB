const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const AccountAdmin =new Schema({
    name:{type:String,required:true,maxLength:255},
    email:{type:String,required:true,unique:true},
    avt:{type:String,default:"https://i.pinimg.com/originals/c6/e5/65/c6e56503cfdd87da299f72dc416023d4.jpg"},
    password:{type:String,required:true},
    role:{type:String,default:"admin"}
   
    
    
    
},{
    timestamps:true,
});






module.exports=mongoose.model('accountAdmin',AccountAdmin);