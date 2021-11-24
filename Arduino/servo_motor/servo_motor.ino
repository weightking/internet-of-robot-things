#include <Arduino.h>
#include <Servo.h>

Servo servo;

void setup ()
{
  Serial.begin(9600);   //设置串口波特率
  servo.attach(02);//PWM引脚设置，与GPIO引脚号对应.
}

void loop ()
{
  // To 0°
//  servo.write(0);
//  delay(1000);
//
//  // To 90°
//  servo.write(90);
//  delay(1000);
//
//  // To 180°
//  servo.write(180);
//  delay(1000);
  double a=servo.read();
  Serial.print(a);
  delay(1000);
}
