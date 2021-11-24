#include <ESP8266WiFi.h>
#define SENSOR D2
#define trigPin D7
#define echoPin D8

//const char* ssid = "BT-5CCJ29";
//const char* password = "NkpPUhkK6XfthR";

const char* ssid = "TP-Link_E680";
const char* password = "23440296";

const char* host = "192.168.10.129";
//const char* host = "34.121.222.110";

const int port = 9003;//demo2 tcp 使用 9003端口

const char* id = "Sensor3";

long currentMillis = 0;
long previousMillis = 0;
int interval = 1000;
float calibrationFactor = 4.5;
volatile byte pulseCount;
byte pulse1Sec = 0;
float flowRate;
unsigned int flowMilliLitres;
unsigned long totalMilliLitres;
long duration;
int distance;

void IRAM_ATTR pulseCounter()
{
  pulseCount++;
}

WiFiClient client;

void setup()
{
  Serial.begin(9600);
  pinMode(SENSOR, INPUT_PULLUP);
  pinMode(trigPin,OUTPUT);
  pinMode(echoPin,INPUT);  
  pulseCount = 0;
  flowRate = 0.0;
  flowMilliLitres = 0;
  totalMilliLitres = 0;
  previousMillis = 0;
  attachInterrupt(digitalPinToInterrupt(SENSOR), pulseCounter, FALLING);
    
  WiFi.begin(ssid, password);
  client.setTimeout(100);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connecting...");
    delay(500);
  }
  Serial.println("WiFi connected!.");  
}

void loop()
{
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
    float val = analogRead(A0); // read input value
    float waterLevel=(val/650)*4;
    currentMillis = millis();
    if (currentMillis - previousMillis > interval) {
      pulse1Sec = pulseCount;
      pulseCount = 0;
      flowRate = ((1000.0 / (millis() - previousMillis)) * pulse1Sec) / calibrationFactor;
      previousMillis = millis();
      flowMilliLitres = (flowRate / 60) * 1000;
      totalMilliLitres += flowMilliLitres;
    }
    // Clears the trigPin
    digitalWrite(trigPin,LOW);
    delayMicroseconds(2);  
    //set trigPin as High status 10us
    digitalWrite(trigPin,HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin,LOW);   
    //read echoPin, to record the sound wave spread time
    duration = pulseIn(echoPin, HIGH);
    //calculate the distance
    distance=duration* 0.034/2;         
    String myReadout="";
    myReadout.concat(waterLevel);
    myReadout.concat(",");
    myReadout.concat(distance);
    myReadout.concat(",");
    myReadout.concat(flowRate);
    myReadout.concat(",");
    myReadout.concat(totalMilliLitres/1000.0);
    client.print(myReadout);
    delay(1000);
    Serial.print("the depth is:");
    Serial.print(waterLevel);
    Serial.println("cm");
    // Print the flow rate for this second in litres / minute
    Serial.print("Flow rate: ");
    Serial.print(int(flowRate));  // Print the integer part of the variable
    Serial.print("L/min");
    Serial.print("\t");       // Print tab space
    // Print the cumulative total of litres flowed since starting
    Serial.print("Output Liquid Quantity: ");
    Serial.print(totalMilliLitres);
    Serial.print("mL / ");
    Serial.print(totalMilliLitres / 1000);
    Serial.println("L");
    Serial.print("Distance: ");
    Serial.println(distance);
    Serial.println("cm");
  }
}
