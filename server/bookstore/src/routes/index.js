const ProfileRouter=require('./profile')
const SiteRouter=require('./site')
const AdminRouter=require('./admin')
const PayRouter=require('./payment')
const auth =require('../MiddleWare/auth')
const UserController=require('../app/controllers/UserController')

const path=require('path')
function route(app)
{
     app.all(/.*/,auth)
// app.get('/profile',ProfileRouter)

app.use('/api',SiteRouter)
app.post('/regis',UserController.create)
app.post('/login',UserController.handleLogin)
app.post('/repassword',UserController.rePassword)
app.post('/forgot-password', UserController.forgotPassword)
app.post('/reset-password', UserController.resetPasswordByCode)
app.use('/admin',AdminRouter)
app.use('/payapi',PayRouter)
}
module.exports= route;