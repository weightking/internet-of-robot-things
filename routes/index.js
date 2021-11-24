var express = require('express');
var router = express.Router();
//let mongodb = require('../bin/mongodb');
const moment = require('moment')

router.get('/login',require('./index/loginget'))

router.post('/login',require('./index/loginpost'))

router.get('/adminPage',require('./index/adminPage'))

router.get('/logout', require('./index/logout'))

router.get('/user-add',require('./index/user-add'))

router.post('/user-add',require('./index/user-addPost'))

router.get('/user-edit',require('./index/user-edit'))

router.post('/user-edit',require('./index/user-editPost'))

router.post('/user-delete',require('./index/user-deletePost'))

router.get('/log', require('./index/log'))

router.get('/log-add', require('./index/log-add'))

router.post('/log-add',require('./index/log-addPost'))

router.get('/log-comment',require('./index/log-comment'))

router.post('/log-comment',require('./index/log-commentPost'))

router.post('/log-delete',require('./index/log-deletePost'))

// 显示某设备数据
router.get('/robotsId/:id', require('./index/robotsId'));

router.get('/temperatureId/:id', require('./index/temperatureId'));

router.get('/gasQualityId/:id', require('./index/gasQualityId'));

router.get('/waterSensorId/:id', require('./index/waterSensorId'));

router.get('/spotsId/:id', require('./index/spotsId'));

// 获取某设备的历史数据
// GET /history/123456 取得设备id为12356的数据。
// router.get('/history/:id', function(req, res, next) {
//   mongodb.find({id:req.params.id},(err,docs)=>{
//     if(err){
//       res.send([])
//       console.log(err)
//     }
//     else{
//       let result = []
//       docs.forEach( (doc) => {
//         result.push({
//           time:moment(doc.createdAt).format('mm:ss'),
//           value:doc.data
//         })
//       });
//       result.reverse()
//       res.send(result)
//     }
//   })
// });

// send commend to IoT equipment or robot
router.post('/device/:id',require('./index/deviceIdpost'))

module.exports = router;
