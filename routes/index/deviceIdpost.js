let tcpServer = require('../../bin/tcp-server.js');
module.exports = (req,res,next)=>{
    console.log('post /led/:id - ',req.params.id,req.body);
    tcpServer.sentCommand(req.params.id,req.body.action)
    res.send({code:0,msg:'命令已发送'})
}