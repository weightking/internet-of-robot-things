module.exports = (req,res)=>{
    req.app.locals.currentLink='log'
    const {message} = req.query
    res.render('log-add',{
        message
    })
}