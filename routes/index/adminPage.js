const pagination = require('mongoose-sex-page')
const {User} = require('../../model/user')

module.exports = async (req,res)=>{
    req.app.locals.currentLink = 'user'
    const page = req.query.page
    let users = await pagination(User).find().page(page).size(10).display(5).exec()
    res.render('adminPage',{
        users
    })
}