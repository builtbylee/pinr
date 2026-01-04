// Firebase Firestore Service
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Memory, PinColor } from '../store/useMemoryStore';
import { Alert, Platform } from 'react-native';

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
        .then(() => {
            console.log('[Firestore] Firestore ready, subscribing to pins...');

            // Set timeout: if no snapshot after 10s (Android) or 500ms (iOS), call REST fallback
            // AGGRESSIVE FIX: Go to REST almost immediately on iOS (onSnapshot is too slow)
            const timeoutMs = Platform.OS === 'ios' ? 500 : 10000;

            timeoutId = setTimeout(async () => {
                if (!hasReceivedSnapshot) {
                    console.warn(`[Firestore] ⚠️ Pins subscription timeout after ${timeoutMs}ms, trying REST API query...`);
                    // Alert.alert('Debug: Pins Timeout', 'SDK timed out, trying REST...');
                    try {
                        // Use REST API to query pins collection
                        const auth = require('@react-native-firebase/auth').default;
                        const currentUser = auth().currentUser;

                        if (currentUser) {
                            const token = await currentUser.getIdToken(true);
                            const projectId = 'days-c4ad4';

                            // Firestore REST API structured query
                            const queryBody = {
                                structuredQuery: {
                                    from: [{ collectionId: PINS_COLLECTION }],
                                    orderBy: [
                                        {
                                            field: { fieldPath: 'createdAt' },
                                            direction: 'DESCENDING'
                                        }
                                    ]
                                }
                            };

                            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(queryBody)
                            });

                            if (response.ok) {
                                const results = await response.json();
                                console.log('[Firestore] ✅ REST query succeeded, results:', results.length);

                                // Parse REST API response (array of result objects)
                                rawPins = [];
                                rawIds = [];

                                for (const result of results) {
                                    if (result.document) {
                                        const doc = result.document;
                                        const pathParts = doc.name.split('/');
                                        const docId = pathParts[pathParts.length - 1];
                                        rawIds.push(docId);

                                        // Parse fields from REST format
                                        const fields = doc.fields;
                                        const pinData: any = {};
                                        for (const key in fields) {
                                            const value = fields[key];
                                            if (value.stringValue !== undefined) pinData[key] = value.stringValue;
                                            else if (value.integerValue !== undefined) pinData[key] = parseInt(value.integerValue, 10);
                                            else if (value.timestampValue !== undefined) {
                                                // Convert timestamp to Firestore Timestamp-like object
                                                pinData[key] = { toMillis: () => new Date(value.timestampValue).getTime() };
                                            }
                                            else if (value.geoPointValue !== undefined) {
                                                pinData[key] = {
                                                    latitude: value.geoPointValue.latitude,
                                                    longitude: value.geoPointValue.longitude
                                                };
                                            }
                                        }
                                        rawPins.push(pinData as FirestorePin);
                                    }
                                }

                                processPins();
                                hasReceivedSnapshot = true;
                            } else {
                                console.error('[Firestore] ❌ REST query failed:', response.status);
                                callback([]);
                            }
                        } else {
                            console.error('[Firestore] ❌ No authenticated user for REST fallback');
                            callback([]);
                        }
                    } catch (error: any) {
                        console.error('[Firestore] ❌ REST query failed:', error);
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
