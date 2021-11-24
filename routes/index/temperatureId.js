module.exports = (req, res, next)=>{
    req.app.locals.currentLink = 'temperature'
    res.render('indexTemperature', { title: 'Temperature and Humidity-'+req.params.id });
}