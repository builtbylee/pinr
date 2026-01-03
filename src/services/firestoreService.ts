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

        console.log('[Firestore] processPins: Processed', memories.length, 'memories from', rawPins.length, 'raw pins');
        if (memories.length > 0) {
            console.log('[Firestore] processPins: First memory sample:', {
                id: memories[0].id,
                title: memories[0].title,
                creatorId: memories[0].creatorId
            });
        }
        callback(memories);
    };

    // Wait for Firestore to be ready before subscribing
    // This is REQUIRED on iOS to ensure the SDK socket is connected
    const { waitForFirestore } = require('./firebaseInitService');
    let hasReceivedSnapshot = false;
    let isUnsubscribed = false;

    const setupSubscription = async () => {
        try {
            console.log('[Firestore] ========== subscribeToPins START ==========');
            console.log('[Firestore] Timestamp:', new Date().toISOString());

            // Wait for Firestore SDK to be ready (required on iOS)
            console.log('[Firestore] Waiting for Firestore to be ready...');
            await waitForFirestore();
            console.log('[Firestore] ✅ Firestore ready');

            if (isUnsubscribed) {
                console.log('[Firestore] Unsubscribed during wait, aborting');
                return;
            }

            // Step 2: Verify authentication before fetching
            const auth = require('@react-native-firebase/auth').default;
            const currentUser = auth().currentUser;
            if (!currentUser) {
                console.error('[Firestore] ❌ No authenticated user - cannot fetch pins');
                callback([]);
                return;
            }
            console.log('[Firestore] ✅ User authenticated:', currentUser.uid);

            // Step 3: Fetch initial pins data to populate UI immediately
            console.log('[Firestore] Fetching initial pins data...');
            const fetchStartTime = Date.now();

            try {
                const pinsRef = firestore()
                    .collection(PINS_COLLECTION)
                    .orderBy('createdAt', 'desc');

                console.log('[Firestore] Executing pins query...');
                const snapshot = await Promise.race([
                    pinsRef.get(),
                    new Promise<any>((_, reject) =>
                        setTimeout(() => reject(new Error('Initial fetch timeout')), 8000)
                    )
                ]);

                const fetchDuration = Date.now() - fetchStartTime;
                console.log('[Firestore] ✅ Initial fetch completed');
                console.log('[Firestore] Fetch duration:', fetchDuration + 'ms');
                console.log('[Firestore] Pins found:', snapshot.docs.length);

                if (isUnsubscribed) {
                    console.log('[Firestore] Unsubscribed during fetch, aborting');
                    return;
                }

                // Update cache with initial data
                rawPins = snapshot.docs.map(doc => doc.data() as FirestorePin);
                rawIds = snapshot.docs.map(doc => doc.id);

                // Process and callback with initial data
                processPins();
                hasReceivedSnapshot = true;
            } catch (fetchError: any) {
                console.error('[Firestore] ❌ Initial fetch failed:', fetchError.message);
                console.error('[Firestore] Error code:', fetchError.code);
                console.error('[Firestore] Error details:', JSON.stringify(fetchError).substring(0, 200));
                // Continue to subscription anyway - it might work
                callback([]);
            }

            // Step 4: Setup real-time subscription
            // Connection is now verified, so onSnapshot should work immediately
            console.log('[Firestore] Setting up real-time subscription...');
            const subscriptionStartTime = Date.now();

            try {
                const pinsRef = firestore()
                    .collection(PINS_COLLECTION)
                    .orderBy('createdAt', 'desc');

                console.log('[Firestore] Creating onSnapshot listener...');
                unsubscribeSnapshot = pinsRef.onSnapshot(
                    (snapshot) => {
                        const subscriptionDuration = Date.now() - subscriptionStartTime;
                        console.log('[Firestore] 🎉 Pins snapshot callback fired!');
                        console.log('[Firestore] Subscription established after:', subscriptionDuration + 'ms');
                        console.log('[Firestore] Pins count:', snapshot.docs.length);
                        console.log('[Firestore] Snapshot metadata:', {
                            fromCache: snapshot.metadata.fromCache,
                            hasPendingWrites: snapshot.metadata.hasPendingWrites
                        });

                        if (isUnsubscribed) {
                            console.log('[Firestore] Received snapshot after unsubscribe, ignoring');
                            return;
                        }

                        hasReceivedSnapshot = true;

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
                        console.error('[Firestore] Error details:', JSON.stringify(error).substring(0, 300));

                        // Check if it's an authentication error
                        if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                            console.error('[Firestore] ⚠️ Authentication error - user may not be authenticated');
                            const auth = require('@react-native-firebase/auth').default;
                            const currentUser = auth().currentUser;
                            console.error('[Firestore] Current user:', currentUser ? currentUser.uid : 'NULL');
                        }

                        if (isUnsubscribed) {
                            return;
                        }

                        // Call callback with empty array on error to prevent hang
                        callback([]);
                    }
                );

                console.log('[Firestore] ✅ Real-time subscription created');
                console.log('[Firestore] ============================================');

                // Setup interval to re-check every 30 seconds (in case app stays open)
                intervalId = setInterval(processPins, 30000);
            } catch (subscriptionError: any) {
                console.error('[Firestore] ❌ Failed to create subscription:', subscriptionError);
                if (!isUnsubscribed) {
                    callback([]);
                }
            }
        } catch (error: any) {
            console.error('[Firestore] ❌ Setup subscription failed:', error);
            if (!isUnsubscribed) {
                callback([]);
            }
        }
    };

    // Start setup asynchronously
    setupSubscription();

    return () => {
        console.log('[Firestore] Cleaning up pins subscription');
        isUnsubscribed = true;
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };
};
