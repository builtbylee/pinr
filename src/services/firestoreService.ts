// Firebase Firestore Service
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Memory, PinColor } from '../store/useMemoryStore';

// Firestore collection name
const PINS_COLLECTION = 'pins';

// Firestore pin document structure
interface FirestorePin {
    title: string;
    date: string;
    location: FirebaseFirestoreTypes.GeoPoint;
    locationName: string;
    imageUrl: string;
    pinColor: PinColor;
    creatorId: string;
    createdAt: FirebaseFirestoreTypes.Timestamp;
    expiresAt: number | null; // Unix timestamp or null for permanent
}

/**
 * Add a new pin to Firestore
 */
export const addPin = async (memory: Memory): Promise<string> => {
    try {
        const pinData: Omit<FirestorePin, 'id'> = {
            title: memory.title,
            date: memory.date,
            location: new firestore.GeoPoint(memory.location[1], memory.location[0]), // [lat, lon]
            locationName: memory.locationName,
            imageUrl: memory.imageUris[0] || '',
            pinColor: memory.pinColor,
            creatorId: memory.creatorId,
            createdAt: firestore.Timestamp.now(),
            expiresAt: memory.expiresAt,
        };

        const docRef = await firestore().collection(PINS_COLLECTION).add(pinData);
        console.log('[Firestore] Pin added:', docRef.id);



        return docRef.id;
    } catch (error) {
        console.error('[Firestore] Add pin failed:', error);
        throw error;
    }
};

/**
 * Delete a pin from Firestore
 */
export const deletePin = async (pinId: string): Promise<void> => {
    try {
        await firestore().collection(PINS_COLLECTION).doc(pinId).delete();
        console.log('[Firestore] Pin deleted:', pinId);
    } catch (error) {
        console.error('[Firestore] Delete pin failed:', error);
        throw error;
    }
};

/**
 * Update an existing pin
 */
export const updatePin = async (pinId: string, updates: Partial<Memory>): Promise<void> => {
    try {
        const pinUpdates: Partial<FirestorePin> = {
            title: updates.title,
            date: updates.date,
            locationName: updates.locationName,
            imageUrl: updates.imageUris?.[0],
            pinColor: updates.pinColor,
            expiresAt: updates.expiresAt,
        };

        if (updates.location) {
            pinUpdates.location = new firestore.GeoPoint(updates.location[1], updates.location[0]);
        }

        // Remove undefined fields
        Object.keys(pinUpdates).forEach(key => pinUpdates[key as keyof FirestorePin] === undefined && delete pinUpdates[key as keyof FirestorePin]);

        await firestore().collection(PINS_COLLECTION).doc(pinId).update(pinUpdates);
        console.log('[Firestore] Pin updated:', pinId);
    } catch (error) {
        console.error('[Firestore] Update pin failed:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time pin updates
 * Automatically filters out expired pins and deletes them
 * @param callback Function called whenever pins change
 * @returns Unsubscribe function
 */
export const subscribeToPins = (
    callback: (memories: Memory[]) => void
): (() => void) => {
    // Store raw data to allow local re-filtering without new snapshot
    let rawPins: FirestorePin[] = [];
    let rawIds: string[] = [];
    let unsubscribeSnapshot: (() => void) | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const processPins = () => {
        const now = Date.now();
        const expiredPinIds: string[] = [];

        const memories: Memory[] = rawPins
            .map((data, index) => {
                const id = rawIds[index];

                // Check if expired
                if (data.expiresAt && data.expiresAt < now) {
                    expiredPinIds.push(id);
                    return null; // Will be filtered out
                }

                return {
                    id: id,
                    title: data.title,
                    date: data.date,
                    location: [data.location.longitude, data.location.latitude] as [number, number],
                    locationName: data.locationName,
                    imageUris: data.imageUrl ? [data.imageUrl] : [],
                    pinColor: data.pinColor,
                    creatorId: data.creatorId,
                    expiresAt: data.expiresAt,
                };
            })
            .filter((m): m is Memory => m !== null);

        // Opportunistically delete expired pins
        if (expiredPinIds.length > 0) {
            console.log('[Firestore] Found expired pins (cleanup):', expiredPinIds.length);
            // We don't wait for this; fire and forget
            expiredPinIds.forEach(id => deletePin(id).catch(err => console.warn('Failed to delete expired pin:', id, err)));
        }

        callback(memories);
    };

    // Wait for Firestore to be ready before subscribing
    const { waitForFirestore } = require('./firebaseInitService');
    let hasReceivedSnapshot = false;
    let timeoutId: NodeJS.Timeout | null = null;

    waitForFirestore()
        .then(() =\u003e {
            console.log('[Firestore] Firestore ready, subscribing to pins...');

            // Set timeout: if no snapshot after 10 seconds, try one-time get()
            timeoutId = setTimeout(async () => {
                if (!hasReceivedSnapshot) {
                    console.warn('[Firestore] ⚠️ Pins subscription timeout after 10s, trying one-time get()...');
                    try {
                        const snapshot = await firestore()
                            .collection(PINS_COLLECTION)
                            .orderBy('createdAt', 'desc')
                            .get();

                        console.log('[Firestore] ✅ One-time get() succeeded, count:', snapshot.docs.length);
                        rawPins = snapshot.docs.map(doc => doc.data() as FirestorePin);
                        rawIds = snapshot.docs.map(doc => doc.id);
                        processPins();
                        hasReceivedSnapshot = true;
                    } catch (error) {
                        console.error('[Firestore] ❌ One-time get() also failed:', error);
                        callback([]);
                    }
                }
            }, 10000);

            unsubscribeSnapshot = firestore()
                .collection(PINS_COLLECTION)
                .orderBy('createdAt', 'desc')
                .onSnapshot(
                    (snapshot) => {
                        console.log('[Firestore] ✅ Pins snapshot received, count:', snapshot.docs.length);
                        hasReceivedSnapshot = true;
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        // Update cache
                        rawPins = snapshot.docs.map(doc => doc.data() as FirestorePin);
                        rawIds = snapshot.docs.map(doc => doc.id);

                        // Process immediately
                        processPins();
                    },
                    (error) => {
                        console.error('[Firestore] ❌ Pins snapshot error:', error);
                        console.error('[Firestore] Error code:', error.code);
                        console.error('[Firestore] Error message:', error.message);
                        // Call callback with empty array on error to prevent hang
                        callback([]);
                    }
                );

            // Setup interval to re-check every 30 seconds (in case app stays open)
            intervalId = setInterval(processPins, 30000);
        })
        .catch((error) => {
            console.error('[Firestore] ❌ Failed to wait for Firestore:', error);
            // Call callback with empty array to prevent hang
            callback([]);
        });

    return () => {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
};
