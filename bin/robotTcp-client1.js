//roslib module to connect javascript and Ros
let ROSLIB = require('roslib');
//net module for TCP client end
const net = require('net');
// Connecting to ROS
let ros = new ROSLIB.Ros({
    url : 'ws://192.168.1.139:9090'
//    url : 'ws://10.64.42.172:9090'
//    url : 'ws://10.64.22.107:9090'
});
//To confirm whether connect the server on the robot.
ros.on('connection', function() {
    console.log('Connected to websocket server.');
});
ros.on('error', function(error) {
    console.log('Error connecting to websocket server: ', error);
});
ros.on('close', function() {
    console.log('Connection to websocket server closed.');
});

// Subscribing to a Topic
let rosTopic = new ROSLIB.Topic({
    ros : ros,
    name : '/map',
    messageType : 'nav_msgs/OccupancyGrid',
    compression : 'png'
});

let client = new net.Socket();

//client.connect(9003, '35.222.89.72', function () {
client.connect(9003, '127.0.0.1', function () {
    console.log('tcp-client Connected.');
    // send IP address to Tcp server to arrange corresponding socket
    client.write('Robot1RosTopic')
    // send data to Tcp server
    rosTopic.subscribe(function(message) {
        client.write(JSON.stringify(
            message
        ));
    });
});

client.on('close', function () {
    console.log('Connection closed.');
});

client.on('error', (err) => {
    console.error(err)
})