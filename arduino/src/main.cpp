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
    // Read sensor data from the sensors
    float dryBulbTemp = sensorManager.getDryBulbTemperature();
    float wetBulbTemp = sensorManager.getWetBulbTemperature();

    // Perform calculations
    float relativeHumidity = envCalc.calculateRelativeHumidity(dryBulbTemp, wetBulbTemp);
    float dewPoint = envCalc.calculateDewPoint(dryBulbTemp, relativeHumidity);
    float absoluteHumidity = envCalc.calculateAbsoluteHumidity(dryBulbTemp, relativeHumidity);
    float partialPressure = envCalc.calculatePartialPressure(dryBulbTemp, relativeHumidity);
    float specificVolume = envCalc.calculateSpecificVolume(dryBulbTemp, absoluteHumidity);
    float enthalpy = envCalc.calculateEnthalpy(dryBulbTemp, absoluteHumidity);

    // Send data in a specific format that starts with "DATA:" to distinguish it from debug output
    Serial.print("DATA:");
    Serial.print(dryBulbTemp); Serial.print(",");
    Serial.print(wetBulbTemp); Serial.print(",");
    Serial.print(relativeHumidity); Serial.print(",");
    Serial.print(dewPoint); Serial.print(",");
    Serial.print(absoluteHumidity); Serial.print(",");
    Serial.print(partialPressure); Serial.print(",");
    Serial.print(specificVolume); Serial.print(",");
    Serial.println(enthalpy);

    // Debug output (optional)
    Serial.println("Environmental Calculations Results:");
    Serial.print(" - Absolute Humidity: "); Serial.print(absoluteHumidity); Serial.println(" kg/kg");
    Serial.print(" - Relative Humidity: "); Serial.print(relativeHumidity); Serial.println(" (fraction)"); 
    Serial.print(" - Partial Pressure of Humid Air: "); Serial.print(partialPressure); Serial.println(" Pa");
    Serial.print(" - Specific Volume: "); Serial.print(specificVolume); Serial.println(" m^3/kg");
    Serial.print(" - Enthalpy: "); Serial.print(enthalpy); Serial.println(" kJ/kg");
    Serial.print(" - Dew-point Temperature: "); Serial.print(dewPoint); Serial.println(" °C");

    delay(2000);
}
