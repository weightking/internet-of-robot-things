const {User} = require('../../model/user')

module.exports = async (req,res)=>{
    req.app.locals.currentLink='user'
    const id = req.query.id
    let user = await User.findOne({_id:id})
    res.render('user-edit',{
        user
    })
}