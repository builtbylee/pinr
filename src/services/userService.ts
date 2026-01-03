// User Profile Service
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
// import functions from '@react-native-firebase/functions'; // Reverting to client-side


// Triplist -> Bucket List Structure
export interface BucketListItem {
    countryCode?: string; // Optional if city-based
    countryName?: string;
    locationName: string; // "Takoradi, Ghana"
    location: [number, number]; // [lon, lat]
    imageUrl?: string;
    status: 'wishlist' | 'booked' | 'visited';
    addedAt: number; // Timestamp
}

export interface ExplorationStreak {
    current: number;
    lastExploredDate: string; // YYYY-MM-DD
    max: number;
}

// Firestore user profile structure
export interface UserProfile {
    username: string;
    usernameLower: string; // For case-insensitive uniqueness checks
    email?: string; // Linked email address
    avatarUrl?: string; // Profile picture URL
    bio?: string; // User bio/tagline (max 80 chars)
    pinColor?: string; // Ring color for user's pins (hex color)
    pushToken?: string; // Expo Push Token for notifications
    friends?: string[]; // Array of friend UIDs
    hiddenFriendIds?: string[]; // Friends whose pins are hidden from map
    hiddenPinIds?: string[]; // Specific pins hidden from map
    hidePinsFrom?: string[]; // Friends who CANNOT see THIS user's pins (privacy)
    bucketList?: BucketListItem[]; // Renamed from triplist
    streak?: ExplorationStreak; // New Streak Feature
    notificationSettings?: {
        globalEnabled: boolean;
        mutedFriendIds: string[];
        // Notification type preferences
        pinNotifications: boolean;        // Friend drops a new pin
        storyNotifications: boolean;      // Friend shares a new story
        gameInvites: boolean;             // Friend invites to play a game
        gameResults: boolean;             // Friend beats your high score
    };
    privacySettings?: {
        allowSharing: boolean;            // Allow friends to share my pins/journeys
    };
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

const USERS_COLLECTION = 'users';

// Profile Cache - reduces Firestore reads for frequently accessed profiles
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();

/**
 * Clear all cached profiles (call on logout)
 */
export const clearProfileCache = (): void => {
    profileCache.clear();
};

/**
 * Invalidate a specific profile from cache (call after updates)
 */
export const invalidateProfileCache = (uid: string): void => {
    profileCache.delete(uid);
};

/**
 * Check if a username is already taken (case-insensitive)
 */
export const isUsernameTaken = async (username: string, excludeUid?: string): Promise<boolean> => {
    try {
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', username.toLowerCase())
            .get();

        if (snapshot.empty) {
            return false;
        }

        // If we're excluding a UID (for editing own username), check if it's the same user
        if (excludeUid) {
            return snapshot.docs.some(doc => doc.id !== excludeUid);
        }

        return true;
    } catch (error) {
        console.error('[UserService] Check username failed:', error);
        return false; // Assume available on error to not block user
    }
};

/**
 * Get email associated with a username
 */
export const getEmailByUsername = async (username: string): Promise<string | null> => {
    try {
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', username.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const data = snapshot.docs[0].data() as UserProfile;
        return data.email || null;
    } catch (error) {
        console.error('[UserService] Get email failed:', error);
        return null;
    }
};

/**
 * Create or update a user profile
 * Email is stored to enable username-based login lookup.
 */
export const saveUserProfile = async (uid: string, username: string, email?: string): Promise<void> => {
    try {
        // Validation (Risk #12)
        const u = username.trim();
        if (u.length < 3 || u.length > 20) throw new Error('Username must be 3-20 characters');
        if (!/^[a-zA-Z0-9_-]+$/.test(u)) throw new Error('Invalid characters in username');

        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();

        const userData: Partial<UserProfile> = {
            username: u,
            usernameLower: u.toLowerCase(),
            email: email,
            updatedAt: firestore.Timestamp.now(),
        };

        if (doc.exists()) {
            await userRef.update(userData);
        } else {
            await userRef.set({
                ...userData,
                createdAt: firestore.Timestamp.now(),
            } as UserProfile);
        }
        console.log('[UserService] Profile saved for:', uid);
        invalidateProfileCache(uid);
    } catch (error) {
        console.error('[UserService] Save profile failed:', error);
        throw error;
    }
};

/**
 * Save user avatar URL
 */
export const saveUserAvatar = async (uid: string, avatarUrl: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        if (avatarUrl) {
            await userRef.set({
                avatarUrl,
                updatedAt: firestore.Timestamp.now(),
            }, { merge: true });
        }
        console.log('[UserService] Avatar saved for:', uid);
        invalidateProfileCache(uid);
    } catch (error) {
        console.error('[UserService] Save avatar failed:', error);
        throw error;
    }
};

/**
 * Save user pin color
 */
export const saveUserPinColor = async (uid: string, pinColor: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.set({
            pinColor,
            updatedAt: firestore.Timestamp.now(),
        }, { merge: true });
        console.log('[UserService] Pin color saved for:', uid);
        invalidateProfileCache(uid);
    } catch (error) {
        console.error('[UserService] Save pin color failed:', error);
        throw error;
    }
};

