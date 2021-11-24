const {User,validateUser} = require('../../model/user')
const bcrypt = require('bcryptjs')

module.exports = async (req,res,next)=>{
    // the valide the format of user
    const validation = await validateUser((req.body))
    if (validation.error){
        //render the error message
        next(JSON.stringify({path:'/admin/user-add',message:validation.error.details[0].message}))
    }else {
        //to judge if the user is exits
        let user = await User.findOne({email:req.body.email})
        if (user){
            //render the error message
            next(JSON.stringify({path:'/admin/user-add',message:'the email is exist'}))
        }else{
            // create salt for password
            const salt = await bcrypt.genSalt(10)
            // erypt the password
            const password = await bcrypt.hash(req.body.password,salt)
            req.body.password = password
            // create new user in database
            await User.create(req.body)
            res.redirect('/admin/adminPage')
        }
    }
}