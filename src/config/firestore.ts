// Firestore initialization and configuration
// This must be imported early in the app to configure cache settings
import firestore from '@react-native-firebase/firestore';
import { Platform, InteractionManager } from 'react-native';

// Track if configuration has been attempted
let configurationAttempted = false;
let configurationSucceeded = false;

// Configure Firestore settings with proper guards for fresh device launch
const configureFirestore = async () => {
    // Prevent double initialization
    if (configurationAttempted) {
        console.log('[FirestoreConfig] Already attempted configuration, skipping');
        return;
    }
    configurationAttempted = true;

    try {
        // Basic settings that are safe to apply early
        // NOTE: experimentalForceLongPolling is WEB-ONLY and crashes iOS native SDK
        // Basic settings that are safe to apply early
        // NOTE: Commenting out manual settings to prevent race-condition crash on iPhone XR.
        // The error "Host setting may not be nil" implies the native SDK is not ready to accept overrides.
        // We will rely on the default configuration.
        /*
        const settings = {
            host: 'firestore.googleapis.com', // Explicitly set host to prevent "Host setting may not be nil" crash
            cacheSizeBytes: 10 * 1024 * 1024,
            // DO NOT add experimentalForceLongPolling - causes NSUnknownKeyException on iOS
        };

        console.log('[FirestoreConfig] ⚙️ Applying Firestore settings...');
        await firestore().settings(settings);
        */
        console.log('[FirestoreConfig] Using default settings (Skipping manual config to avoid iOS crash)');

        configurationSucceeded = true;
        console.log('[FirestoreConfig] ✅ Configuration complete.');
    } catch (error: any) {
        // Settings can only be applied once - this error is expected on hot reload
        if (error?.message?.includes('has already been called')) {
            console.log('[FirestoreConfig] Settings already applied (ok)');
            configurationSucceeded = true;
        } else {
            console.error('[FirestoreConfig] ❌ Failed to configure Firestore:', error);
        }
    }
};

// Delayed initialization to ensure native modules are ready
// Using InteractionManager to run after the JS bridge is stable
InteractionManager.runAfterInteractions(() => {
    // Additional delay for fresh device cold starts
    setTimeout(() => {
        configureFirestore();
    }, 100);
});

// Export helper to check if config succeeded
export const isFirestoreConfigured = () => configurationSucceeded;

export default firestore;
