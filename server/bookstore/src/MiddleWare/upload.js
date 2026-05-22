const multer= require('multer')
const path=require('path')

const storage=multer.diskStorage({
    destination:function(req,file,cb){
        const uploadDir = path.join(__dirname, '../public/uploads');
        cb(null,uploadDir);
    },
    filename:function(req,file,cb){
        const ext=path.extname(file.originalname);
        const uniqueSuffix=Date.now() +'-'+Math.round(Math.random()* 1E9 );
        cb(null,uniqueSuffix+ext);
    }
});





const upload =multer({
   storage

})
module.exports = upload;