/**
 * Save user bio
 */
export const saveUserBio = async (uid: string, bio: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.set({
            bio: bio.slice(0, 80), // Enforce 80 char limit
            updatedAt: firestore.Timestamp.now(),
        }, { merge: true });
        console.log('[UserService] Bio saved for:', uid);
        invalidateProfileCache(uid);
    } catch (error) {
        console.error('[UserService] Save bio failed:', error);
        throw error;
    }
};

/**
 * Save user Expo Push Token
 */
export const savePushToken = async (uid: string, pushToken: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.set({
            pushToken,
            updatedAt: firestore.Timestamp.now(),
        }, { merge: true });
        console.log('[UserService] Push token saved for:', uid);
    } catch (error) {
        console.error('[UserService] Save push token failed:', error);
        // Don't throw, just log. Not critical.
    }
};

/**
 * Update pin visibility for a friend
 * @param hidden - true = hide pins from this friend, false = show pins to this friend
 */
export const updatePinVisibility = async (currentUid: string, friendUid: string, hidden: boolean): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(currentUid);

        if (hidden) {
            // Add friend to hidePinsFrom array
            await userRef.update({
                hidePinsFrom: firestore.FieldValue.arrayUnion(friendUid),
                updatedAt: firestore.Timestamp.now(),
            });
            console.log('[UserService] Hidden pins from friend:', friendUid);
        } else {
            // Remove friend from hidePinsFrom array
            await userRef.update({
                hidePinsFrom: firestore.FieldValue.arrayRemove(friendUid),
                updatedAt: firestore.Timestamp.now(),
            });
            console.log('[UserService] Unhidden pins from friend:', friendUid);
        }
    } catch (error) {
        console.error('[UserService] Update pin visibility failed:', error);
        throw error;
    }
};

/**
 * Get list of friends hidden from seeing user's pins
 */
export const getHidePinsFrom = async (uid: string): Promise<string[]> => {
    try {
        const profile = await getUserProfile(uid);
        return profile?.hidePinsFrom || [];
    } catch (error) {
        console.error('[UserService] Get hidePinsFrom failed:', error);
        return [];
    }
};

/**
 * Add a friend by username
 * Reverted to client-side update for fallback
 */
/**
 * Add a friend by username
 * DEPRECATED/REMOVED for Request-Based Logic. 
 * Use sendFriendRequest instead.
 */
export const addFriend = async (currentUid: string, friendUsername: string): Promise<{ success: boolean; message: string; friendUid?: string }> => {
    return { success: false, message: 'Please use Friend Request flow.' };
};

/**
 * Remove a friend
 */
/**
 * Remove a friend
 * Finds the helper "accepted" request document and deletes it.
 */
export const removeFriend = async (currentUid: string, friendUid: string): Promise<void> => {
    try {
        console.log(`[UserService] Attempting to remove friend: currentUid=${currentUid}, friendUid=${friendUid}`);

        let docToDelete: FirebaseFirestoreTypes.QueryDocumentSnapshot | null = null;

        // Query 1: Using participants array (newest format)
        try {
            const participantsSnapshot = await firestore()
                .collection(FRIEND_REQUESTS_COLLECTION)
                .where('participants', 'array-contains', currentUid)
                .get();

            console.log(`[UserService] Participants query returned ${participantsSnapshot.size} docs`);

            docToDelete = participantsSnapshot.docs.find(doc => {
                const data = doc.data();
                return data.participants?.includes(friendUid);
            }) || null;
        } catch (e) {
            console.log('[UserService] Participants query failed, trying fallback:', e);
        }

        // Query 2: Check if current user is fromUid (without status filter)
        if (!docToDelete) {
            console.log('[UserService] Trying fromUid query...');
            const fromSnapshot = await firestore()
                .collection(FRIEND_REQUESTS_COLLECTION)
                .where('fromUid', '==', currentUid)
                .where('toUid', '==', friendUid)
                .get();

            console.log(`[UserService] fromUid query returned ${fromSnapshot.size} docs`);
            if (!fromSnapshot.empty) {
                docToDelete = fromSnapshot.docs[0];
            }
        }

        // Query 3: Check if current user is toUid (without status filter)
        if (!docToDelete) {
            console.log('[UserService] Trying toUid query...');
            const toSnapshot = await firestore()
                .collection(FRIEND_REQUESTS_COLLECTION)
                .where('fromUid', '==', friendUid)
                .where('toUid', '==', currentUid)
                .get();

            console.log(`[UserService] toUid query returned ${toSnapshot.size} docs`);
            if (!toSnapshot.empty) {
                docToDelete = toSnapshot.docs[0];
            }
        }

        if (docToDelete) {
            console.log(`[UserService] Found doc to delete: ${docToDelete.id}`, docToDelete.data());
            await docToDelete.ref.delete();
            console.log(`[UserService] Successfully removed friend relationship: ${docToDelete.id}`);
        } else {
            console.log('[UserService] No relationship document found to delete - friendship may already be removed');
            // Don't throw - the friendship might already be gone, which is the desired state
        }

    } catch (error: any) {
        console.error('[UserService] Remove friend failed:', error.message || error);
        throw error;
    }
};

