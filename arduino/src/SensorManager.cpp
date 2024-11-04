#include "SensorManager.h"

#define ONE_WIRE_BUS 2
#define DRY_BULB_SENSOR_INDEX 1
#define WET_BULB_SENSOR_INDEX 0

SensorManager::SensorManager() : oneWire(ONE_WIRE_BUS), sensors(&oneWire) {}

void SensorManager::begin() {
    sensors.begin();

    if (!sensors.getAddress(dryBulbAddress, DRY_BULB_SENSOR_INDEX)) {
        Serial.println("Unable to find address for Dry Bulb Sensor");
    }

    if (!sensors.getAddress(wetBulbAddress, WET_BULB_SENSOR_INDEX)) {
        Serial.println("Unable to find address for Wet Bulb Sensor");
    }

    Serial.print("Dry Bulb Sensor Address: ");
    printAddress(dryBulbAddress);
    Serial.println();

    Serial.print("Wet Bulb Sensor Address: ");
    printAddress(wetBulbAddress);
    Serial.println();

    sensors.setResolution(dryBulbAddress, 12);
    sensors.setResolution(wetBulbAddress, 12);
}

float SensorManager::getDryBulbTemperature() {
    sensors.requestTemperatures();
    return sensors.getTempC(dryBulbAddress);
}

float SensorManager::getWetBulbTemperature() {
    sensors.requestTemperatures();
    return sensors.getTempC(wetBulbAddress);
}

void SensorManager::printAddress(DeviceAddress deviceAddress) {
    for (uint8_t i = 0; i < 8; i++) {
        if (deviceAddress[i] < 16) Serial.print("0");
        Serial.print(deviceAddress[i], HEX);
    }
}
