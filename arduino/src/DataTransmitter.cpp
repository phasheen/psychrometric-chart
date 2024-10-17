#include "DataTransmitter.h"

void DataTransmitter::begin() {
    // Initialize any necessary components for data transmission
    // For now, we'll just use Serial, which is already initialized in main.cpp
}

void DataTransmitter::sendData(float dryBulbTemp, float wetBulbTemp, float relativeHumidity, float dewPoint, float absoluteHumidity) {
    // Prepare data string
    String dataString = String(dryBulbTemp) + "," +
                        String(wetBulbTemp) + "," +
                        String(relativeHumidity) + "," +
                        String(dewPoint) + "," +
                        String(absoluteHumidity);

    // Send data over Serial
    Serial.println(dataString);
}
