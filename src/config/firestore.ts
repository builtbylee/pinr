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
        const settings = {
            cacheSizeBytes: 10 * 1024 * 1024,
            experimentalForceLongPolling: false, // TEMPORARILY DISABLED to test crash fix
        };

        console.log('[FirestoreConfig] ⚙️ Applying Firestore settings...');
        await firestore().settings(settings);

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
