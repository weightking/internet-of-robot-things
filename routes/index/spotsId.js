module.exports = (req,res)=>{
    req.app.locals.currentLink = 'spot'
    res.render('spotOperation',{ title: 'Boston Dynamic Spot Operation System'})
}