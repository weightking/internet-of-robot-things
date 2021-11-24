// 导入net模块:
const net = require('net')
const PORT = "9003"
const equipmentArray = []
const TIMEOUT = 100 * 1000000; // 10秒没接收到数据就断开连接
//const mongodb = require('./mongodb.js')
const websocket = require('./websocket.js')
//const tcpClient = require('./tcp-client.js')
//initial Tcp server
const server = net.createServer((socket) => {
    //connect
    let addr = socket.remoteAddress + ':' + socket.remotePort
    console.log(addr, " connected.")
    console.log(socket.address().address)
    datalength = 0
    // receive data from Tcp client and arrange corresponding socket to the connected Tcp client.
    socket.on("data", data => {
        // 接收的第一条数据为设备id
        if (!socket.id) {
            socket.id = data.toString('ascii')
            socket.addr = addr
            addEquipment(socket)
            console.log(socket.id)
        } else {
            if (socket.id === "Robot1") {
                socket.lastValue = data.toString('ascii')
                // will not send the data if occurs Sticky
                if (socket.lastValue.indexOf("}{")==-1){
                    websocket.sendRobotData(socket.id, socket.lastValue)
                }
            }else if (socket.id === 'Robot1RosTopic'){
                if (socket.lastValue){
                    socket.lastValue += data.toString('ascii')
                }else{
                    socket.lastValue = data.toString('ascii')
                }
                if (socket.lastValue.search(/\[/)!=-1 && socket.lastValue.search(/]/)!=-1){
                    //send message to browser if the websocket is already connected
                    websocket.sendRobotData(socket.id, socket.lastValue)
                    //give the mapGrid value to the global variable defined in websocket module
                    websocket.foo.mapData = socket.lastValue
                }
            } else if (socket.id === "Robot1Video") {
                console.log(data)
                socket.lastValue = data
                //transfer the buffer data to client
                websocket.sendRobotData(socket.id, socket.lastValue)
            } else if (socket.id === "Spot1"){
                socket.lastValue = data.toString('ascii')
                console.log(socket.lastValue)
                websocket.sendRobotData(socket.id, socket.lastValue)
            } else if (socket.id === "Spot1Video"){
                socket.lastValue = data
                datalength += data.length
                //send the buffer data to client
                websocket.sendRobotData(socket.id, socket.lastValue)
                if (datalength % 307200===0){
                    socket.lastValue = 0
                    websocket.sendRobotData(socket.id, socket.lastValue)
                    datalength=0
                }

               /* if (socket.lastValue){
                    socket.lastValue += data
                    datalength += data.length
                    if (datalength>=1000){
                        websocket.sendRobotData(socket.id, socket.lastValue)
                        datalength = 0
                        socket.lastValue = null
                    }
                }else {
                    socket.lastValue = data
                    datalength = data.length
                }*/
            } else {
                socket.lastValue = data.toString('ascii').split(",")
                //保存所接收到的数据
                // mongodb.insert({id: socket.id, data: socket.lastValue}, function (err) {
                //     if (err) {
                //         console.log(socket.id, "保存数据失败：", err)
                //     }
                // })
                //发送websocket消息
                websocket.sendData(socket.id, socket.lastValue)
                //VR交互
                vrControl('turnOff', 'Sensor1', data, socket);
                vrControl('turnOn', 'Sensor1', data, socket);
                vrControl('turnRight', 'Sensor1', data, socket);
                vrControl('turnLeft', 'Sensor1', data, socket);
                vrControl('Sensor1', 'temperature', socket.lastValue[1] + ' ' + '\u2103', socket);
                vrControl('Sensor1', 'humidity', socket.lastValue[0] + ' ' + '%', socket);
                vrControl('Sensor2', 'ppm', socket.lastValue[2] + '', socket);
                vrControl('Sensor2', 'ppmCorrected', socket.lastValue[3] + '', socket);
                vrControl('Sensor3', 'waterLevel', socket.lastValue[1] + '' + 'mm', socket);
                vrControl('Sensor3', 'flowRate', socket.lastValue[2] + '' + 'L/min', socket);
            }
        }
    })
    // close
    socket.on('close', () => {
        console.log(addr, socket.id, "close")
        // console.log("equipmentArray.length:",equipmentArray.length)
        deleteEquipment(socket.id, socket.addr)
    })

    socket.on('error', () => {
        console.log(addr, socket.id, "error")
        deleteEquipment(socket.id, socket.addr)
    })

    socket.setTimeout(TIMEOUT);
    // socket空闲超过一定时间，就主动断开连接。
    socket.on('timeout', () => {
        console.log(socket.id, socket.addr, 'socket timeout');
        deleteEquipment(socket.id, socket.addr)
        socket.destroy();
    });
})

server.on("error", (err) => {
    console.log(err)
})

//开启监听
server.listen({port: PORT, host: '0.0.0.0'}, () => {
    console.log('demo2 tcp server running on', server.address())
   // setTimeout(() => {
	// 	tcpClient.init()
   // }, 4000);
})

//VR设备控制
function vrControl(vrId, IotId, value,socket) {
    if (socket.id===vrId){
        let i;
        for (i = 0; i < equipmentArray.length; i++) {
            if (equipmentArray[i].id === IotId) {
                equipmentArray[i].write(value);
            }
        }
    }
}

// 给列表添加设备
function addEquipment(socket) {
    // 先从列表删除旧的同名连接
    deleteEquipment(socket.id, socket.addr)
    equipmentArray.push(socket)

}

// 从列表中删除设备
function deleteEquipment(id, addr) {
    if (!id || !addr) {
        return;
    }

    let index = null
    let i
    // 从数组中找到它的位置
    for (i = 0; i < equipmentArray.length; i++) {
        if (equipmentArray[i].id === id && equipmentArray[i].addr === addr) {
            index = i;
        }
    }
    // 从数组中删除该设备
    if (index != null) {
        equipmentArray.splice(index, 1)
    }

}

// 在列表中找到某个id、addr的设备，结果为数组，可能包含多个socket。
function findEquipment(id, addr) {
    let result = []
    let i

    for (i = 0; i < equipmentArray.length; i++) {
        if (equipmentArray[i].id === id && equipmentArray[i].addr === addr) {
            result.push(equipmentArray[i])
        }
    }
    return result
}

// 在列表中找到某个id的设备，结果为数组，可能包含多个socket。
function findEquipmentById(id) {
    let result = []
    let i

    for (i = 0; i < equipmentArray.length; i++) {
        if (equipmentArray[i].id === id) {
            result.push(equipmentArray[i])
        }
    }
    return result
}

// find corresponding socket and send data to corresponding Tcp client
function sentCommand(id, command) {
    let equipments = findEquipmentById(id)
    if (equipments.length === 0) {
        return;
    } else if
    (command === 'open') {
        equipments.forEach((socket) => {
            socket.write("1", 'ascii')
        })
    } else if
    (command === 'close') {
        equipments.forEach((socket) => {
            socket.write("0", 'ascii')
        })
    } else if
    (command === 'turn right') {
        equipments.forEach((socket) => {
            socket.write("+", 'ascii')
        })
    } else if
    (command === 'turn left') {
        equipments.forEach((socket) => {
            socket.write("-", 'ascii')
        })
    } else
        {
        equipments.forEach((socket) => {
            socket.write(command, 'ascii')
        })
    }
}

module.exports = {
    equipmentArray: equipmentArray,
    addEquipment: addEquipment,
    deleteEquipment: deleteEquipment,
    findEquipment: findEquipment,
    sentCommand: sentCommand
}