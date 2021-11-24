// Connecting to ROS
var ros = new ROSLIB.Ros({
    url : 'ws://192.168.1.138:9090'
//    url : 'ws://10.64.42.172:9090'
});
//判断是否连接成功并输出相应的提示消息到web控制台
ros.on('connection', function() {
    console.log('Connected to websocket server.');
});
ros.on('error', function(error) {
    console.log('Error connecting to websocket server: ', error);
});
ros.on('close', function() {
    console.log('Connection to websocket server closed.');
});
// Publishing a Topic
//创建一个topic,它的名字是'/cmd_vel',,消息类型是'geometry_msgs/Twist'
var cmdVel = new ROSLIB.Topic({
    ros : ros,
    name : '/cmd_vel',
    messageType : 'geometry_msgs/Twist'
});
//创建一个message
var twist = new ROSLIB.Message({
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

function funcStop()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}

function funcNormalForward()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.1;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
function funcNormalBack()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = -0.1;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
function funcNormalRight()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = -0.1;
    cmdVel.publish(twist);//发布twist消息
}
function funcNormalLeft()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.1;
    cmdVel.publish(twist);//发布twist消息
}
function funcAccForward()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 1.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
function funcAccBack()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = -1.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = 0.0;
    cmdVel.publish(twist);//发布twist消息
}
function funcAccRight()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angular.y = 0.0;
    twist.angular.z = -1.0;
    cmdVel.publish(twist);//发布twist消息
}
function funcAccLeft()//在点击”Publish”按钮后发布消息，并对消息进行更改
{
    twist.linear.x = 0.0;
    twist.linear.y = 0.0;
    twist.linear.z = 0.0;
    twist.angular.x = 0.0;
    twist.angu
    twist.angular.z = 1.0;
    cmdVel.publish(twist);//发布twist消息
}
// Subscribing to a Topic
var listener = new ROSLIB.Topic({
    ros : ros,
    name : '/chatter',
    messageType : 'std_msgs/String'
});//创建一个topic,它的名字是'/chatter',,消息类型是'std_msgs/String'
function subscribe()//在点击”Subscribe”按钮后订阅'/chatter'的消息，并将其显示到网页中
{
    listener.subscribe(function(message) {
        document.getElementById("output").innerHTML = ('Received message on ' + listener.name + ': ' + message.data);
    });
}
function unsubscribe()//在点击”Unsubscribe”按钮后取消订阅'/chatter'的消息
{
    listener.unsubscribe();
}
function init() {
    // Create the main viewer.
    var viewer = new ROS2D.Viewer({
        divID : 'nav',
        width : 400,
        height : 400
    });

    // Setup the nav client.
    var nav = NAV2D.OccupancyGridClientNav({
        ros : ros,
        rootObject : viewer.scene,
        viewer : viewer,
        serverName : '/move_base'
    });

    // Create the main viewer.
    var viewer = new MJPEGCANVAS.Viewer({
        divID : 'mjpeg',
        //host : 'localhost',
        host: '192.168.1.138',
        //host: '10.64.42.172',
        port : 8080,
        width : 400,
        height : 400,
    //    topic : '/optris/thermal_image_view',
        topic : '/camera/color/image_raw',
    });
}