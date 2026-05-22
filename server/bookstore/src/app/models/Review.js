const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const Review=new Schema({
    userId:{type: Schema.Types.ObjectId,ref:'account',required:true},
    evaluate:{type:Number,default:5},
    comment:{type:String,require:true},
    bookId:{type: Schema.Types.ObjectId,ref:'Book',required:true},
},{
     timestamps: true
});


module.exports=mongoose.model('Review',Review);