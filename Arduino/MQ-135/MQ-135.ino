#include <MQ135.h>
#include <DHT.h>
#include <ESP8266WiFi.h>

#define ANALOGPIN A0

const char* ssid = "EE-Hub-J9Mo";
const char* password = "cud-COUGH-able";

const char* host = "192.168.1.84";
const int port = 9003;//demo2 tcp 使用 9003端口

const char* id = "Sensor2";

WiFiClient client;
DHT dht(D2,DHT22);      //设置Data引脚所接IO口和传感器类型

int PPMStatus = 0;
int PPMStatusOld = 0;

float  ppm, ppmbalanced;
int initStep=1;                 // 1 = Connection in progress / 2 = Connection Done 

MQ135 gasSensor = MQ135(ANALOGPIN);

void setup() {
  Serial.begin(9600);
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
  delay(100);
  while (client.connected()) {
    //      接收到TCP数据
     float RH = dht.readHumidity();   //读取湿度数据
     float T = dht.readTemperature();//读取温度数据
     ppm = gasSensor.getPPM(); // 取得 ppm 值
     ppmbalanced = gasSensor.getCorrectedPPM(T, RH);  // 取得修正的 ppm 值
     String myReadout="";
     myReadout.concat(RH);
     myReadout.concat(",");
     myReadout.concat(T);
     myReadout.concat(",");
     myReadout.concat(ppm);
     myReadout.concat(",");
     myReadout.concat(ppmbalanced);
     //若没收到TCP数据，每隔一段时间打印并发送tick值
     client.print(myReadout);
     delay(1000);
     Serial.print("Humidity:");  //向串口打印 Humidity:
     Serial.print(RH);           //向串口打印湿度数据
     Serial.print("%");
     Serial.print("  Temperature:");
     Serial.print(T);            //向串口打印温度数据
     Serial.println("C"); 
     Serial.print("PPM=");
     Serial.println(ppm); 
     Serial.print("PPM Corrected=");
     Serial.println(ppmbalanced); 
     Serial.println();
  } 
 }
