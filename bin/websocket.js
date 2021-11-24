const WebSocket = require('ws');
const moment = require('moment')
const wsList = []
//Define the mapData as global variable to make other modules to modify the data
class Foo {
  constructor({mapData}={mapData:''}) {
    this.mapData = mapData
  }
}

function deleteWebsocket(ws) {
  let wsIndex;
  wsList.forEach((v,index)=>{
    if(v.ws === ws){
      wsIndex = index
    }
  })
  // 删除ws
  if(wsIndex){
    wsList.splice(wsIndex,1)
    console.log("deleteWebsocket:",ws.ip)
  }
}

function addWebsocket(equipmentId,ws) {
  wsList.push({equipmentId:equipmentId,ws:ws})
}

//send data from websocket server to websocket client
//the data come from the tcp client
function sendData(equipmentId,data) {
  let msg
  // 捕捉 JSON序列化时的异常
  try{
    msg = JSON.stringify([{time:moment().format('mm:ss'),value:data}])
  }
  catch(err){
    return console.log("JSON.stringify err:",err)
  }
  wsList.forEach((v)=>{
    if(v.equipmentId === equipmentId){
      if(v.ws.readyState === WebSocket.OPEN){
        v.ws.send(msg)
      }
      else{
        // 将不在连接状态的websocket删除
        return deleteWebsocket(v.ws)
      }
    }
  })
}

function sendRobotData(equipmentId,data) {
  wsList.forEach((v)=>{
    if(v.equipmentId === equipmentId){
      if(v.ws.readyState === WebSocket.OPEN){
        v.ws.send(data)
      }
      else{
        // 将不在连接状态的websocket删除
        return deleteWebsocket(v.ws)
      }
    }
  })
}
// initial websocket server
function init(server) {
  const wss = new WebSocket.Server({ server });
  wss.on('connection', (ws,req)=>{
    ws.ip = req.connection.remoteAddress;
    console.log("websocket connection.  IP:",ws.ip)
    //receive the data from websocket client and arrange the socket corresponding to websocket client
    ws.on('message', (message)=>{
      console.log('websocket received: %s', message);
      // ws.send('echo:'+message);
      try {
        // 将JSON字符串反转为JSON对象
        let data = JSON.parse(message)
        if(data.equipmentId){
          addWebsocket(data.equipmentId,ws)
        }
        //Send message to browser once the websocket connection
        if (data.equipmentId == "Robot1RosTopic") {
          ws.send(Foo.mapData)
        }
      } catch (error) {
        console.log('websocket received error:',error)
      }
    });
    ws.on('close',()=>{
      deleteWebsocket(ws)
      console.log('websocket close.')
    })

    ws.on('error',(err)=>{
      deleteWebsocket(ws)
      console.log('websocket error.',err)
    })
  });
}

module.exports = {
  init:init,
  sendData:sendData,
  sendRobotData:sendRobotData,
  foo: Foo
}