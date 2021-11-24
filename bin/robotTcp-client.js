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

let actionName = 'move_base_msgs/MoveBaseAction';

// setup topic for robot movement
let cmdVel = new ROSLIB.Topic({
    ros : ros,
    name : '/cmd_vel',
    messageType : 'geometry_msgs/Twist'
});
//setup message for robot velocity and angular control
let twist = new ROSLIB.Message({
    linear : {
        x : 0.0,
        y : 0.0,
        z : 0.0
    },
    angular : {
        x : 0.0,
        y : 0.0,
        z : 0.0
    }
});

//setup topic for publish destination
let goalTopic = new ROSLIB.Topic({
    ros : ros,
    name: '/move_base/goal',
    messageType : 'move_base_msgs/MoveBaseActionGoal'
})

let goalMessage = new ROSLIB.Message({
    goal_id : {
        stamp : {
          secs : 0,
          nsecs : 0
        },
        id : ''
    },
    goal: {
        target_pose: {
            header : {
                frame_id: '/map'
            },
            pose : ''
        }
    }
});

// setup a listener for the robot pose
let poseListener = new ROSLIB.Topic({
    ros: ros,
    name: '/robot_pose',
    messageType: 'geometry_msgs/Pose',
    throttle_rate: 100
});

//construct the objective for the TCP client
let client = new net.Socket();
//connect to TCP server
//client.connect(9003, '35.222.89.72', function () {
client.connect(9003, '127.0.0.1', function () {
    console.log('tcp-client Connected.');
    // send IP address to Tcp server to arrange corresponding socket
    client.write('Robot1')
    // send data to Tcp server
    poseListener.subscribe(function(message) {
        client.write(JSON.stringify(
            message
        ));
    });
});

//receive data from Tcp server through corresponding socket
client.on('data', function (data) {
    console.log('robot tcp-client received: ' + data);
    if (JSON.parse(data).label === "P"){
        funcStop();
    }
    if (JSON.parse(data).label === "+"){
        funcNormalForward();
    }
    if (JSON.parse(data).label === "++"){
        funcAccForward();
    }
    if (JSON.parse(data).label === "-"){
        funcNormalBack();
    }
    if (JSON.parse(data).label === "--"){
        funcAccBack();
    }
    if (JSON.parse(data).label === ">"){
        funcNormalRight();
    }
    if (JSON.parse(data).label === ">>"){
        funcAccRight();
    }
    if (JSON.parse(data).label === "<"){
        funcNormalLeft();
    }
    if (JSON.parse(data).label === "<<"){
        funcAccLeft();
    }
    if (JSON.parse(data).label === 'goal'){
        funcGoal(JSON.parse(data).goal)
    }
});

client.on('close', function () {
    console.log('Connection closed.');
});

client.on('error', (err) => {
    console.error(err)
})

function funcStop()
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot normal moveForward
function funcNormalForward()
{
    twist.linear.x = 0.2;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    //发布twist消息
    cmdVel.publish(twist);
}
//function defined for robot normal moveBack
function funcNormalBack()
{
    twist.linear.x = -0.2;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot turn Right
function funcNormalRight()
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = -0.2;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot turn Left
function funcNormalLeft()
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.2;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot accelerate moveForward
function funcAccForward()
{
    twist.linear.x = 0.4;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot accelerate moveBack
function funcAccBack()
{
    twist.linear.x = -0.4;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot accelerate turn Right
function funcAccRight()
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = -0.4;
    cmdVel.publish(twist);//发布twist消息
}
//function defined for robot accelerate turn Left
function funcAccLeft()
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.4;
    cmdVel.publish(twist);//发布twist消息
}
//function define message for robot goal
function funcGoal(pose)
{
    goalMessage.goal.target_pose.pose = pose;
    goalTopic.publish(goalMessage);
}
