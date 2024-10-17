#ifndef ENVIRONMENTAL_CALCULATIONS_H
#define ENVIRONMENTAL_CALCULATIONS_H

class EnvironmentalCalculations {
public:
    float calculateRelativeHumidity(float dryBulb, float wetBulb);
    float calculateDewPoint(float dryBulb, float relativeHumidity);
    float calculateAbsoluteHumidity(float dryBulb, float relativeHumidity);
};

#endif