/**
 * Toggle hiding a friend's pins (add/remove from hiddenFriendIds)
 */
export const toggleHiddenFriend = async (uid: string, friendUid: string, hide: boolean): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.update({
            hiddenFriendIds: hide
                ? firestore.FieldValue.arrayUnion(friendUid)
                : firestore.FieldValue.arrayRemove(friendUid),
            updatedAt: firestore.Timestamp.now(),
        });
        console.log(`[UserService] Friend ${friendUid} pins ${hide ? 'hidden' : 'shown'} for user ${uid}`);
    } catch (error) {
        console.error('[UserService] Toggle hidden friend failed:', error);
        throw error;
    }
};

/**
 * Toggle hiding a specific pin (add/remove from hiddenPinIds)
 */
export const toggleHiddenPin = async (uid: string, pinId: string, hide: boolean): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.update({
            hiddenPinIds: hide
                ? firestore.FieldValue.arrayUnion(pinId)
                : firestore.FieldValue.arrayRemove(pinId),
            updatedAt: firestore.Timestamp.now(),
        });
        console.log(`[UserService] Pin ${pinId} ${hide ? 'hidden' : 'shown'} for user ${uid}`);
    } catch (error) {
        console.error('[UserService] Toggle hidden pin failed:', error);
        throw error;
    }
};

/**
 * Update Privacy Settings
 */
export const updatePrivacySettings = async (
    uid: string,
    settings: {
        allowSharing?: boolean;
    }
): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) return;

        const currentData = doc.data() as UserProfile;
        const currentSettings = currentData.privacySettings || {
            allowSharing: true,
        };

        const newSettings = { ...currentSettings };

        if (settings.allowSharing !== undefined) {
            newSettings.allowSharing = settings.allowSharing;
        }

        await userRef.update({
            privacySettings: newSettings,
            updatedAt: firestore.Timestamp.now(),
        });

        console.log('[UserService] Privacy settings updated for:', uid);
        invalidateProfileCache(uid);
    } catch (error) {
        console.error('[UserService] Update privacy settings failed:', error);
        throw error;
    }
};

/**
 * Update Notification Settings
 */
export const updateNotificationSettings = async (
    uid: string,
    settings: {
        globalEnabled?: boolean;
        muteFriendUid?: string;
        unmuteFriendUid?: string;
        pinNotifications?: boolean;
        storyNotifications?: boolean;
        gameInvites?: boolean;
        gameResults?: boolean;
    }
): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();

        // Handle missing user doc
        if (!doc.exists) {
            console.log('[UserService] Profile missing for settings update, creating default...');

            const defaultSettings = {
                globalEnabled: true,
                mutedFriendIds: [],
                pinNotifications: true,
                storyNotifications: true,
                gameInvites: true,
                gameResults: true,
                // Apply the requested overrides
                ...settings
            };

            await userRef.set({
                username: 'Explorer',
                usernameLower: 'explorer',
                createdAt: firestore.Timestamp.now(),
                updatedAt: firestore.Timestamp.now(),
                notificationSettings: defaultSettings
            });
            return;
        }

        const currentData = doc.data() as UserProfile;

        const currentSettings = currentData.notificationSettings || {
            globalEnabled: true,
            mutedFriendIds: [],
            pinNotifications: true,
            storyNotifications: true,
            gameInvites: true,
            gameResults: true,
        };

        const newSettings = { ...currentSettings };

        if (settings.globalEnabled !== undefined) {
            newSettings.globalEnabled = settings.globalEnabled;
        }

        if (settings.muteFriendUid) {
            if (!newSettings.mutedFriendIds.includes(settings.muteFriendUid)) {
                newSettings.mutedFriendIds.push(settings.muteFriendUid);
            }
        }

        if (settings.unmuteFriendUid) {
            newSettings.mutedFriendIds = newSettings.mutedFriendIds.filter(id => id !== settings.unmuteFriendUid);
        }

        // Handle notification type preferences
        if (settings.pinNotifications !== undefined) {
            newSettings.pinNotifications = settings.pinNotifications;
        }
        if (settings.storyNotifications !== undefined) {
            newSettings.storyNotifications = settings.storyNotifications;
        }
        if (settings.gameInvites !== undefined) {
            newSettings.gameInvites = settings.gameInvites;
        }
        if (settings.gameResults !== undefined) {
            newSettings.gameResults = settings.gameResults;
        }

        await userRef.update({
            notificationSettings: newSettings,
            updatedAt: firestore.Timestamp.now(),
        });
    } catch (error) {
        console.error('[UserService] Update notification settings failed:', error);
        throw error;
    }
};

/**
 * Get a user's profile (with caching)
 */
