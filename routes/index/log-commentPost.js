const {Comment} = require('../../model/comment')

module.exports = async (req,res) =>{
    const {content,uid,aid} = req.body
    await Comment.create({
        content: content,
        uid: uid,
        aid: aid,
        time: new Date()
    })
    res.redirect('/admin/log-comment?id='+aid)
}