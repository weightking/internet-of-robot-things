// get current host to support url to construct websocket
const host = window.location.host
// get id from current web address
let equipmentId = window.location.pathname.split("/")[3] || "123456"
let equipmentVideo = equipmentId+"Video"
let equipmentSensor1 = 'Sensor1'
let equipmentSensor3 = 'Sensor3'

// construct websocket connection
const socket = new WebSocket('ws://'+host);
const socket1 = new WebSocket('ws://'+host);
const socket2 = new WebSocket('ws://'+host);
const socket3 = new WebSocket('ws://'+host);

//Specify the received binary data format
socket2.binaryType = 'arraybuffer'

// construct websocket connection
socket.onopen=function () {
    console.log("websocket connect!")
    let data = JSON.stringify({equipmentId:equipmentSensor1})
    socket.send(data)
}

socket1.onopen=function () {
    console.log("websocket connect!")
    let data = JSON.stringify({equipmentId:equipmentId})
    //send Id to websocket server to arrange corresponding socket
    socket1.send(data)
}

socket2.onopen=function () {
    console.log("websocket connect!")
    let data = JSON.stringify({equipmentId:equipmentVideo})
    //send Id to websocket server to arrange corresponding socket
    socket2.send(data)
}

socket3.onopen=function () {
    console.log("websocket connect!")
    let data = JSON.stringify({equipmentId:equipmentSensor3})
    //send Id to websocket server to arrange corresponding socket
    socket3.send(data)
}

$.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Star'})})
navigationModel = null;

socket.onmessage = function (msg) {
    try {
        // 将JSON字符串反转为JSON对象
        let data = JSON.parse(msg.data)
        data.forEach(function (d) {
            //将接收到的数据 更新到echart图表里
            if (d.value[1]>25 && navigationModel === 'Monitor'){
                $('#Navigation-Process-Pump1').css('background','red');
                $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Pump'})})
            }
            if (d.value[1]<=25 && navigationModel === 'Monitor'){
                $('#Navigation-Process-Pump1').css('background','');
            }
        });
    } catch (error) {
        console.log('error:',error)
    }
}

socket3.onmessage = function (msg) {
    try {
        // 将JSON字符串反转为JSON对象
        let data = JSON.parse(msg.data)
        data.forEach(function (d) {
            if (d.value[0]>1 && navigationModel === 'Monitor'){
                $('#Navigation-Reactor').css('background','red');
                $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Reactor'})})
            }
            // if (d.value[0]<=1 && navigationModel === 'Monitor'){
            //     $('#Navigation-Reactor').css('background','');
            // }
        });
    } catch (error) {
        console.log('error:',error)
    }
}