export const getUserProfile = async (uid: string, skipCache = false): Promise<UserProfile | null> => {
    try {
        // Check cache first (unless explicitly skipped)
        if (!skipCache) {
            const cached = profileCache.get(uid);
            if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
                return cached.profile;
            }
        }

        // Wait for Firestore to be ready before fetching
        // Initialize fallback mechanism
        let profile: UserProfile | null = null;
        let useRestFallback = false;

        // Try Firestore SDK with aggressive timeout
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SDK Timeout')), 15000)
            );

            const sdkPromise = firestore().collection(USERS_COLLECTION).doc(uid).get();
            // Force cast to any to handle Promise.race type inference
            const doc = await Promise.race([sdkPromise, timeoutPromise]) as any;

            if (doc.exists) {
                profile = doc.data() as UserProfile;
                // Alert for successful fetch (TEMPORARY DEBUG)
                // Alert.alert('Debug: Profile Found', `Loaded: ${profile.username}`);
            } else {
                console.log('[UserService] Profile not found in SDK');
                // Don't alert missing here, might check REST
            }
        } catch (sdkError) {
            console.warn('[UserService] SDK Fetch failed/timed out:', sdkError);
            useRestFallback = true;
        }

        // REST Fallback logic
        if (!profile || useRestFallback) {
            console.log('[UserService] Attempting REST Fallback...');
            try {
                const currentUser = auth().currentUser;
                if (currentUser) {
                    const token = await currentUser.getIdToken(true);
                    const projectId = 'days-c4ad4'; // Correct Firebase project ID
                    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Parse Firestore JSON format
                        if (data && data.fields) {
                            profile = parseFirestoreProfile(data.fields);
                            console.log('[UserService] REST Fetch Success:', profile?.username);
                        }
                    } else {
                        console.warn('[UserService] REST Fallback Failed:', response.status);
                    }
                }
            } catch (restError: any) {
                console.error('[UserService] REST Error:', restError);
            }
        }

        if (profile) {
            // Update cache
            profileCache.set(uid, { profile, timestamp: Date.now() });
            return profile;
        } else {
            console.warn('[UserService] Profile missing for doc:', uid);
        }

        return null;
    } catch (error: any) {
        const { Alert } = require('react-native');
        Alert.alert('Debug: Fetch Error', `Error: ${error.message}`);
        console.error('[UserService] Get profile failed:', error);
        return null;
    }
};

// Helper: Parse Firestore REST JSON to UserProfile
function parseFirestoreProfile(fields: any): UserProfile {
    // Basic parser for string/number/boolean fields
    // Firestore REST API returns values wrapped in type keys (stringValue, integerValue, etc.)
    const profile: any = {};
    for (const key in fields) {
        const value = fields[key];
        if (value.stringValue !== undefined) profile[key] = value.stringValue;
        else if (value.integerValue !== undefined) profile[key] = parseInt(value.integerValue, 10);
        else if (value.doubleValue !== undefined) profile[key] = parseFloat(value.doubleValue);
        else if (value.booleanValue !== undefined) profile[key] = value.booleanValue;

        // Handle Map values (e.g. notificationSettings, privacySettings, streak)
        else if (value.mapValue && value.mapValue.fields) {
            profile[key] = parseFirestoreProfile(value.mapValue.fields);
        }
        // Handle Array values (e.g. friends, hiddenPinIds) - Simplified: arrays of strings only
        else if (value.arrayValue && value.arrayValue.values) {
            profile[key] = value.arrayValue.values.map((v: any) => v.stringValue).filter((v: any) => v !== undefined);
        }
    }
    return profile as UserProfile;
}

/**
 * Get full user profile by username (Exact Match)
 */
export const getUserByUsername = async (username: string): Promise<UserProfileWithUid | null> => {
    try {
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', username.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { uid: doc.id, ...(doc.data() as UserProfile) };
    } catch (error) {
        console.error('[UserService] Get user by username failed:', error);
        return null;
    }
};

/**
 * Subscribe to User Profile changes (Real-time)
 * Waits for Firestore to be ready before subscribing and includes timeout handling
 */
