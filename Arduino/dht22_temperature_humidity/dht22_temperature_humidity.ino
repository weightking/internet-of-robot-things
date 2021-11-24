#include <DHT.h>       //调用DHT库
#include <ESP8266WiFi.h>
#include <Arduino.h>
#include <Servo.h>

//const char* ssid = "BT-5CCJ29";
//const char* password = "NkpPUhkK6XfthR";

const char* ssid = "TP-Link_E680";
const char* password = "23440296";

const char* host = "192.168.10.129";
//const char* host = "35.222.89.72";
const int port = 9003;//demo2 tcp 使用 9003端口

const char* id = "Sensor1";

WiFiClient client;
Servo servo;

DHT dht(D2,DHT22);      //设置Data引脚所接IO口和传感器类型

void setup(){ //初始化函数，只在程序开始时运行一次
  Serial.begin(9600);   //设置串口波特率
  pinMode(LED_BUILTIN, OUTPUT);
  servo.attach(02);//PWM引脚设置，与GPIO引脚号对应.
  dht.begin(); 
  WiFi.begin(ssid, password);
  client.setTimeout(100);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connecting...");
    delay(500);
  }
  Serial.println("WiFi connected!.");          
}

void loop() {
  // put your main code here, to run repeatedly:
  if (client.connect(host, port))
  {
    Serial.println("host connected!");
    //发送第一条TCP数据，发送ID号
    client.print(id);
  }
  else
  {
    // TCP连接异常
    Serial.println("host connecting...");
    delay(500);
  }
  while (client.connected()) {
    //      接收到TCP数据
    String line = client.readStringUntil('\n');
    if (line == "1") {
      Serial.println("command:open led.");
      digitalWrite(LED_BUILTIN, LOW);
    }
    else if (line == "0") {
      Serial.println("command:close led.");
      digitalWrite(LED_BUILTIN, HIGH);
    }
    else if (line =="+") {
      Serial.println("command:turn right.");
      servo.write(servo.read()+90);
    }
    else if (line =="-") {
      Serial.println("command:turn left.");
      servo.write(servo.read()-90);
    }        
    float RH = dht.readHumidity();   //读取湿度数据
    float T = dht.readTemperature();//读取温度数据
    String myReadout="";
    myReadout.concat(RH);
    myReadout.concat(",");
    myReadout.concat(T);
    //若没收到TCP数据，每隔一段时间打印并发送tick值
    client.print(myReadout);
    delay(1000);
    Serial.print("Humidity:");  //向串口打印 Humidity:
    Serial.print(RH);           //向串口打印湿度数据
    Serial.print("%");
    Serial.print("  Temperature:");
    Serial.print(T);            //向串口打印温度数据
    Serial.println("C"); 
  }
}
