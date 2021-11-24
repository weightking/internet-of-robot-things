module.exports = (req, res, next)=>{
    req.app.locals.currentLink = 'gas'
    res.render('indexGasQuality', { title: 'Gas quality-'+req.params.id });
}