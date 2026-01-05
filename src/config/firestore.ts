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
            experimentalForceLongPolling: true, // CRITICAL: Enable Long Polling to fix iOS gRPC Hangs
        };

        firestore().settings(settings);
        console.log('[FirestoreConfig] ✅ Firestore settings applied: 10MB Cache (iOS experiment)');

        // iOS Network Toggling removed to prevent conflict with Long Polling
    } catch (error) {
        console.error('[FirestoreConfig] ❌ Failed to configure Firestore:', error);
    }
};

// Configure immediately when this module loads
configureFirestore();

export default firestore;
