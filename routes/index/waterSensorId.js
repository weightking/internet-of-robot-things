module.exports = (req, res, next)=>{
    req.app.locals.currentLink = 'water'
    res.render('indexWaterSensor', { title: 'Water sensors-'+req.params.id });
}