socket1.onmessage = function (msg) {
    console.log(msg.data.toString('ascii'))
    command = msg.data.toString('ascii')
    if (command==='Autonomous'){
        $('#Navigation-Monitor').css('background','')
        $('#Navigation-Autonomous').css('background','red')
        $('#Navigation-Manually').css('background','')
        navigationModel = command
        $('#PowerOn-Spot').css('background','')
        $('#StandUp-Spot').css('background','');
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','');
    }
    if (command === 'Monitor'){
        $('#Navigation-Monitor').css('background','red')
        $('#Navigation-Autonomous').css('background','')
        $('#Navigation-Manually').css('background','')
        navigationModel = command
        $('#PowerOn-Spot').css('background','')
        $('#StandUp-Spot').css('background','');
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','');
    }
    if (command==='Manually'){
        $('#Navigation-Monitor').css('background','')
        $('#Navigation-Autonomous').css('background','')
        $('#Navigation-Manually').css('background','red')
        $('#Navigation-Reactor').css('background','');
        $('#Navigation-Process-Pump1').css('background','');
        navigationModel = command
    }
    if (command==='PowerOn'){
        $('#PowerOn-Spot').css('background','red')
    }
    if (command==='PowerOff'){
        $('#PowerOn-Spot').css('background','');
    }
    if (command==='Standing'){
        $('#StandUp-Spot').css('background','red');
    }
    if (command==='Sitting'){
        $('#StandUp-Spot').css('background','');
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','');
    }
    if (command==='StandNormal'){
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','red');
    }
    if (command==='StandHigher'){
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','red');
        $('#StandNormal-Spot').css('background','');
    }
    if (command==='StandLower'){
        $('#StandLower-Spot').css('background','red');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','');
    }
    if (command==='ReactorArrive'){
        $('#Navigation-Reactor').css('background','');
    }
    if (command==='PumpArrive'){
        $('#Navigation-Process-Pump1').css('background','');
    }
    if (command==='OriginArrive'){
        $('#Origin').css('background','');
    }
    if (command==='Reset'){
        $('#Navigation-Monitor').css('background','')
        $('#Navigation-Autonomous').css('background','')
        $('#Navigation-Manually').css('background','')
        $('#PowerOn-Spot').css('background','')
        $('#StandUp-Spot').css('background','');
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','');
    }
    if (command==='autonomous_state') {
        $('#Navigation-Autonomous').css('background','')
        $('#Navigation-Manually').css('background','red')
        $('#PowerOn-Spot').css('background','red')
        $('#StandUp-Spot').css('background','red');
        $('#StandLower-Spot').css('background','');
        $('#StandHigher-Spot').css('background','');
        $('#StandNormal-Spot').css('background','red');
    }
}

//window onload init
/*window.onload = MJPEGCANVAS({
    divID: 'mjpeg',
    width: 320,
    height: 240,
    imageWidth: imageWidth,
    imageHeight: imageHeight
})*/

viewer1 = new MJPEGCANVAS({
    divID: 'mjpeg',
    width: 320,
    height: 240,
})

IMAGECANVAS(viewer1,640,480)

socket1.onclose=function () {
    console.log("websocket close.")
}

socket1.onerror=function () {
    console.log("websocket error:",event)
}

