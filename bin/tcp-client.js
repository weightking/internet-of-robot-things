const net = require('net');

let client = new net.Socket();

function init() {
  client.connect(9003, '127.0.0.1', function() {
    console.log('tcp-client Connected.');
    // 先发送设备id
    client.write('Sensor1')
    //定时发送随机数
    let interval = setInterval(()=>{
      if(!client.destroyed){
        let value1 = (20+Math.random()*10).toFixed(2)
        let value2 = (20+Math.random()*10).toFixed(2)
        client.write(String([value1,value2]))
      }
      else{
        clearInterval(interval)
      }

    },1000)
  });

  client.on('data', function(data) {
    console.log('tcp-client received: ' + data);
  });

  client.on('close', function() {
    console.log('Connection closed.');
  });

  client.on('error',(err)=>{
		console.error(err)
	})
}

module.exports={init:init}

