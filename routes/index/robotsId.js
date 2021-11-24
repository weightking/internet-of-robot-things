/*let tcpServer = require('../../bin/tcp-server.js');*/
module.exports = (req,res)=>{
    req.app.locals.currentLink = 'robot'
    res.render('robotOperation',{ title: 'Robot Operation System'})
}