//post request for spot movement
$('#Park-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'P'})})
})
$('#MoveForward-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'+'})})
})
$('#StandHigher-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'H'})})
})
$('#MoveBackward-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'-'})})
})
$('#StandLower-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'L'})})
})
$('#StrafeRight-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>'})})
})
$('#TurnRight-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>>'})})
})
$('#StrafeLeft-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<'})})
})
$('#TurnLeft-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<<'})})
})
$('#SpeedIncrease-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'++'})})
})
$('#SpeedDecrease-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'--'})})
})
$('#StandUp-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Stand'})})
})
$('#SitDown-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Sit'})})
})
$('#PowerOn-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'PowerOn'})})
})
$('#PowerOff-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'PowerOff'})})
})
$('#StandNormal-Spot').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'StandNormal'})})
})
//post request for spot image source
$('#FrontLeftImage-Spot').click(function () {
    $.post('/admin/device/'+equipmentVideo,{action:JSON.stringify({label:'frontleft_fisheye_image'})})
    IMAGECANVAS(viewer1,480,640)
})
$('#FrontRightImage-Spot').click(function () {
    $.post('/admin/device/'+equipmentVideo,{action:JSON.stringify({label:'frontright_fisheye_image'})})
    IMAGECANVAS(viewer1,480,640)
})
$('#LeftImage-Spot').click(function () {
    $.post('/admin/device/'+equipmentVideo,{action:JSON.stringify({label:'left_fisheye_image'})})
    IMAGECANVAS(viewer1,640,480)
})
$('#RightImage-Spot').click(function () {
    $.post('/admin/device/'+equipmentVideo,{action:JSON.stringify({label:'right_fisheye_image'})})
    IMAGECANVAS(viewer1,640,480)
})
$('#BackImage-Spot').click(function () {
    $.post('/admin/device/'+equipmentVideo,{action:JSON.stringify({label:'back_fisheye_image'})})
    IMAGECANVAS(viewer1,640,480)
})
//post request for spot navigation
$('#Navigation-Monitor').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Monitor'})})
})
$('#Navigation-Autonomous').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Autonomous'})})
})
$('#Navigation-Manually').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Manually'})})
})
$('#Navigation-Reactor').click(function () {
    if(navigationModel=='Autonomous')
        $('#Navigation-Reactor').css('background','red');
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Reactor'})})
})
$('#Navigation-Process-Pump1').click(function () {
    if(navigationModel=='Autonomous')
        $('#Navigation-Process-Pump1').css('background','red');
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Pump'})})
})
$('#Origin').click(function () {
    if(navigationModel=='Autonomous')
        $('#Origin').css('background','red');
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Origin'})})
})
$('#Reset').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Reset'})})
})
$('#Acknowledge').click(function () {
    $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Acknowledge'})})
})
// keyboard press robot operation
$(document).keydown(function(event){
    // p keydown
    if(event.keyCode == 80){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'P'})})
    }
    // w keydown
    if(event.keyCode == 87){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'+'})})
    }
    // up arrow keydown
    if(event.keyCode == 38){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'H'})})
    }
    // s keydown
    if(event.keyCode == 83){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'-'})})
    }
    // down arrow keydown
    if(event.keyCode == 40){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'L'})})
    }
    // D keydown
    if(event.keyCode == 68){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>'})})
    }
    // e keydown
    if(event.keyCode == 69){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'>>'})})
    }
    // a keydown
    if(event.keyCode == 65){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<'})})
    }
    // q keydown
    if(event.keyCode == 81){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'<<'})})
    }
    // I keydown
    if(event.keyCode == 73){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'++'})})
    }
    // K keydown
    if(event.keyCode == 75){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'--'})})
    }
    // f keydown
    if(event.keyCode == 70){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Stand'})})
    }
    // v keydown
    if(event.keyCode == 86){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'Sit'})})
    }
    // L keydown
    if(event.keyCode == 76){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'PowerOn'})})
    }
    // J keydown
    if(event.keyCode == 74){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'PowerOff'})})
    }
    // M keydown
    if(event.keyCode == 77){
        $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'StandNormal'})})
    }
})
// keyboard up to park robot
// $(document).keyup(function(event){
//     if(event.keyCode){
//         $.post('/admin/device/'+equipmentId,{action:JSON.stringify({label:'P'})})
//     }
// })

function MJPEGCANVAS(options){
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
}

function IMAGECANVAS(option,imgWidth,imgHeight) {
    let context = option.canvas.getContext('2d');
    //create a new canvas
    const can = document.createElement('canvas')
    can.width = imgWidth
    can.height = imgHeight
    //get the canvas context
    const ctx = can.getContext('2d')
    //get the canvas imageData
    const imgData = ctx.createImageData(can.width,can.height)
    const data = imgData.data
    let stringLength = 0
    let i = 0
    let index = false
    socket2.onmessage = function (msg) {
        // define the typeArray to read the buffer data
        let view = new Uint8Array(msg.data)
        // To make sure it has a whole image shown in cavas.
        if (index === true) {
            // image fragment data length
            stringLength += view.length
            // input buffer binary data in the canvas
            if (stringLength < can.width * can.height) {
                for (let j = 0; j < view.length; j++) {
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = 255; // alpha
                }
            } else if (stringLength >= can.width * can.height) {
                let difference = stringLength - can.width * can.height
                for (let j = 0; j < view.length - difference; j++) {
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = 255; // alpha
                }
                ctx.putImageData(imgData, 0, 0)
                context.drawImage(can, 0, 0, option.width, option.height)
                i = 0
                stringLength = difference
                for (let j = view.length - difference; j < view.length; j++) {
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = view[j]
                    data[i++] = 255; // alpha
                }
            }
        }
        if (view.length === 0){
            index = true
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