export const subscribeToUserProfile = (uid: string, onUpdate: (profile: UserProfile | null) => void): (() => void) => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let hasReceivedCallback = false;

    // Set timeout IMMEDIATELY: if no callback after 15 seconds total, fall back to REST
    // This ensures the UI unblocks even if waitForFirestore() takes too long
    timeoutId = setTimeout(async () => {
        if (!hasReceivedCallback) {
            console.error('[UserService] ⚠️ Profile subscription timeout after 15s - no callback received');
            console.error('[UserService] Attempting REST fallback via getUserProfile...');

            // Try to fetch profile via REST as fallback
            try {
                const profile = await getUserProfile(uid, true); // Skip cache
                if (profile) {
                    console.log('[UserService] ✅ REST Fallback successful in subscription:', profile.username);
                    onUpdate(profile);
                } else {
                    console.error('[UserService] ❌ REST Fallback returned null');
                    onUpdate(null);
                }
            } catch (error) {
                console.error('[UserService] ❌ REST Fallback failed:', error);
                onUpdate(null);
            }
            hasReceivedCallback = true;
        }
    }, 15000);

    // Wait for Firestore to be ready before subscribing
    const { waitForFirestore } = require('./firebaseInitService');

    console.log('[UserService] ========== subscribeToUserProfile START ==========');
    console.log('[UserService] User ID:', uid);
    console.log('[UserService] Timestamp:', new Date().toISOString());
    console.log('[UserService] Calling waitForFirestore()...');

    const waitStartTime = Date.now();
    waitForFirestore()
        .then(() => {
            const waitDuration = Date.now() - waitStartTime;
            console.log('[UserService] ✅ waitForFirestore() completed');
            console.log('[UserService] Wait duration:', waitDuration + 'ms');
            console.log('[UserService] Firestore ready, subscribing to profile for:', uid);

            // First, try a simple get() to verify Firestore connectivity
            const testRef = firestore().collection(USERS_COLLECTION).doc(uid);
            console.log('[UserService] 🔍 Testing Firestore connectivity with get()...');
            console.log('[UserService] Collection:', USERS_COLLECTION);
            console.log('[UserService] Document ID:', uid);

            const getStartTime = Date.now();
            testRef.get()
                .then((testDoc) => {
                    const getDuration = Date.now() - getStartTime;
                    console.log('[UserService] ✅ Firestore get() succeeded');
                    console.log('[UserService] Get duration:', getDuration + 'ms');
                    console.log('[UserService] Document exists:', testDoc.exists);
                    if (testDoc.exists) {
                        console.log('[UserService] Document data keys:', Object.keys(testDoc.data() || {}));
                    }
                    console.log('[UserService] 📡 Now creating onSnapshot subscription...');

                    try {
                        console.log('[UserService] Creating document reference...');
                        const docRef = firestore().collection(USERS_COLLECTION).doc(uid);
                        console.log('[UserService] ✅ Document reference created');
                        console.log('[UserService] Calling onSnapshot()...');
                        const snapshotStartTime = Date.now();

                        unsubscribe = docRef.onSnapshot(
                            (doc) => {
                                const snapshotDuration = Date.now() - snapshotStartTime;
                                console.log('[UserService] 🎉 onSnapshot SUCCESS callback fired!');
                                console.log('[UserService] Snapshot received after:', snapshotDuration + 'ms');
                                console.log('[UserService] Document exists:', doc.exists);
                                hasReceivedCallback = true;
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                    timeoutId = null;
                                }

                                console.log('[UserService] ✅ Snapshot received for:', uid, 'Exists:', doc.exists);
                                if (doc.exists) {
                                    onUpdate(doc.data() as UserProfile);
                                } else {
                                    console.log('[UserService] Profile document does not exist for:', uid);
                                    onUpdate(null);
                                }
                            },
                            (error) => {
                                hasReceivedCallback = true;
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                    timeoutId = null;
                                }

                                console.error('[UserService] ❌ Profile subscription error:', error);
                                console.error('[UserService] Error code:', error.code);
                                console.error('[UserService] Error message:', error.message);

                                // If it's a permission error, call onUpdate(null) to unblock UI
                                if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                                    console.error('[UserService] Permission denied - user may not be authenticated or security rules blocking');
                                    onUpdate(null);
                                } else {
                                    // For other errors, still call onUpdate(null) to prevent hang
                                    onUpdate(null);
                                }
                            }
                        );
                    } catch (error: any) {
                        hasReceivedCallback = true;
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        console.error('[UserService] ❌ Failed to create subscription:', error);
                        onUpdate(null);
                    }
                })
                .catch((getError: any) => {
                    console.error('[UserService] ❌ Firestore get() failed:', getError);
                    console.error('[UserService] Error code:', getError.code);
                    console.error('[UserService] Error message:', getError.message);

                    // Even if get() fails, try onSnapshot anyway - it might work
                    console.log('[UserService] ⚠️ get() failed, but attempting onSnapshot anyway...');
                    try {
                        console.log('[UserService] Creating onSnapshot subscription (fallback path)...');
                        const docRef = firestore().collection(USERS_COLLECTION).doc(uid);
                        unsubscribe = docRef.onSnapshot(
                            (doc) => {
                                console.log('[UserService] 🎉 onSnapshot SUCCESS callback fired (fallback)!');
                                hasReceivedCallback = true;
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                    timeoutId = null;
                                }

                                console.log('[UserService] ✅ Snapshot received for:', uid, 'Exists:', doc.exists);
                                if (doc.exists) {
                                    onUpdate(doc.data() as UserProfile);
                                } else {
                                    console.log('[UserService] Profile document does not exist for:', uid);
                                    onUpdate(null);
                                }
                            },
                            (error) => {
                                console.log('[UserService] 🚨 onSnapshot ERROR callback fired (fallback)!');
                                hasReceivedCallback = true;
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                    timeoutId = null;
                                }

                                console.error('[UserService] ❌ Profile subscription error:', error);
                                console.error('[UserService] Error code:', error.code);
                                console.error('[UserService] Error message:', error.message);

                                // If it's a permission error, call onUpdate(null) to unblock UI
                                if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                                    console.error('[UserService] Permission denied - user may not be authenticated or security rules blocking');
                                    onUpdate(null);
                                } else {
                                    // For other errors, still call onUpdate(null) to prevent hang
                                    onUpdate(null);
                                }
                            }
                        );
                        console.log('[UserService] ✅ onSnapshot() call completed (fallback), subscription created');
                    } catch (error: any) {
                        hasReceivedCallback = true;
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        console.error('[UserService] ❌ Failed to create subscription after get() error:', error);
                        onUpdate(null);
                    }
                });
        })
        .catch((error) => {
            console.error('[UserService] ❌ Failed to wait for Firestore:', error);
            console.error('[UserService] Error details:', error);
            // Still call onUpdate(null) to unblock the UI
            onUpdate(null);
        });

    // Return unsubscribe function
    return () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (unsubscribe) {
            unsubscribe();
        }
    };
};

