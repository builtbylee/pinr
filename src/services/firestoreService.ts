// Firebase Firestore Service
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Memory, PinColor } from '../store/useMemoryStore';
import { Alert } from 'react-native';

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
 * Helper: Split array into chunks of specified size
 * Used for Firestore 'in' queries which have a 30-value limit
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Subscribe to real-time pin updates with server-side filtering
 * Only fetches pins from the current user and their friends (not all users globally)
 * Automatically filters out expired pins and deletes them
 *
 * @param friendIds Array of friend user IDs to fetch pins from
 * @param currentUserId Current user's ID (to include their own pins)
 * @param callback Function called whenever pins change
 * @returns Unsubscribe function
 */
export const subscribeToPins = (
    friendIds: string[],
    currentUserId: string,
    callback: (memories: Memory[]) => void
): (() => void) => {
    // Combine current user with friends - user should see their own pins too
    const creatorIds = [currentUserId, ...friendIds];
    console.log('[Firestore] subscribeToPins called with', creatorIds.length, 'creator IDs (self + friends)');

    // Store raw data from all chunks to allow local re-filtering
    const allRawPins: Map<string, FirestorePin> = new Map();
    const unsubscribers: (() => void)[] = [];
    let intervalId: NodeJS.Timeout | null = null;
    let hasCalledBackOnce = false;

    const processPins = () => {
        const now = Date.now();
        const expiredPinIds: string[] = [];

        const memories: Memory[] = [];

        allRawPins.forEach((data, id) => {
            // Check if expired
            if (data.expiresAt && data.expiresAt < now) {
                expiredPinIds.push(id);
                return; // Skip this pin
            }

            memories.push({
                id: id,
                title: data.title,
                date: data.date,
                location: [data.location.longitude, data.location.latitude] as [number, number],
                locationName: data.locationName,
                imageUris: data.imageUrl ? [data.imageUrl] : [],
                pinColor: data.pinColor,
                creatorId: data.creatorId,
                expiresAt: data.expiresAt,
            });
        });

        // Sort by date descending (newest first)
        memories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Opportunistically delete expired pins
        if (expiredPinIds.length > 0) {
            console.log('[Firestore] Found expired pins (cleanup):', expiredPinIds.length);
            expiredPinIds.forEach(id => {
                allRawPins.delete(id);
                deletePin(id).catch(err => console.warn('Failed to delete expired pin:', id, err));
            });
        }

        callback(memories);
        hasCalledBackOnce = true;
    };

    // Wait for Firestore to be ready before subscribing
    const { waitForFirestore } = require('./firebaseInitService');

    waitForFirestore()
        .then(async () => {
            console.log('[Firestore] Firestore ready, subscribing to pins with server-side filtering...');

            // If no creators (edge case: no friends and somehow no self), return empty
            if (creatorIds.length === 0) {
                console.log('[Firestore] No creator IDs, returning empty pins');
                callback([]);
                return;
            }

            // CACHE-FIRST: Try to load from cache immediately (non-blocking)
            // This gives instant UI on cold start
            const firstChunk = creatorIds.slice(0, 30); // First chunk for cache
            try {
                const cacheSnapshot = await firestore()
                    .collection(PINS_COLLECTION)
                    .where('creatorId', 'in', firstChunk)
                    .orderBy('createdAt', 'desc')
                    .get({ source: 'cache' });

                if (cacheSnapshot.docs.length > 0) {
                    console.log('[Firestore] ✅ Cache hit:', cacheSnapshot.docs.length, 'pins from cache');
                    cacheSnapshot.docs.forEach(doc => {
                        allRawPins.set(doc.id, doc.data() as FirestorePin);
                    });
                    processPins(); // Show cached data immediately
                } else {
                    console.log('[Firestore] Cache empty or miss, waiting for network');
                }
            } catch (cacheError) {
                // Cache miss or error - that's fine, listener will populate
                console.log('[Firestore] Cache read failed (normal on first launch):', cacheError);
            }

            // Chunk creator IDs for Firestore 'in' query limit (max 30 values)
            const chunks = chunkArray(creatorIds, 30);
            console.log('[Firestore] Setting up', chunks.length, 'listener(s) for', creatorIds.length, 'creators');

            // Set up real-time listeners for each chunk
            chunks.forEach((chunk, chunkIndex) => {
                const unsubscribe = firestore()
                    .collection(PINS_COLLECTION)
                    .where('creatorId', 'in', chunk)
                    .orderBy('createdAt', 'desc')
                    .onSnapshot(
                        { includeMetadataChanges: false },
                        (snapshot) => {
                            const source = snapshot.metadata.fromCache ? 'cache' : 'server';
                            console.log(`[Firestore] ✅ Chunk ${chunkIndex + 1}/${chunks.length} snapshot from ${source}:`, snapshot.docs.length, 'pins');

                            // Clear old pins from this chunk's creators and add new ones
                            chunk.forEach(creatorId => {
                                // Remove all pins from this creator (they'll be re-added below)
                                allRawPins.forEach((pin, id) => {
                                    if (pin.creatorId === creatorId) {
                                        allRawPins.delete(id);
                                    }
                                });
                            });

                            // Add all pins from this snapshot
                            snapshot.docs.forEach(doc => {
                                allRawPins.set(doc.id, doc.data() as FirestorePin);
                            });

                            processPins();
                        },
                        (error) => {
                            console.error(`[Firestore] ❌ Chunk ${chunkIndex + 1} snapshot error:`, error);
                            // Don't call callback with empty on error - keep showing cached data
                            if (!hasCalledBackOnce) {
                                callback([]);
                            }
                        }
                    );
                unsubscribers.push(unsubscribe);
            });

            // Setup interval to re-check expiry every 30 seconds (in case app stays open)
            intervalId = setInterval(processPins, 30000);
        })
        .catch((error) => {
            console.error('[Firestore] ❌ Failed to wait for Firestore:', error);
            callback([]);
        });

    return () => {
        unsubscribers.forEach(unsub => unsub());
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
};
