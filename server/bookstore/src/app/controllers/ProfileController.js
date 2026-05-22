const Book= require('../models/Books')
class ProfileController{
    index(req,res ) 
    {
        res.render('cc')
    }
    async show(req,res,next)
        {
                // try{
                //     const books= await Book.find({});
                //     res.json(books)
                // }
                // catch(err){
                //     next(err);
                    
                // }
                Book.find({})
                .then(books =>res.json(books))
                .catch(next);
        }
}
module.exports= new ProfileController;