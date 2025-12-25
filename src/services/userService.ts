// User Profile Service
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Triplist Item Structure
export interface TripListItem {
    countryCode: string; // ISO code e.g. 'JP', 'FR'
    countryName: string; // e.g. 'Japan', 'France'
    status: 'wishlist' | 'booked';
    addedAt: number; // Timestamp
}

// Firestore user profile structure
export interface UserProfile {
    username: string;
    usernameLower: string; // For case-insensitive uniqueness checks
    email?: string; // Linked email address
    avatarUrl?: string; // Profile picture URL
    pinColor?: string; // Ring color for user's pins (hex color)
    pushToken?: string; // Expo Push Token for notifications
    friends?: string[]; // Array of friend UIDs
    hiddenFriendIds?: string[]; // Friends whose pins are hidden from map
    hidePinsFrom?: string[]; // Friends who CANNOT see THIS user's pins (privacy)
    triplist?: TripListItem[]; // Wishlist/Booked countries
    notificationSettings?: {
        globalEnabled: boolean;
        mutedFriendIds: string[];
        // Notification type preferences
        pinNotifications: boolean;        // Friend drops a new pin
        storyNotifications: boolean;      // Friend shares a new story
        gameInvites: boolean;             // Friend invites to play a game
        gameResults: boolean;             // Friend beats your high score
    };
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

const USERS_COLLECTION = 'users';

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
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();

        const data: Partial<UserProfile> = {
            username,
            usernameLower: username.toLowerCase(),
            updatedAt: firestore.Timestamp.now(),
        };

        if (email) {
            data.email = email;
        }

        if (doc.exists()) {
            await userRef.update(data);
        } else {
            await userRef.set({
                ...data,
                createdAt: firestore.Timestamp.now(),
            } as UserProfile);
        }
        console.log('[UserService] Profile saved for:', uid);
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
        await userRef.update({
            avatarUrl,
            updatedAt: firestore.Timestamp.now(),
        });
        console.log('[UserService] Avatar saved for:', uid);
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
        await userRef.update({
            pinColor,
            updatedAt: firestore.Timestamp.now(),
        });
        console.log('[UserService] Pin color saved for:', uid);
    } catch (error) {
        console.error('[UserService] Save pin color failed:', error);
        throw error;
    }
};

/**
 * Save user Expo Push Token
 */
export const savePushToken = async (uid: string, pushToken: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        await userRef.update({
            pushToken,
            updatedAt: firestore.Timestamp.now(),
        });
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
 */
export const addFriend = async (currentUid: string, friendUsername: string): Promise<{ success: boolean; message: string; friendUid?: string }> => {
    try {
        // 1. Find friend by username
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', friendUsername.toLowerCase())
            .get();

        if (snapshot.empty) {
            return { success: false, message: 'User not found.' };
        }

        const friendDoc = snapshot.docs[0];
        const friendUid = friendDoc.id;

        if (friendUid === currentUid) {
            return { success: false, message: 'You cannot add yourself.' };
        }

        // 2. Add to current user's friend list AND friend's friend list (Reciprocal)
        const batch = firestore().batch();
        const currentUserRef = firestore().collection(USERS_COLLECTION).doc(currentUid);
        const friendUserRef = firestore().collection(USERS_COLLECTION).doc(friendUid);

        batch.update(currentUserRef, {
            friends: firestore.FieldValue.arrayUnion(friendUid),
            updatedAt: firestore.Timestamp.now(),
        });

        batch.update(friendUserRef, {
            friends: firestore.FieldValue.arrayUnion(currentUid),
            updatedAt: firestore.Timestamp.now(),
        });

        await batch.commit();

        return { success: true, message: 'Friend added!', friendUid: friendUid };
    } catch (error: any) {
        console.error('[UserService] Add friend failed:', error);
        return { success: false, message: error.message || 'Failed to add friend.' };
    }
};

/**
 * Remove a friend
 */
export const removeFriend = async (currentUid: string, friendUid: string): Promise<void> => {
    try {
        // Reciprocal remove
        const batch = firestore().batch();
        const currentUserRef = firestore().collection(USERS_COLLECTION).doc(currentUid);
        const friendUserRef = firestore().collection(USERS_COLLECTION).doc(friendUid);

        batch.update(currentUserRef, {
            friends: firestore.FieldValue.arrayRemove(friendUid),
            updatedAt: firestore.Timestamp.now(),
        });

        batch.update(friendUserRef, {
            friends: firestore.FieldValue.arrayRemove(currentUid),
            updatedAt: firestore.Timestamp.now(),
        });

        await batch.commit();
    } catch (error) {
        console.error('[UserService] Remove friend failed:', error);
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
 * Get a user's profile
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
        const doc = await firestore().collection(USERS_COLLECTION).doc(uid).get();
        if (doc.exists()) {
            return doc.data() as UserProfile;
        }
        return null;
    } catch (error) {
        console.error('[UserService] Get profile failed:', error);
        return null;
    }
};

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
 */
export const subscribeToUserProfile = (uid: string, onUpdate: (profile: UserProfile | null) => void): (() => void) => {
    return firestore()
        .collection(USERS_COLLECTION)
        .doc(uid)
        .onSnapshot(
            (doc) => {
                if ((doc as any).exists) {
                    onUpdate(doc.data() as UserProfile);
                } else {
                    onUpdate(null);
                }
            },
            (error) => {
                console.error('[UserService] Profile subscription error:', error);
            }
        );
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
export const recoverAccount = async (currentUid: string, username: string): Promise<boolean> => {
    try {
        // 1. Find the old user profile
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', username.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            return false;
        }

        const oldDoc = snapshot.docs[0];
        const oldData = oldDoc.data() as UserProfile;
        const oldUid = oldDoc.id;

        // Prevent recovering own account (shouldn't happen but good safety)
        if (oldUid === currentUid) {
            return true;
        }

        console.log(`[UserService] Migrating profile from ${oldUid} to ${currentUid}`);

        // 2. Update current user with old data
        const currentUserRef = firestore().collection(USERS_COLLECTION).doc(currentUid);
        await currentUserRef.set({
            ...oldData,
            updatedAt: firestore.Timestamp.now(),
        });

        // 3. Delete old user document to free up the username
        await oldDoc.ref.delete();

        // 4. Update cache
        usernameCache[currentUid] = oldData.username;

        return true;
    } catch (error) {
        console.error('[UserService] Recovery failed:', error);
        return false;
    }
};

/**
 * Delete a user profile by username (Reset Account Feature)
 */
export const deleteUserByUsername = async (username: string): Promise<boolean> => {
    try {
        const snapshot = await firestore()
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', username.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            return false;
        }

        const doc = snapshot.docs[0];
        await doc.ref.delete();

        // Clear cache
        Object.keys(usernameCache).forEach(key => {
            if (usernameCache[key] === username) {
                delete usernameCache[key];
            }
        });

        console.log('[UserService] Deleted user profile:', username);
        return true;
    } catch (error) {
        console.error('[UserService] Delete failed:', error);
        return false;
    }
};

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
export const acceptFriendRequest = async (requestId: string, currentUid: string, fromUid: string): Promise<void> => {
    try {
        const batch = firestore().batch();

        // 1. Add to both friend lists
        const currentUserRef = firestore().collection(USERS_COLLECTION).doc(currentUid);
        const fromUserRef = firestore().collection(USERS_COLLECTION).doc(fromUid);

        batch.update(currentUserRef, {
            friends: firestore.FieldValue.arrayUnion(fromUid),
            updatedAt: firestore.Timestamp.now(),
        });

        batch.update(fromUserRef, {
            friends: firestore.FieldValue.arrayUnion(currentUid),
            updatedAt: firestore.Timestamp.now(),
        });

        // 2. Delete the request (or mark accepted)
        const requestRef = firestore().collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);
        batch.delete(requestRef);

        await batch.commit();
    } catch (error) {
        console.error('[UserService] Accept request failed:', error);
        throw error;
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
        console.error('[UserService] Error deleting user data:', error);
        throw error;
    }
};

