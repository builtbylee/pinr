/**
 * Firebase App Check Service
 * 
 * Protects Firebase resources (Firestore, Storage, Functions) from abuse
 * by verifying that requests come from legitimate app instances.
 * 
 * Uses Play Integrity on Android and Device Check/App Attest on iOS.
 */

import appCheck from '@react-native-firebase/app-check';

let isInitialized = false;

/**
 * Initialize Firebase App Check
 * Should be called once when the app starts.
 * Waits for Firebase to be ready before initializing.
 */
export async function initializeAppCheck(): Promise<void> {
    if (isInitialized) {
        console.log('[AppCheck] Already initialized');
        return;
    }

    try {
        // Wait for Firebase to be ready before initializing App Check
        const { waitForFirebase } = require('./firebaseInitService');
        await waitForFirebase();
        console.log('[AppCheck] Firebase is ready, initializing App Check...');
        
        // Configure App Check with default providers:
        // - Android: Play Integrity API
        // - iOS: Device Check (automatically falls back to Debug provider in dev)
        const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();

        rnfbProvider.configure({
            android: {
                provider: __DEV__ ? 'debug' : 'playIntegrity',
                debugToken: process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN,
            },
            apple: {
                provider: __DEV__ ? 'debug' : 'deviceCheck',
            },
        });

        await appCheck().initializeAppCheck({
            provider: rnfbProvider,
            isTokenAutoRefreshEnabled: true,
        });

        isInitialized = true;
        console.log('[AppCheck] Initialized successfully');

        // In debug mode, log the debug token for Firebase Console registration
        if (__DEV__) {
            try {
                const { token } = await appCheck().getToken(true);
                console.log('[AppCheck] Debug token (first 20 chars):', token.substring(0, 20) + '...');
            } catch (e) {
                console.log('[AppCheck] Could not get debug token:', e);
            }
        }
    } catch (error) {
        console.error('[AppCheck] Initialization failed:', error);
        // Don't throw - App Check failure shouldn't crash the app
        // Requests will work but won't be verified
    }
}

/**
 * Get the current App Check token (useful for custom backend calls)
 */
export async function getAppCheckToken(): Promise<string | null> {
    try {
        const result = await appCheck().getToken();
        return result.token;
    } catch (error) {
        console.error('[AppCheck] Failed to get token:', error);
        return null;
    }
}
