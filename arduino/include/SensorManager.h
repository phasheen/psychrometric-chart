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

private:
    OneWire oneWire;
    DallasTemperature sensors;
    DeviceAddress dryBulbAddress, wetBulbAddress;
    void printAddress(DeviceAddress deviceAddress);
};

#endif
