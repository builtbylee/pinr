// Firestore initialization and configuration
// This must be imported early in the app to configure cache settings
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

// Configure Firestore settings ONCE when the module loads
// This fixes: "Cache size must be set to at least 1048576 bytes"
const configureFirestore = () => {
    try {
        const settings = {
            cacheSizeBytes: 10 * 1024 * 1024, // 10MB cache (reduced from 100MB for faster cold start)
            // Note: experimentalForceLongPolling is not a valid setting in React Native Firebase
            // Long polling is configured via the Podfile patch instead
        };

        firestore().settings(settings);
        console.log('[FirestoreConfig] ✅ Firestore settings applied: 10MB Cache (iOS experiment)');

        // iOS COLD START FIX: Force cache-first reads by temporarily disabling network
        // This bypasses the slow gRPC connection establishment on iOS
        if (Platform.OS === 'ios') {
            console.log('[FirestoreConfig] 🚀 iOS: Enabling cache-first mode (disableNetwork)');

            // Disable network immediately to force cache reads
            firestore().disableNetwork().then(() => {
                console.log('[FirestoreConfig] ✅ iOS: Network disabled, cache-first active');

                // Re-enable network after 500ms to allow initial cache reads to complete
                // This gives time for UI to render with cached data before syncing
                setTimeout(() => {
                    firestore().enableNetwork().then(() => {
                        console.log('[FirestoreConfig] ✅ iOS: Network re-enabled, syncing in background');
                    }).catch((err) => {
                        console.warn('[FirestoreConfig] ⚠️ iOS: Failed to re-enable network:', err);
                    });
                }, 500);
            }).catch((err) => {
                console.warn('[FirestoreConfig] ⚠️ iOS: Failed to disable network:', err);
            });
        }
    } catch (error) {
        console.error('[FirestoreConfig] ❌ Failed to configure Firestore:', error);
    }
};

// Configure immediately when this module loads
configureFirestore();

export default firestore;
