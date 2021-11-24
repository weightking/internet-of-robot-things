const {User} = require('../../model/user')

module.exports = async (req,res)=>{
    const id = req.body.id
    await User.findOneAndDelete({_id:id})
    res.redirect('/admin/adminPage')
}