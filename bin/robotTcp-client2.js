//roslib module to connect javascript and Ros
let ROSLIB = require('roslib');
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

// setup a listener for the robot video
let videoListener = new ROSLIB.Topic({
    ros: ros,
    name: '/camera/rgb/image_raw',
    messageType: 'sensor_msgs/Image',
    throttle_rate: 300
});

//construct the objective for the TCP client
let client = new net.Socket();
//connect to TCP server
//client.connect(9003, '35.222.89.72', function () {
client.connect(9003, '127.0.0.1', function () {
    console.log('tcp-client Connected.');
    // send IP address to Tcp server to arrange corresponding socket
    client.write('Robot1Video')
    // send data to Tcp server
    videoListener.subscribe(function(message) {
        //base64 decode to binary data
        client.write(Buffer.from(message.data,'base64'))
        //client.write(message.data)
    });
});
client.on('close', function () {
    console.log('Connection closed.');
});

client.on('error', (err) => {
    console.error(err)
})