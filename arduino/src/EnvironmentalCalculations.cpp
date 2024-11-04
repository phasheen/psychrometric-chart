#include "EnvironmentalCalculations.h"
#include <math.h>

// Constants
const double P_atm = 101325;  // Atmospheric pressure (unit: Pa)
const double epsilon = 0.000005;  // Precision threshold for iteration

// Helper function to convert Celsius to Kelvin
double CtoK(double T) {
    return T + 273.15;
}

// Function to calculate saturated vapor pressure (unit: Pa)
double P_ws(double T) {
    double T_K = CtoK(T);  // Convert temperature to Kelvin
    double C1, C2, C3, C4, C5, C6, C7;

    if (T >= 0) {  // For temperatures above 0°C
        C1 = -5800.2206;
        C2 = 1.3914993;
        C3 = -0.048640239;
        C4 = 0.000041764768;
        C5 = -0.000000014452093;
        C6 = 0;
        C7 = 6.5459673;
    } else {  // For temperatures below 0°C
        C1 = -5674.5359;
        C2 = 6.3925247;
        C3 = -0.009677843;
        C4 = 0.00000062215701;
        C5 = 2.0747825E-09;
        C6 = -9.484024E-13;
        C7 = 4.1635019;
    }

    return exp(C1 / T_K + C2 + C3 * T_K + C4 * T_K * T_K + C5 * pow(T_K, 3) + C6 * pow(T_K, 4) + C7 * log(T_K));
}

// Correction factor for dry air and wet air
double coef(double P_atm, double T) {
    return 1 + 0.004 * P_atm / 101325 + pow((0.0008 * T - 0.004), 2);
}

// Function for calculating saturated absolute humidity for dry air and wet air
double H_s(double coef, double P_ws, double P_atm) {
    return 0.62198 * coef * P_ws / (P_atm - coef * P_ws);
}

// Function to calculate absolute humidity (kg of water vapor per kg of dry air)
double W_prime(double T_db, double T_wb, double H_wb) {
    if (T_db >= 0) {
        return ((2501 - 2.381 * T_wb) * H_wb - 1.006 * (T_db - T_wb)) / (2501 + 1.805 * T_db - 4.186 * T_wb);
    } else {
        return ((2501 + 1.805 * T_wb - 2.093 * T_wb + 334) * H_wb - 1.006 * (T_db - T_wb)) / 
               (2501 + 1.805 * T_db - 2.093 * T_wb + 334);
    }
}

// Function to calculate the partial pressure of humid air (Pa)
double VP(double P_atm, double W_prime, double coef_wb) {
    return P_atm * W_prime / (0.62198 + W_prime) / coef_wb;
}

// Function to calculate relative humidity
double RH(double H_db, double W_prime, double coef_db, double P_db, double P_atm) {
    double DoS = W_prime / H_db;
    return DoS / (1 - (1 - DoS) * (coef_db * P_db / P_atm));
}

// Function to calculate dew-point temperature using partial pressure
double FindDew(double P_atm, double Pw) {
    double LnPw = log(Pw / 1000.0);  // Convert pressure to kPa and take log
    double Dew = 6.54 + 14.526 * LnPw + 0.7389 * pow(LnPw, 2) + 0.09486 * pow(LnPw, 3) + 0.4569 * pow(Pw / 1000.0, 0.1984);

    // Condition for negative dew point temperatures
    if (Dew < 0) {
        Dew = 6.09 + 12.608 * LnPw + 0.4959 * pow(LnPw, 2);
    }

    // Set initial bounds for the iterative search
    double TT1 = Dew - 0.2;
    double TT2 = Dew + 0.2;

    // Iterative refinement of dew point calculation
    while (true) {
        Dew = (TT1 + TT2) / 2.0;
        double Pwsdew = P_ws(Dew);  // Saturation vapor pressure at dew point

        if (Pwsdew > Pw) {
            TT2 = Dew;
        } else {
            TT1 = Dew;
        }

        // Stop iteration when the precision threshold is met
        if (fabs(Pwsdew - Pw) / Pw <= epsilon) {
            break;
        }
    }

    return Dew;  // Return the final calculated dew point temperature
}

// EnvironmentalCalculations class methods

// Calculate relative humidity
float EnvironmentalCalculations::calculateRelativeHumidity(float dryBulbTemp, float wetBulbTemp) {
    // Calculate saturated vapor pressures
    double P_db = P_ws(dryBulbTemp);
    double P_wb = P_ws(wetBulbTemp);
    
    // Calculate correction factors
    double coef_db = coef(P_atm, dryBulbTemp);
    double coef_wb = coef(P_atm, wetBulbTemp);
    
    // Calculate saturated absolute humidity
    double H_db = H_s(coef_db, P_db, P_atm);
    double H_wb = H_s(coef_wb, P_wb, P_atm);
    
    // Calculate absolute humidity
    double W_prime_val = W_prime(dryBulbTemp, wetBulbTemp, H_wb);
    
    return (float)RH(H_db, W_prime_val, coef_db, P_db, P_atm);
}

// Calculate dew point
float EnvironmentalCalculations::calculateDewPoint(float dryBulbTemp, float wetBulbTemp) {
    // Calculate correction factor for wet bulb
    double coef_wb = coef(P_atm, wetBulbTemp);
    
    // Calculate saturated vapor pressure at wet bulb
    double P_wb = P_ws(wetBulbTemp);
    
    // Calculate saturated absolute humidity for wet bulb
    double H_wb = H_s(coef_wb, P_wb, P_atm);
    
    // Calculate absolute humidity
    double W_prime_val = W_prime(dryBulbTemp, wetBulbTemp, H_wb);
    
    // Calculate vapor pressure
    double VP_val = VP(P_atm, W_prime_val, coef_wb);
    
    return (float)FindDew(P_atm, VP_val);
}

// Calculate absolute humidity
float EnvironmentalCalculations::calculateAbsoluteHumidity(float dryBulbTemp, float wetBulbTemp) {
    // Calculate saturated vapor pressure at wet bulb
    double P_wb = P_ws(wetBulbTemp);
    
    // Calculate correction factor for wet bulb
    double coef_wb = coef(P_atm, wetBulbTemp);
    
    // Calculate saturated absolute humidity for wet bulb
    double H_wb = H_s(coef_wb, P_wb, P_atm);
    
    return (float)W_prime(dryBulbTemp, wetBulbTemp, H_wb);
}

// Calculate partial pressure
float EnvironmentalCalculations::calculatePartialPressure(float dryBulbTemp, float wetBulbTemp) {
    // Calculate correction factor for wet bulb
    double coef_wb = coef(P_atm, wetBulbTemp);
    
    // Calculate absolute humidity first
    double W_prime_val = calculateAbsoluteHumidity(dryBulbTemp, wetBulbTemp);
    
    return (float)VP(P_atm, W_prime_val, coef_wb);
}

// Calculate specific volume (m^3/kg)
float EnvironmentalCalculations::calculateSpecificVolume(float dryBulbTemp, float absoluteHumidity) {
    return (float)(0.287055 * CtoK(dryBulbTemp) * (1 + 1.6078 * absoluteHumidity) / P_atm * 1000);
}

// Calculate enthalpy (kJ/kg)
float EnvironmentalCalculations::calculateEnthalpy(float dryBulbTemp, float absoluteHumidity) {
    return (float)(1.006 * dryBulbTemp + absoluteHumidity * (2501 + 1.805 * dryBulbTemp));
}
