const guard = (req,res,next)=>{
    if (req.url!='/login' && !req.session.username){
        res.redirect('/home')
    }else {
        next()
    }
}

module.exports = guard