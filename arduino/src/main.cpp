#include <Arduino.h>
#include "SensorManager.h"
#include "EnvironmentalCalculations.h"
#include "DataTransmitter.h"

SensorManager sensorManager;
EnvironmentalCalculations envCalc;
DataTransmitter dataTransmitter;

void setup() {
    Serial.begin(9600);
    delay(1000);  // Give serial connection time to establish
    
    Serial.println("Starting setup...");
    sensorManager.begin();
    dataTransmitter.begin();
    Serial.println("Setup complete!");
}

void loop() {
    Serial.println("\n--- New Reading ---");
    
    // Request temperatures once for both sensors
    Serial.println("Requesting temperatures...");
    sensorManager.sensors.requestTemperatures();
    
    // Read sensor data
    float dryBulbTemp = sensorManager.getDryBulbTemperature();
    float wetBulbTemp = sensorManager.getWetBulbTemperature();

    // Add error checking
    if (dryBulbTemp == DEVICE_DISCONNECTED_C || wetBulbTemp == DEVICE_DISCONNECTED_C) {
        Serial.println("Error: Sensor reading failed");
        delay(2000);
        return;
    }

    Serial.print("Raw Readings - Dry: ");
    Serial.print(dryBulbTemp, 2);  // 2 decimal places
    Serial.print("°C, Wet: ");
    Serial.print(wetBulbTemp, 2);  // 2 decimal places
    Serial.println("°C");

    // Perform calculations
    float relativeHumidity = envCalc.calculateRelativeHumidity(dryBulbTemp, wetBulbTemp);
    float absoluteHumidity = envCalc.calculateAbsoluteHumidity(dryBulbTemp, wetBulbTemp);
    float dewPoint = envCalc.calculateDewPoint(dryBulbTemp, wetBulbTemp);
    float partialPressure = envCalc.calculatePartialPressure(dryBulbTemp, wetBulbTemp);
    float specificVolume = envCalc.calculateSpecificVolume(dryBulbTemp, absoluteHumidity);
    float enthalpy = envCalc.calculateEnthalpy(dryBulbTemp, absoluteHumidity);

    // Print calculated values with increased precision
    Serial.println("\nCalculated Values:");
    Serial.print("Relative Humidity: "); 
    Serial.print(relativeHumidity * 100, 2); 
    Serial.println("%");
    
    Serial.print("Absolute Humidity: "); 
    Serial.print(absoluteHumidity, 5); 
    Serial.println(" kg/kg");
    
    Serial.print("Dew Point: "); 
    Serial.print(dewPoint, 2); 
    Serial.println("°C");
    
    Serial.print("Partial Pressure: "); 
    Serial.print(partialPressure, 2); 
    Serial.println(" Pa");
    
    Serial.print("Specific Volume: "); 
    Serial.print(specificVolume, 3); 
    Serial.println(" m³/kg");
    
    Serial.print("Enthalpy: "); 
    Serial.print(enthalpy, 2); 
    Serial.println(" kJ/kg");

    // Send formatted data string with full precision
    dataTransmitter.sendData(dryBulbTemp, wetBulbTemp, relativeHumidity, 
                           dewPoint, absoluteHumidity, partialPressure, 
                           specificVolume, enthalpy);

    delay(2000);  // Wait 2 seconds before next reading
}
