// get current host to support url to construct websocket
const host = window.location.host
// get id from current web address
let equipmentId = window.location.pathname.split("/")[3] || "123456"
let equipmentRosTopic = equipmentId+"RosTopic"
let equipmentVideo = equipmentId+"Video"

// construct websocket connection
const socket = new WebSocket('ws://'+host);
const socket1 = new WebSocket('ws://'+host);
const socket2 = new WebSocket('ws://'+host);
//Specify the received binary data format
socket2.binaryType = 'arraybuffer'

// construct websocket connection
socket.onopen=function () {
    console.log("websocket connect!")
    let data1 = JSON.stringify({equipmentId:equipmentRosTopic})
    //send Id to websocket server to arrange corresponding socket
    socket.send(data1)
}

socket1.onopen=function () {
    console.log("websocket connect!")
    let data1 = JSON.stringify({equipmentId:equipmentId})
    //send Id to websocket server to arrange corresponding socket
    socket1.send(data1)
}

socket2.onopen=function () {
    console.log("websocket connect!")
    let data1 = JSON.stringify({equipmentId:equipmentVideo})
    //send Id to websocket server to arrange corresponding socket
    socket2.send(data1)
}

function init() {
    let viewer = new ROS2D.Viewer({
        divID: 'nav',
        width: 300,
        height: 300
    });
    let gridClient = new OccupancyGridClient({
        rootObject : viewer.scene,
        viewer: viewer
    });
    let navigation = new Navigator({
        rootObject: viewer.scene,
        viewer: viewer
    });
    let viewer1 = new MJPEGCANVAS({
        divID: 'mjpeg',
        width: 300,
        height: 300,
    })
}
//window onload init
window.onload = init

socket.onclose=function () {
    console.log("websocket close.")
}

socket.onerror=function () {
    console.log("websocket error:",event)
}

