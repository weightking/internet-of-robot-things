module.exports = (req,res)=>{
    req.app.locals.currentLink='user'
    const {message} = req.query
    res.render('user-add',{
        message
    })
}