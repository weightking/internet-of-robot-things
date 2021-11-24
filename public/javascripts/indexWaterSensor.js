// 获取当前host，用于提供url以建立websocket
const host = window.location.host
// 从当前网址里获取设备id ,比如 https://127.0.0.1/equipmentId/789 分析得到设备ID为789，若没有则为123456
let equipmentId = window.location.pathname.split("/")[3] || "123456"

// 创建websocket连接
const socket = new WebSocket('ws://'+host);
// 如果是部署到服务器并配置了SSL证书，应该使用wss协议
// const socket = new WebSocket('wss://'+host);

// 如果建立连接
socket.onopen=function () {
    console.log("websocket connect!")
    let data = JSON.stringify({equipmentId:equipmentId})
    socket.send(data)
}

// 监听接收数据
socket.onmessage=function (msg) {
    console.log("receive:",msg.data)
    try {
        // 将JSON字符串反转为JSON对象
        let data = JSON.parse(msg.data)
        data.forEach(function (d) {
            //将接收到的数据 更新到echart图表里
            updateMyChart(d.time,d.value)
        });
    } catch (error) {
        console.log('error:',error)
    }
}

socket.onclose=function () {
    console.log("websocket close.")
}

socket.onerror=function () {
    console.log("websocket error:",event)
}

// 基于准备好的dom，初始化echarts实例
let myChart = echarts.init(document.getElementById('main'));
let myChart1 = echarts.init(document.getElementById('main1'));
let myChart2 = echarts.init(document.getElementById('main2'));
let myChart3 = echarts.init(document.getElementById('main3'));
// 指定图表的配置项和数据
let option = {
    title: {
        text: 'Water Level (cm)'
    },
    xAxis: {
        type: 'category',
        name: 'time',
        data: []
    },
    yAxis: {
        type: 'value',
        min: '0.0',
        max: '4.0',
    },
    series: [{
        data: [],
        type: 'line',
        smooth: true
    }]
};
let option1 = {
    title: {
        text: 'Water Level (cm)'
    },
    xAxis: {
        type: 'category',
        name: 'time',
        data: []
    },
    yAxis: {
        type: 'value',
        min: '0.0',
    },
    series: [{
        data: [],
        type: 'line',
        smooth: true
    }]
};
let option2 = {
    title: {
        text: 'Water flow rate (L/min)'
    },
    xAxis: {
        type: 'category',
        name: 'time',
        data: []
    },
    yAxis: {
        type: 'value',
        min: '0.0',
    },
    series: [{
        data: [],
        type: 'line',
        smooth: true
    }]
};
let option3 = {
    color:'#fff',
    title: {
        text: 'Total litres (L)'
    },
    xAxis: {
        type: 'category',
        name:'time',
        data: []
    },
    yAxis: {
        type: 'value',
        min: '0.0',
    },
    series: [{
        data: [],
        type: 'line',
        smooth: true
    }]
};
// 使用刚指定的配置项和数据显示图表。
myChart.setOption(option);
myChart1.setOption(option1);
myChart2.setOption(option2);
myChart3.setOption(option3);
// 给echart插入新数据
function updateMyChart(time,value) {
    //如果value不是数值则跳过
    // if(!$.isNumeric(value)){
    //   return ;
    // }

    option.xAxis.data.push(time)
    option.series[0].data.push(value[0])
    option1.xAxis.data.push(time)
    option1.series[0].data.push(value[1])
    option2.xAxis.data.push(time)
    option2.series[0].data.push(value[2])
    option3.xAxis.data.push(time)
    option3.series[0].data.push(value[3])

    // 如果数据超过10个，把第一个数据删除。
    if(option.xAxis.data.length > 10){
        option.xAxis.data.shift()
        option.series[0].data.shift()
    }
    if(option1.xAxis.data.length > 10){
        option1.xAxis.data.shift()
        option1.series[0].data.shift()
    }
    if(option2.xAxis.data.length > 10){
        option2.xAxis.data.shift()
        option2.series[0].data.shift()
    }
    if(option3.xAxis.data.length > 10){
        option3.xAxis.data.shift()
        option3.series[0].data.shift()
    }
    myChart.setOption(option);
    myChart1.setOption(option1);
    myChart2.setOption(option2);
    myChart3.setOption(option3);
}

//请求历史数据
// $.get('/history/'+equipmentId,function (data) {
//     console.log("history:",data)
//     // data.forEach(function (v) {
//     //   updateMyChart(v.time,v.value)
//     // })
// })