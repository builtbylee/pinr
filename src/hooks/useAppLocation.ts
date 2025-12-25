import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { isDaytime } from '../utils/sunCalc';

export const useAppLocation = () => {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isDayMode, setIsDayMode] = useState(true);
    const [locationPermission, setLocationPermission] = useState(false);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermission(status === 'granted');

            // Initial fallback: Simple time-based check (6am-6pm)
            const hour = new Date().getHours();
            const simpleIsDay = hour >= 6 && hour < 18;
            setIsDayMode(simpleIsDay);

            if (status === 'granted') {
                try {
                    const location = await Location.getCurrentPositionAsync({});
                    const coords: [number, number] = [location.coords.longitude, location.coords.latitude];
                    setUserLocation(coords);

                    // Accurate calculation from location
                    const isDay = isDaytime(coords[1], coords[0]);
                    setIsDayMode(isDay);
                    console.log(`[useAppLocation] Mode: ${isDay ? 'DAY' : 'NIGHT'} at [${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}]`);
                } catch (e) {
                    console.log('[useAppLocation] Failed to get location, using time fallback.');
                }
            }
        })();
    }, []);

    // Periodic check (every 5 mins)
    useEffect(() => {
        if (!userLocation) return;

        const interval = setInterval(() => {
            const isDay = isDaytime(userLocation[1], userLocation[0]);
            if (isDay !== isDayMode) {
                console.log(`[useAppLocation] Switching mode to ${isDay ? 'DAY' : 'NIGHT'}`);
                setIsDayMode(isDay);
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [userLocation, isDayMode]);

    return { userLocation, isDayMode, locationPermission };
};
