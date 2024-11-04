#ifndef DATA_TRANSMITTER_H
#define DATA_TRANSMITTER_H

#include <Arduino.h>

class DataTransmitter {
public:
    void begin();
    void sendData(float dryBulbTemp, float wetBulbTemp, float relativeHumidity, float dewPoint, float absoluteHumidity, float partialPressure, float specificVolume, float enthalpy);
};

#endif
