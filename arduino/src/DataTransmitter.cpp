#include "DataTransmitter.h"

void DataTransmitter::begin() {
    // Initialize any necessary components for data transmission
    // For now, we'll just use Serial, which is already initialized in main.cpp
}

void DataTransmitter::sendData(float dryBulbTemp, float wetBulbTemp, float relativeHumidity, float dewPoint, float absoluteHumidity, float partialPressure, float specificVolume, float enthalpy) {
    // Send data in CSV format with increased precision
    String dataString = String(dryBulbTemp, 2) + "," +
                       String(wetBulbTemp, 2) + "," +
                       String(relativeHumidity, 4) + "," +
                       String(dewPoint, 2) + "," +
                       String(absoluteHumidity, 5) + "," +
                       String(partialPressure, 2) + "," +
                       String(specificVolume, 3) + "," +
                       String(enthalpy, 2);

    // Send data over Serial
    Serial.println(dataString);
}
