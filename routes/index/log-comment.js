const {Log} = require('../../model/log')
const {Comment} = require('../../model/comment')

module.exports = async (req,res)=>{
    req.app.locals.currentLink = 'log'
    const id = req.query.id
    let log = await Log.findOne({_id:id}).populate('author').lean()
    let comment = await Comment.find({aid:id}).populate('uid').lean()
    res.render('log-comment',{
        log,
        comment
    })
}