//post request for robot movement
$('#Park-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'P'})})
})
$('#NormalMoveForward-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'+'})})
})
$('#AccMoveForward-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'++'})})
})
$('#NormalMoveBack-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'-'})})
})
$('#AccMoveBack-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'--'})})
})
$('#NormalTurnRight-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>'})})
})
$('#AccTurnRight-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>>'})})
})
$('#NormalTurnLeft-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<'})})
})
$('#AccTurnLeft-Robot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<<'})})
})
// keyboard press robot operation
$(document).keydown(function(event){
    // up arrow keydown
    if(event.keyCode == 38){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'+'})})
    }
    // I keydown
    if(event.keyCode == 73){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'++'})})
    }
    // down arrow keydown
    if(event.keyCode == 40){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'-'})})
    }
    // K keydown
    if(event.keyCode == 75){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'--'})})
    }
    // left arrow keydown
    if(event.keyCode == 37){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<'})})
    }
    // J keydown
    if(event.keyCode == 74){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<<'})})
    }
    // right arrow keydown
    if(event.keyCode == 39){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>'})})
    }
    // L keydown
    if(event.keyCode == 76){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>>'})})
    }
})
// keyboard up to park robot
$(document).keyup(function(event){
    if(event.keyCode){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'P'})})
    }
})
// function define to update the map
function OccupancyGridClient(options) {
    let that = this;
    options = options || {};
    this.viewer = options.viewer;
    this.continuous = options.continuous;
    this.rootObject = options.rootObject || new createjs.Container();

    // current grid that is displayed
    // create an empty shape to start with, so that the order remains correct.
    this.currentGrid = new createjs.Shape();
    this.rootObject.addChild(this.currentGrid);
    // work-around for a bug in easeljs -- needs a second object to render correctly
    this.rootObject.addChild(new ROS2D.Grid({size: 1}));
    socket.onmessage=function (msg) {
        // check for an old map
        let index = null;
        if (that.currentGrid) {
            index = that.rootObject.getChildIndex(that.currentGrid);
            that.rootObject.removeChild(that.currentGrid);
        }
        that.currentGrid = new ROS2D.OccupancyGrid({
            message: JSON.parse(msg.data)
        });
        if (index !== null) {
            that.rootObject.addChildAt(that.currentGrid, index);
        } else {
            that.rootObject.addChild(that.currentGrid);
        }
        //that.viewer.scaleToDimensions(that.currentGrid.width, that.currentGrid.height);
        //that.viewer.shift(that.currentGrid.pose.position.x, that.currentGrid.pose.position.y);
        //robot test from Chinese Academic department
        that.viewer.scaleToDimensions(that.currentGrid.width*0.5, that.currentGrid.height*0.5);
        that.viewer.shift(that.currentGrid.pose.position.x*0.5, that.currentGrid.pose.position.y*0.5);
    }
};
// function define to update the robot position
function Navigator(options) {
    let that = this;
    options = options || {};
    this.viewer = options.viewer;
    this.rootObject = options.rootObject || new createjs.Container();
    let withOrientation = false;
    this.goalMarker = null;
    const currentPose = new Array()
    currentPose[0]={"position":{"x":10000,"y":10000,"z":0},"orientation":{"x":0,"y":0,"z":0,"w":10000}}

    function sendGoal(pose) {
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({goal:pose,label:'goal'})})
        //create a marker for the goal
        if (that.goalMarker === null) {
            that.goalMarker = new ROS2D.NavigationArrow({
                size: 15,
                strokeSize: 1,
                fillColor: createjs.Graphics.getRGB(255, 64, 128, 0.66),
                pulse: true
            });
            that.rootObject.addChild(that.goalMarker);
        }
        that.goalMarker.x = pose.position.x;
        that.goalMarker.y = -pose.position.y;
        that.goalMarker.rotation = stage.rosQuaternionToGlobalTheta(pose.orientation);
        that.goalMarker.scaleX = 1.0 / stage.scaleX;
        that.goalMarker.scaleY = 1.0 / stage.scaleY;
    }

    this.cancelGoal = function () {
        if (typeof that.currentGoal !== 'undefined') {
            that.currentGoal.cancel();
        }
    };
    // get a handle to the stage
    let stage;
    if (that.rootObject instanceof createjs.Stage) {
        stage = that.rootObject;
    } else {
        stage = that.rootObject.getStage();
    }
    // marker for the robot
    let robotMarker = null;

    robotMarker = new ROS2D.NavigationArrow({
        size: 15,
        strokeSize: 1,
        fillColor: createjs.Graphics.getRGB(255, 128, 0, 0.66),
        pulse: true
    });
    // wait for a pose to come in first
    robotMarker.visible = false;
    this.rootObject.addChild(robotMarker);
    let initScaleSet = false;

    let updateRobotPosition = function(pose, orientation) {
        // update the robots position on the map
        robotMarker.x = pose.x;
        robotMarker.y = -pose.y;
        if (!initScaleSet) {
            robotMarker.scaleX = 1.0 / stage.scaleX;
            robotMarker.scaleY = 1.0 / stage.scaleY;
            initScaleSet = true;
        }
        // change the angle
        robotMarker.rotation = stage.rosQuaternionToGlobalTheta(orientation);
        // Set visible
        robotMarker.visible = true;
    };
    socket1.onmessage=function (msg) {
        let pose = JSON.parse(msg.data)
        updateRobotPosition(pose.position, pose.orientation);
        // judge the location of robot is same with the goal, remove the goal marker if merge
        if (Math.abs(currentPose[0].position.x-pose.position.x)<0.2
            &&Math.abs(currentPose[0].position.y-pose.position.y)<0.2
            &&Math.abs(currentPose[0].orientation.w-pose.orientation.w)<0.05)
        {
            that.rootObject.removeChild(that.goalMarker);
            that.goalMarker = null;
        }
    };
    if (withOrientation === false){
        // setup a double click listener (no orientation)
        this.rootObject.addEventListener('dblclick', function(event) {
            // convert to ROS coordinates
            let coords = stage.globalToRos(event.stageX, event.stageY);
            let pose = new ROSLIB.Pose({
                position : new ROSLIB.Vector3(coords)
            });
            sendGoal(pose);
            currentPose[0]=pose;
        });
    }
}
// function define to show the video on the canvas
function MJPEGCANVAS(options){
    let that = this;
    options = options || {};
    let divID = options.divID;
    this.width = options.width;
    this.height = options.height;
    this.quality = options.quality;
    this.refreshRate = options.refreshRate || 10;
    this.interval = options.interval || 30;
    this.invert = options.invert || false;
    let overlay = options.overlay;

    // create the canvas to render to
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.background = '#aaaaaa';
    document.getElementById(divID).appendChild(this.canvas);
    let context = this.canvas.getContext('2d');
    let drawInterval = Math.max(1 / this.refreshRate * 1000, this.interval);
    // to judge whether has a whole Image
    //create a new canvas
    const can = document.createElement('canvas')
    can.width = 320
    can.height = 240
    //get the canvas context
    const ctx = can.getContext('2d')
    //get the canvas imageData
    const imgData = ctx.createImageData(can.width,can.height)
    const data = imgData.data
    let receiveString = ''
    let stringLength = 0
    let i = 0
    socket2.onmessage = function (msg) {
        // define the typeArray to read the buffer data
        let view = new Uint8Array(msg.data)
        // image fragment data length
        stringLength+=view.length
        // input buffer binary data in the canvas
        if (stringLength<can.width*can.height*3){
            for (let j=0; j<view.length;j++){
                data[i++] = view[j]
                if ((j+1+stringLength-view.length)%3===0) {
                    data[i++] = 255; // alpha
                }
            }
        }else if(stringLength>=can.width*can.height*3){
            let difference = stringLength-can.width*can.height*3
            for (let j=0; j<view.length-difference;j++){
                data[i++] = view[j]
                if ((j+1+stringLength-view.length)%3===0) {
                    data[i++] = 255; // alpha
                }
            }
            ctx.putImageData(imgData,0,0)
            context.drawImage(can,0,0,that.width,that.height)
            i = 0
            stringLength=difference
            for (let j=view.length-difference; j<view.length; j++){
                data[i++] = view[j]
                if ((j+1)%3===0) {
                    data[i++] = 255; // alpha
                }
            }
        }

        // method 2 to display image
        // let j = 0
        // let i = 0
        // stringLength+=msg.data.length
        // if (stringLength<can.width*can.height*4){
        //     receiveString+=msg.data
        // }else if(stringLength>=can.width*can.height*4){
        //     let difference = stringLength-can.width*can.height*4
        //     receiveString+=msg.data.slice(0,msg.data.length-difference)
        //     //decode the Base64 to Unicode
        //     const inData = atob(receiveString)
        //     while (j<inData.length){
        //         //Unicode to number
        //         const w1 = inData.charCodeAt(j++)
        //         const w2 = inData.charCodeAt(j++)
        //         const w3 = inData.charCodeAt(j++)
        //         data[i++] = w1; // red
        //         data[i++] = w2; // green
        //         data[i++] = w3; // blue
        //         data[i++] = 255; // alpha
        //
        //     }
        //     ctx.putImageData(imgData,0,0)
        //     context.drawImage(can,0,0,that.width,that.height)
        //     stringLength = difference
        //     receiveString = msg.data.slice(msg.data.length-difference)
        //}
    }
}

