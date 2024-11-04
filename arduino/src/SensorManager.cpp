#include "SensorManager.h"

#define ONE_WIRE_BUS 2
#define DRY_BULB_SENSOR_INDEX 1
#define WET_BULB_SENSOR_INDEX 0

SensorManager::SensorManager() : oneWire(ONE_WIRE_BUS), sensors(&oneWire) {}

void SensorManager::begin() {
    Serial.println("Initializing sensors...");
    sensors.begin();

    // Count devices
    int deviceCount = sensors.getDeviceCount();
    Serial.print("Found ");
    Serial.print(deviceCount);
    Serial.println(" devices.");

    if (!sensors.getAddress(dryBulbAddress, DRY_BULB_SENSOR_INDEX)) {
        Serial.println("ERROR: Unable to find address for Dry Bulb Sensor");
        return;
    }

    if (!sensors.getAddress(wetBulbAddress, WET_BULB_SENSOR_INDEX)) {
        Serial.println("ERROR: Unable to find address for Wet Bulb Sensor");
        return;
    }

    Serial.print("Dry Bulb Sensor Address: ");
    printAddress(dryBulbAddress);
    Serial.println();

    Serial.print("Wet Bulb Sensor Address: ");
    printAddress(wetBulbAddress);
    Serial.println();

    sensors.setResolution(dryBulbAddress, 12);
    sensors.setResolution(wetBulbAddress, 12);

    // Request initial temperature reading
    Serial.println("Requesting initial temperatures...");
    sensors.requestTemperatures();
    delay(1000); // Allow sensors to stabilize
    
    // Print initial readings
    float dryTemp = getDryBulbTemperature();
    float wetTemp = getWetBulbTemperature();
    Serial.print("Initial Dry Bulb Temperature: ");
    Serial.println(dryTemp);
    Serial.print("Initial Wet Bulb Temperature: ");
    Serial.println(wetTemp);
}

float SensorManager::getDryBulbTemperature() {
    return sensors.getTempC(dryBulbAddress);
}

float SensorManager::getWetBulbTemperature() {
    return sensors.getTempC(wetBulbAddress);
}

void SensorManager::printAddress(DeviceAddress deviceAddress) {
    for (uint8_t i = 0; i < 8; i++) {
        if (deviceAddress[i] < 16) Serial.print("0");
        Serial.print(deviceAddress[i], HEX);
    }
}
