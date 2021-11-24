#define trigPin D7
#define echoPin D8

long duration;
int distance;

void setup() {
  // put your setup code here, to run once:
  pinMode(trigPin,OUTPUT);
  pinMode(echoPin,INPUT);
  Serial.begin(9600);
}

void loop() {
  // put your main code here, to run repeatedly:
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
  Serial.print("Distance: ");
  Serial.println(distance);
  delay(2000);
}
