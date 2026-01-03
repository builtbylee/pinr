// Firestore initialization and configuration
// This must be imported early in the app to configure cache settings
import firestore from '@react-native-firebase/firestore';

// Configure Firestore settings ONCE when the module loads
// This fixes: "Cache size must be set to at least 1048576 bytes"
const configureFirestore = () => {
    try {
        const settings = {
            cacheSizeBytes: 100 * 1024 * 1024, // 100MB cache
            experimentalForceLongPolling: true, // CRITICAL: Fix for physical device hangs
            persistence: false, // Ensure persistence is disabled for now
        };

        firestore().settings(settings);
        console.log('[FirestoreConfig] ✅ Firestore settings applied: Long Polling + 100MB Cache (No Persist)');
    } catch (error) {
        console.error('[FirestoreConfig] ❌ Failed to configure Firestore:', error);
    }
};

// Configure immediately when this module loads
configureFirestore();

export default firestore;
