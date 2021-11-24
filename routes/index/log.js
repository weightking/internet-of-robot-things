const pagination = require('mongoose-sex-page')
const {Log} = require('../../model/log')

module.exports = async (req,res)=>{
    req.app.locals.currentLink = 'log'
    const page = req.query.page
    let logs = await pagination(Log).find().page(page).size(10).display(5).populate('author').exec()
    logs = JSON.stringify(logs)
    logs = JSON.parse(logs)
    res.render('log',{
        logs
    })
}