/**
 * TRIPLIST FUNCTIONS
 */

/**
 * Add a country to the user's triplist
 */
export const addToTriplist = async (uid: string, item: TripListItem): Promise<void> => {
    try {
        // Validate / Sanitize item to prevent Firestore "undefined" error
        if (!item.countryCode || !item.countryName) {
            console.error('[UserService] Invalid trip item:', item);
            return;
        }

        const safeItem: TripListItem = {
            countryCode: item.countryCode,
            countryName: item.countryName || item.countryCode,
            status: item.status || 'wishlist', // Default to wishlist if undefined
            addedAt: item.addedAt || Date.now(),
        };

        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);

        // Use read-modify-write to prevent duplicates by countryCode
        const doc = await userRef.get();
        const currentData = doc.data() as UserProfile;
        const currentList = currentData.triplist || [];

        // Check if already exists
        if (currentList.some(i => i.countryCode === safeItem.countryCode)) {
            console.log('[UserService] Country already in triplist:', safeItem.countryCode);
            return;
        }

        await userRef.update({
            triplist: firestore.FieldValue.arrayUnion(safeItem),
            updatedAt: firestore.Timestamp.now(),
        });
        console.log('[UserService] Added to triplist:', item.countryName);
    } catch (error) {
        console.error('[UserService] Add to triplist failed:', error);
        throw error;
    }
};

/**
 * Remove a country from the triplist
 */
export const removeFromTriplist = async (uid: string, countryCode: string): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();
        const currentData = doc.data() as UserProfile;
        const currentList = currentData.triplist || [];

        const updatedList = currentList.filter(item => item.countryCode !== countryCode);

        await userRef.update({
            triplist: updatedList,
            updatedAt: firestore.Timestamp.now(),
        });
        console.log('[UserService] Removed from triplist:', countryCode);
    } catch (error) {
        console.error('[UserService] Remove from triplist failed:', error);
        throw error;
    }
};

/**
 * Update the status of a triplist item (Wishlist <-> Booked)
 */
export const updateTriplistStatus = async (uid: string, countryCode: string, newStatus: 'wishlist' | 'booked'): Promise<void> => {
    try {
        const userRef = firestore().collection(USERS_COLLECTION).doc(uid);
        const doc = await userRef.get();
        const currentData = doc.data() as UserProfile;
        const currentList = currentData.triplist || [];

        const updatedList = currentList.map(item => {
            if (item.countryCode === countryCode) {
                return { ...item, status: newStatus };
            }
            return item;
        });

        await userRef.update({
            triplist: updatedList,
            updatedAt: firestore.Timestamp.now(),
        });
        console.log(`[UserService] Updated triplist status for ${countryCode} to ${newStatus}`);
    } catch (error) {
        console.error('[UserService] Update triplist status failed:', error);
        throw error;
    }
};
