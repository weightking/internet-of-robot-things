const bcrypt = require('bcryptjs')
const {User} = require('../../model/user')

const login = async (req,res)=>{
    const {email,password} = req.body
    if (email.trim(400).length==0 || password.trim(400).length==0){
        return res.status(400).render('error1',{msg:'email or password wrong'})
    }
    let user = await User.findOne({email})
    if (user){
        let isValid = await bcrypt.compare(password,user.password)
        if (isValid){
            req.session.username = user.username
            //this app is the app = express() in app.js, the app.locals exports the varies to template, it disappear with the app end.
            req.app.locals.userInfo = user
            res.redirect('/admin/log')
        }else {
            res.status(400).render('error1',{msg:'email or password wrong'})
        }
    }else
    {
        res.status(400).render('error1',{msg:'email or password wrong'})
    }
}

module.exports = login