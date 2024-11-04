#ifndef ENVIRONMENTAL_CALCULATIONS_H
#define ENVIRONMENTAL_CALCULATIONS_H

class EnvironmentalCalculations {
public:
    float calculateRelativeHumidity(float dryBulbTemp, float wetBulbTemp);
    float calculateDewPoint(float dryBulbTemp, float relativeHumidity);
    float calculateAbsoluteHumidity(float dryBulbTemp, float relativeHumidity);
    float calculatePartialPressure(float dryBulbTemp, float relativeHumidity);
    float calculateSpecificVolume(float dryBulbTemp, float absoluteHumidity);
    float calculateEnthalpy(float dryBulbTemp, float absoluteHumidity);
};

#endif