/**
 * Search users by partial username (prefix match)
 */
export const searchUsers = async (query: string): Promise<UserProfileWithUid[]> => {
    if (!query || query.length < 2) return [];

    try {
        const searchTerm = query.toLowerCase();
        const strFrontCode = searchTerm.slice(0, searchTerm.length - 1);
        const strEndCode = searchTerm.slice(searchTerm.length - 1, searchTerm.length);
        const endCode = strFrontCode + String.fromCharCode(strEndCode.charCodeAt(0) + 1);

        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '>=', searchTerm)
            .where('usernameLower', '<', endCode)
            .limit(20)
            .get();

        const users: UserProfileWithUid[] = [];
        snapshot.forEach(doc => {
            users.push({ uid: doc.id, ...(doc.data() as UserProfile) });
        });
        return users;
    } catch (error) {
        console.error('[UserService] Search users failed:', error);
        return [];
    }
};

export interface UserProfileWithUid extends UserProfile {
    uid: string;
}

/**
 * Get username by UID (with caching for performance)
 */
const usernameCache: Record<string, string> = {};

export const getUsername = async (uid: string): Promise<string | null> => {
    // Check cache first
    if (usernameCache[uid]) {
        return usernameCache[uid];
    }

    try {
        const profile = await getUserProfile(uid);
        if (profile?.username) {
            usernameCache[uid] = profile.username;
            return profile.username;
        }
        return null;
    } catch (error) {
        console.error('[UserService] Get username failed:', error);
        return null;
    }
};

/**
 * Recover an account by username (migrates old profile to current UID)
 * WARNING: This is for MVP only. In production, this allows account stealing.
 */
/**
 * Recover an account by username (migrates old profile to current UID)
 * REMOVED: Insecure function identified in security audit (Risk #1).
 * Allows account takeover without verification.
 */
// export const recoverAccount = async ... (Removed for security)


/**
 * Delete a user profile by username (Reset Account Feature)
 */
/**
 * Delete a user profile by username (Reset Account Feature)
 * REMOVED: Insecure function identified in security audit (Risk #8).
 * Allows unauthorized deletion of any user.
 */
// export const deleteUserByUsername = async ... (Removed for security)


/**
 * Clear the username cache (useful when a username is updated)
 * ...
 */
// ... existing code ...

const FRIEND_REQUESTS_COLLECTION = 'friend_requests';

export interface FriendRequest {
    id: string;
    fromUid: string;
    fromUsername: string;
    toUid: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: any;
}

/**
 * Send a friend request
 */
export const sendFriendRequest = async (currentUid: string, currentUsername: string, friendUid: string): Promise<{ success: boolean; message: string }> => {
    try {
        // 1. Check if already friends
        const userProfile = await getUserProfile(currentUid);
        if (userProfile?.friends?.includes(friendUid)) {
            return { success: false, message: 'You are already friends!' };
        }

        // 2. Check if request already exists
        const existing = await firestore()
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('fromUid', '==', currentUid)
            .where('toUid', '==', friendUid)
            .get();

        if (!existing.empty) {
            return { success: false, message: 'Request already sent.' };
        }

        // 3. Create Request
        await firestore().collection(FRIEND_REQUESTS_COLLECTION).add({
            fromUid: currentUid,
            fromUsername: currentUsername,
            toUid: friendUid,
            status: 'pending',
            participants: [currentUid, friendUid], // New field for querying
            createdAt: firestore.Timestamp.now(),
        });

        return { success: true, message: 'Friend request sent!' };
    } catch (error: any) {
        console.error('[UserService] Send request failed:', error);
        return { success: false, message: error.message || 'Failed to send request.' };
    }
};

/**
 * Get pending friend requests for the current user
 */
export const getFriendRequests = async (currentUid: string): Promise<FriendRequest[]> => {
    try {
        const snapshot = await firestore()
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('toUid', '==', currentUid)
            .where('status', '==', 'pending')
            // .orderBy('createdAt', 'desc') // Removed to avoid needing a composite index
            .get();

        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as FriendRequest));

        // Sort client-side
        return requests.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
    } catch (error) {
        console.error('[UserService] Get requests failed:', error);
        return [];
    }
};

/**
 * Subscribe to Friend Requests (Real-time)
 */
export const subscribeToFriendRequests = (currentUid: string, onUpdate: (requests: FriendRequest[]) => void): (() => void) => {
    return firestore()
        .collection(FRIEND_REQUESTS_COLLECTION)
        .where('toUid', '==', currentUid)
        .where('status', '==', 'pending')
        .onSnapshot(
            (snapshot) => {
                const requests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as FriendRequest));
                // Sort by latest
                requests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                onUpdate(requests);
            },
            (error) => {
                console.error('[UserService] Friend request subscription error:', error);
            }
        );
};

