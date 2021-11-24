const {Log} = require('../../model/log')

module.exports = async (req,res)=>{
    const id = req.body.id
    await Log.findOneAndDelete({_id:id})
    res.redirect('/admin/log')
}