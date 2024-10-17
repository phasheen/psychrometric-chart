#include <Arduino.h>
#include "SensorManager.h"
#include "EnvironmentalCalculations.h"
#include "DataTransmitter.h"

SensorManager sensorManager;
EnvironmentalCalculations envCalc;
DataTransmitter dataTransmitter;

void setup() {
    Serial.begin(9600);
    sensorManager.begin();
    dataTransmitter.begin();
}

void loop() {
    // Read sensor data
    float dryBulbTemp = sensorManager.getDryBulbTemperature();
    float wetBulbTemp = sensorManager.getWetBulbTemperature();

    // Perform calculations
    float relativeHumidity = envCalc.calculateRelativeHumidity(dryBulbTemp, wetBulbTemp);
    float dewPoint = envCalc.calculateDewPoint(dryBulbTemp, relativeHumidity);
    float absoluteHumidity = envCalc.calculateAbsoluteHumidity(dryBulbTemp, relativeHumidity);

    // Transmit data
    dataTransmitter.sendData(dryBulbTemp, wetBulbTemp, relativeHumidity, dewPoint, absoluteHumidity);

    // Wait before next reading
    delay(2000);
}