/**
 * Accept a friend request
 */
/**
 * Accept a friend request
 * Reformatted for Request-Based Model: ONLY updates the request document. 
 * Does NOT touch user profiles.
 */
export const acceptFriendRequest = async (requestId: string, currentUid: string, fromUid: string): Promise<void> => {
    try {
        const requestRef = firestore().collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);

        // Just update status to accepted
        await requestRef.update({
            status: 'accepted',
            updatedAt: firestore.Timestamp.now(),
        });

    } catch (error) {
        console.error('[UserService] Accept request failed:', error);
        throw error;
    }
};

/**
 * Get all friends for a user (Approved Requests)
 * Replaces the old array-based logic.
 */
/**
 * Get all friends for a user (Approved Requests)
 * ROBUST STRATEGY: Two queries (Sent & Received).
 * This avoids "participants" field issues and ensures we capture all connections.
 */
export const getFriends = async (currentUid: string): Promise<string[]> => {
    try {
        const acceptedStatus = 'accepted';

        // 1. Requests I sent that were accepted
        const sentQuery = firestore()
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('fromUid', '==', currentUid)
            .where('status', '==', acceptedStatus)
            .get();

        // 2. Requests I received that I accepted
        const receivedQuery = firestore()
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('toUid', '==', currentUid)
            .where('status', '==', acceptedStatus)
            .get();

        const [sentSnap, receivedSnap] = await Promise.all([sentQuery, receivedQuery]);

        const friendIds = new Set<string>();

        // For sent requests, the friend is 'toUid'
        sentSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.toUid) friendIds.add(d.toUid);
        });

        // For received requests, the friend is 'fromUid'
        receivedSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.fromUid) friendIds.add(d.fromUid);
        });

        return Array.from(friendIds);
    } catch (error) {
        console.error('[UserService] Get friends failed:', error);
        return [];
    }
};

/**
 * Reject/Delete a friend request
 */
export const rejectFriendRequest = async (requestId: string): Promise<void> => {
    try {
        await firestore().collection(FRIEND_REQUESTS_COLLECTION).doc(requestId).delete();
    } catch (error) {
        console.error('[UserService] Reject request failed:', error);
        throw error;
    }
};

export const clearUsernameCache = (uid?: string) => {
    if (uid) {
        delete usernameCache[uid];
    } else {
        Object.keys(usernameCache).forEach(key => delete usernameCache[key]);
    }
};


/**
 * Completely deletes a user's data from Firestore.
 * 1. Delete User Profile
 * 2. Delete all Memories created by user
 * 3. Remove user from all friends' lists
 */
export const deleteUserData = async (uid: string) => {
    try {
        const batch = firestore().batch();

        // 1. Delete User Profile used to be here, but we do it last or part of batch
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        batch.delete(userRef);

        // 2. Delete Memories (Pins)
        const memoriesSnapshot = await firestore()
            .collection('pins')
            .where('creatorId', '==', uid)
            .get();

        memoriesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 3. Cleanup Friend Lists (This is expensive if many friends, but necessary)
        // We first need to get the user's friends to know who to update
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        const friendIds: string[] = userData?.friends || [];

        // For each friend, remove this user from their friends list
        // Note: Doing this in a loop with individual updates might be slow, but batching limits are 500 ops.
        // For now, we'll try to add them to the batch (assuming < 400 friends/memories combined).
        for (const friendId of friendIds) {
            const friendRef = firestore().collection(USERS_COLLECTION).doc(friendId);
            batch.update(friendRef, {
                friends: firestore.FieldValue.arrayRemove(uid)
            });
        }

        // 4. Delete Friend Requests relating to this user
        // Sent requests
        const sentRequests = await firestore().collection('friend_requests').where('fromUid', '==', uid).get();
        sentRequests.docs.forEach(doc => batch.delete(doc.ref));

        // Received requests
        const receivedRequests = await firestore().collection('friend_requests').where('toUid', '==', uid).get();
        receivedRequests.docs.forEach(doc => batch.delete(doc.ref));

        // 5. Delete User Files (Avatar & Pin Images)
        // We do this concurrently or after batch. Storage operations cannot be batched with Firestore.
        try {
            const storageRef = storage().ref(`pins/${uid}`);
            const listResult = await storageRef.listAll();
            const deletePromises = listResult.items.map(item => item.delete());
            await Promise.all(deletePromises);
            console.log(`[UserService] Deleted ${deletePromises.length} files from storage for user ${uid}`);
        } catch (storageError) {
            // If folder doesn't exist or permission denied, just log it. 
            // We don't want to stop the account deletion process.
            console.log('[UserService] Storage cleanup skipped or failed (might be empty):', storageError);
        }
        await batch.commit();
        console.log(`[UserService] Deleted data for user ${uid}`);
        return true;
    } catch (error) {
        console.error('[UserService] Delete user data failed:', error);
        throw error;
    }
};

/**
        throw error;
    }
};
 
/**
 * Add an item to the Bucket List
 */
