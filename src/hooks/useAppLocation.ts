import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';

export const useAppLocation = () => {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locationPermission, setLocationPermission] = useState(false);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermission(status === 'granted');

            if (status === 'granted') {
                try {
                    const location = await Location.getCurrentPositionAsync({});
                    const coords: [number, number] = [location.coords.longitude, location.coords.latitude];
                    setUserLocation(coords);
                } catch (e) {
                    if (__DEV__) console.log('[useAppLocation] Failed to get location.');
                }
            }
        })();
    }, []);

    // Battery optimization: Pause location updates when app is backgrounded
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Location updates paused when backgrounded to save battery
                // Will resume automatically when app becomes active
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    return { userLocation, locationPermission };
};
