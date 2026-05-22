
const Review= require('../models/Review')
const Book= require('../models/Books')
const mongoose = require('mongoose');
const { notifyAllAdmins } = require('./NotificationController');
async function updateBookEvaluate(bookId){
        console.log("Cập nhật đánh giá cho sách với ID: ", bookId);
        const reviewBook= await Review.find({bookId})
        console.log(reviewBook)
        const bookUpdate =await Book.findOne({_id:bookId})
        console.log(bookUpdate)
        let point =0;
        
        if(Array.isArray(reviewBook))
        {
            reviewBook.map((item)=>{
                point+=item.evaluate;
            })
            point /= reviewBook.length
            
        }
        if(bookUpdate)
        {
            bookUpdate.evaluate=Math.round(point * 10) / 10
        }
        await bookUpdate.save();
        return;
    }
class ReviewController{
    
   async create(req,res,next)
       {
              
              
           try{ // Lấy dữ liệu từ request body
            const { userId,evaluate,comment,bookId } = req.body;
            
                const newReview =new Review({
                    userId,
                    evaluate: Number(evaluate),
                    comment,
                    bookId
                })
                console.log(newReview)
                const savedReview = await newReview.save();
               await updateBookEvaluate(bookId);

                try {
                    const vectorSync = require('../chatbot/sync/vectorSync');
                    vectorSync.syncBookFromId(bookId).catch(() => {});
                } catch (_vs) {}

                try {
                    const bookDoc = await Book.findById(bookId).lean();
                    if (bookDoc && bookDoc.name) {
                        const detailPath = `/details/${encodeURIComponent(bookDoc.name)}#book-reviews`;
                        notifyAllAdmins({
                            type: 'review',
                            title: 'Đánh giá mới',
                            message: `Sách "${bookDoc.name}" vừa có đánh giá ${Number(evaluate)} sao.`,
                            link: detailPath,
                            orderId: null,
                            bookId,
                            bookImage: bookDoc.img || null,
                            bookTitle: bookDoc.name,
                            metadata: { reviewId: savedReview._id, evaluate: Number(evaluate) },
                        }).catch((err) => console.log('Lỗi thông báo admin (đánh giá):', err));
                    }
                } catch (e) {
                    console.log('Lỗi tạo thông báo admin sau review:', e);
                }

                return res.status(200).json({message:'Đặt Hàng Thành Công'})
    
                
                }
                catch(error){
                    return res.status(400).json({
                        message:"Đăt hàng thất bại"
                    })
                }
            
         
    }
    async getReviewBook(req,res,next)
       {
              
              
           try{ // Lấy dữ liệu từ request body
            const listReview = await Review.find({bookId:req.query.id})
            .populate('userId')
            .sort({ createdAt: -1 });
                    
            
                if(!listReview.length>0){
                    return res.status(200).json(null)
                }
                return res.status(200).json(listReview)
    
                
                }
                catch(error){
                    return res.status(400).json({
                        message:"Đăt hàng thất bại"
                    })
                }
            
         
    }
    async getReviewsByUser(req,res,next)
    {
        try{
            const {email} = req.params;
            const listReview = await Review.find({userId: email})
                .populate('bookId')
                .sort({ createdAt: -1 });
            
            if(!listReview.length>0){
                return res.status(200).json([])
            }
            return res.status(200).json(listReview)
        }
        catch(error){
            return res.status(400).json({
                message:"Lỗi khi lấy đánh giá"
            })
        }
    }
   
  
       }
       

module.exports= new ReviewController;