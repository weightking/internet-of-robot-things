const {User,validateUser} = require('../../model/user')
const bcrypt = require('bcryptjs')

module.exports = async (req,res,next)=>{
    const validation = await validateUser((req.body))
    const id = req.query.id
    if (validation.error){
        next(JSON.stringify({path:'/admin/user-add',message:validation.error.details[0].message}))
    }else{
        const salt = await bcrypt.genSalt(10)
        const password = await bcrypt.hash(req.body.password,salt)
        req.body.password = password
        await User.updateOne({_id:id},{
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            state: req.body.state
        })
        res.redirect('/admin/adminPage')
    }
}