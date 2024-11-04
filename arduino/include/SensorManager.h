#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

class SensorManager {
public:
    SensorManager();
    void begin();
    float getDryBulbTemperature();
    float getWetBulbTemperature();
    DallasTemperature sensors;

private:
    OneWire oneWire;
    DeviceAddress dryBulbAddress, wetBulbAddress;
    void printAddress(DeviceAddress deviceAddress);
};

#endif
