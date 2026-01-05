// Firestore initialization and configuration
// This must be imported early in the app to configure cache settings
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

// Configure Firestore settings ONCE when the module loads
// This fixes: "Cache size must be set to at least 1048576 bytes"
// Async configuration to force a clean slate
const configureFirestore = async () => {
    try {
        console.log('[FirestoreConfig] 🛑 Terminating existing instance to reset sockets...');
        await firestore().terminate();

        console.log('[FirestoreConfig] 🧹 Clearing persistence to remove corrupt cache...');
        await firestore().clearPersistence().catch(e => console.warn('Persistence clear error (benign):', e));

        const settings = {
            cacheSizeBytes: 10 * 1024 * 1024,
            experimentalForceLongPolling: true, // CRITICAL
            merge: true, // Ensure we don't overwrite other defaults if any
        };

        console.log('[FirestoreConfig] ⚙️ Applying settings with Long Polling...');
        await firestore().settings(settings);

        console.log('[FirestoreConfig] 🚀 Re-enabling network...');
        await firestore().enableNetwork();

        console.log('[FirestoreConfig] ✅ Aggressive initialization complete.');
    } catch (error) {
        console.error('[FirestoreConfig] ❌ Failed to configure Firestore:', error);
    }
};

// Configure immediately when this module loads
configureFirestore();

export default firestore;
