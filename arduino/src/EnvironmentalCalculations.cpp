#include "EnvironmentalCalculations.h"
#include <math.h>

float EnvironmentalCalculations::calculateRelativeHumidity(float dryBulb, float wetBulb) {
    // This is a simplified calculation and may not be accurate for all conditions
    // For a more accurate calculation, consider using psychrometric formulas
    float e = 2.718282;
    float es = 6.112 * pow(e, (17.67 * dryBulb) / (dryBulb + 243.5));
    float ew = 6.112 * pow(e, (17.67 * wetBulb) / (wetBulb + 243.5));
    float E = ew - 0.00066 * (1 + 0.00115 * wetBulb) * (dryBulb - wetBulb) * 1013.25;
    return (E / es) * 100;
}

float EnvironmentalCalculations::calculateDewPoint(float dryBulb, float relativeHumidity) {
    float a = 17.271;
    float b = 237.7;
    float temp = (a * dryBulb) / (b + dryBulb) + log(relativeHumidity/100);
    float Td = (b * temp) / (a - temp);
    return Td;
}

float EnvironmentalCalculations::calculateAbsoluteHumidity(float dryBulb, float relativeHumidity) {
    // Constants
    float R = 8.314472;    // Universal gas constant (J/(mol·K))
    float Mw = 0.018016;   // Molar mass of water (kg/mol)

    // Convert temperature to Kelvin
    float T = dryBulb + 273.15;

    // Calculate saturation vapor pressure
    float eso = 6.1078 * pow(10, (7.5 * dryBulb) / (237.3 + dryBulb));

    // Calculate actual vapor pressure
    float ea = (relativeHumidity / 100) * eso;

    // Calculate absolute humidity
    float absoluteHumidity = (ea * Mw) / (R * T);

    return absoluteHumidity * 1000;  // Convert to g/m³
}
