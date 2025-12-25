/**
 * Sunrise/Sunset calculation utility
 * Uses simplified algorithm based on latitude and day of year
 */

/**
 * Calculate approximate sunrise and sunset times for a given location and date
 * Returns times in local hours (0-24)
 */
export const getSunTimes = (latitude: number, longitude: number, date: Date = new Date()): {
    sunrise: number;
    sunset: number;
    isDaytime: boolean;
} => {
    const dayOfYear = getDayOfYear(date);

    // Solar declination (simplified)
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));

    // Convert to radians
    const latRad = latitude * (Math.PI / 180);
    const declRad = declination * (Math.PI / 180);

    // Hour angle at sunrise/sunset
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);

    // Handle polar day/night
    let hourAngle: number;
    if (cosHourAngle < -1) {
        // Polar day - sun never sets
        return { sunrise: 0, sunset: 24, isDaytime: true };
    } else if (cosHourAngle > 1) {
        // Polar night - sun never rises
        return { sunrise: 12, sunset: 12, isDaytime: false };
    } else {
        hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
    }

    // Solar noon (simplified - assumes timezone roughly matches longitude)
    const solarNoon = 12 - (longitude / 15);

    // Calculate sunrise and sunset in local time
    const sunrise = solarNoon - (hourAngle / 15);
    const sunset = solarNoon + (hourAngle / 15);

    // Get current hour with minutes as decimal
    const currentHour = date.getHours() + date.getMinutes() / 60;

    // Determine if it's daytime
    const isDaytime = currentHour >= sunrise && currentHour < sunset;

    return {
        sunrise: Math.max(0, Math.min(24, sunrise)),
        sunset: Math.max(0, Math.min(24, sunset)),
        isDaytime
    };
};

/**
 * Simple check if it's daytime based on user's location
 */
export const isDaytime = (latitude: number, longitude: number): boolean => {
    return getSunTimes(latitude, longitude).isDaytime;
};

/**
 * Helper to get day of year (1-365)
 */
const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

/**
 * Get time until next sunrise or sunset (in milliseconds)
 * Useful for scheduling style updates
 */
export const getTimeUntilNextTransition = (latitude: number, longitude: number): number => {
    const date = new Date();
    const { sunrise, sunset, isDaytime: isDay } = getSunTimes(latitude, longitude, date);
    const currentHour = date.getHours() + date.getMinutes() / 60;

    let hoursUntilTransition: number;

    if (isDay) {
        // Daytime - calculate time until sunset
        hoursUntilTransition = sunset - currentHour;
    } else if (currentHour < sunrise) {
        // Before sunrise
        hoursUntilTransition = sunrise - currentHour;
    } else {
        // After sunset - calculate time until tomorrow's sunrise
        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowSun = getSunTimes(latitude, longitude, tomorrow);
        hoursUntilTransition = (24 - currentHour) + tomorrowSun.sunrise;
    }

    // Convert to milliseconds (minimum 1 minute to prevent rapid updates)
    return Math.max(60000, hoursUntilTransition * 60 * 60 * 1000);
};