export const addToBucketList = async (uid: string, item: BucketListItem): Promise<void> => {
    try {
        if (!item.locationName) {
            console.error('[UserService] Invalid bucket list item:', item);
            return;
        }

        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            // User doc doesn't exist (e.g. fresh signup issue), create it with the item
            await userRef.set({
                bucketList: [item],
                username: 'Explorer', // Fallback
                usernameLower: 'explorer',
                createdAt: firestore.Timestamp.now(),
                updatedAt: firestore.Timestamp.now(),
            });
            console.log('[UserService] Created new user profile with bucket list item:', item.locationName);
            return;
        }

        const currentData = doc.data() as UserProfile;
        const currentList = currentData?.bucketList || [];

        // Check for duplicates
        if (currentList.some(i => i.locationName === item.locationName)) {
            console.log('[UserService] Item already in bucket list:', item.locationName);
            return;
        }

        await userRef.update({
            bucketList: firestore.FieldValue.arrayUnion(item),
            updatedAt: firestore.Timestamp.now(),
        });

        // Invalidate cache so profile reads return fresh data
        invalidateProfileCache(uid);

        console.log('[UserService] Added to bucket list:', item.locationName);
    } catch (error) {
        console.error('[UserService] Add to bucket list failed:', error);
        throw error;
    }
};

/**
 * Remove an item from the Bucket List
 * Matches by locationName and location
 */
export const removeFromBucketList = async (uid: string, item: BucketListItem): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.update({
            bucketList: firestore.FieldValue.arrayRemove(item),
            updatedAt: firestore.Timestamp.now(),
        });

        // Invalidate cache so profile reads return fresh data
        invalidateProfileCache(uid);

        console.log('[UserService] Removed from bucket list:', item.locationName);
    } catch (error) {
        console.error('[UserService] Remove from bucket list failed:', error);
        throw error;
    }
};

/**
 * Check and Update Exploration Streak
 * Logic: Call this when user opens a Location Card
 */
export interface ExploreStreakResult {
    streak: number;
    increased: boolean; // true if streak went up today
    message?: string;
}

export const checkExplorationStreak = async (uid: string): Promise<ExploreStreakResult> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);

        const result = await firestore().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            // Handle valid existing user
            if (userDoc.exists) {
                const data = userDoc.data() as UserProfile;
                const now = new Date();
                const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

                const currentStreak = data.streak || { current: 0, lastExploredDate: '', max: 0 };

                // 1. Already explored today?
                if (currentStreak.lastExploredDate === today) {
                    return { streak: currentStreak.current, increased: false };
                }

                // 2. Check if consecutive (last explored was yesterday)
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                let newCurrent = 1;
                let message = "Exploration Streak Started! 🔥";

                if (currentStreak.lastExploredDate === yesterdayStr) {
                    newCurrent = currentStreak.current + 1;
                    message = "Exploration Streak kept alive! 🔥";
                } else if (currentStreak.current > 0) {
                    // Streak broken
                    message = "Streak broken! Started new streak. 🔥";
                }

                const newMax = Math.max(newCurrent, currentStreak.max);

                const newStreakData: ExplorationStreak = {
                    current: newCurrent,
                    lastExploredDate: today,
                    max: newMax
                };

                transaction.update(userRef, {
                    streak: newStreakData,
                    updatedAt: firestore.Timestamp.now()
                });

                return { streak: newCurrent, increased: true, message };
            }

            // Handle missing user (New User Case)
            else {
                const now = new Date();
                const today = now.toISOString().split('T')[0];

                const newStreakData: ExplorationStreak = {
                    current: 1,
                    lastExploredDate: today,
                    max: 1
                };

                // Initialize profile
                transaction.set(userRef, {
                    username: 'Explorer', // Fallback
                    usernameLower: 'explorer',
                    createdAt: firestore.Timestamp.now(),
                    updatedAt: firestore.Timestamp.now(),
                    streak: newStreakData
                });

                return { streak: 1, increased: true, message: "Welcome! First exploration streak started! 🔥" };
            }
        });

        // Invalidate cache so profile page shows updated streak immediately
        if (result.increased) {
            invalidateProfileCache(uid);
        }

        return result;

    } catch (error) {
        console.error('[UserService] Check streak failed:', error);
        return { streak: 0, increased: false };
    }
};

/**
 * Update the status of a bucket list item (Wishlist <-> Visited)
 * Matches by locationName
 */
export const updateBucketListStatus = async (uid: string, locationName: string, newStatus: 'wishlist' | 'booked' | 'visited'): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();
        const currentData = doc.data() as UserProfile;
        const currentList = currentData.bucketList || [];

        const updatedList = currentList.map(item => {
            if (item.locationName === locationName) {
                return { ...item, status: newStatus };
            }
            return item;
        });

        await userRef.update({
            bucketList: updatedList,
            updatedAt: firestore.Timestamp.now(),
        });

        // Invalidate cache so profile reads return fresh data
        invalidateProfileCache(uid);

        console.log(`[UserService] Updated bucketlist status for ${locationName} to ${newStatus}`);
    } catch (error) {
        console.error('[UserService] Update bucketlist status failed:', error);
        throw error;
    }
};
