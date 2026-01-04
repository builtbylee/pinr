import { useState, useEffect, useRef } from 'react';
import { subscribeToPins } from '../services/firestoreService';
import { subscribeToUserProfile, UserProfile } from '../services/userService';
import { Memory, useMemoryStore } from '../store/useMemoryStore';

export const useDataSubscriptions = (currentUserId: string | null) => {
    const [allPins, setAllPins] = useState<Memory[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false); // Flag to track if Firestore has responded

    // Track current friends list to detect changes
    const friendsRef = useRef<string[]>([]);
    const pinsUnsubscribeRef = useRef<(() => void) | null>(null);

    // 1. Subscribe to Pins IMMEDIATELY using CACHED friends list
    // This allows own pins + friends' pins to load in parallel with profile
    useEffect(() => {
        if (!currentUserId) {
            setAllPins([]);
            if (pinsUnsubscribeRef.current) {
                pinsUnsubscribeRef.current();
                pinsUnsubscribeRef.current = null;
            }
            return;
        }

        // Get cached friends list from persisted Zustand store
        const cachedFriends = useMemoryStore.getState().friends || [];
        friendsRef.current = cachedFriends;

        // Subscribe to pins immediately with cached friends (parallel with profile load)
        console.log('[useDataSubscriptions] Subscribing to pins immediately with cached friends');
        console.log('[useDataSubscriptions] Cached friends count:', cachedFriends.length);
        pinsUnsubscribeRef.current = subscribeToPins(cachedFriends, currentUserId, setAllPins);

        return () => {
            if (pinsUnsubscribeRef.current) {
                pinsUnsubscribeRef.current();
                pinsUnsubscribeRef.current = null;
            }
        };
    }, [currentUserId]);

    // 2. Subscribe to Profile (parallel with pins)
    useEffect(() => {
        console.log('[useDataSubscriptions] Effect triggered. currentUserId:', currentUserId);
        if (!currentUserId) {
            console.log('[useDataSubscriptions] No user ID, resetting profile');
            setUserProfile(null);
            setProfileLoaded(false);
            friendsRef.current = [];
            return;
        }

        console.log('[useDataSubscriptions] Subscribing to profile for:', currentUserId);
        setProfileLoaded(false); // Reset on new user

        // Safety timeout: if profile doesn't load within 15 seconds, unblock the UI anyway
        let hasLoaded = false;
        const safetyTimeout = setTimeout(() => {
            if (!hasLoaded) {
                console.warn('[useDataSubscriptions] ⚠️ Profile load timeout after 15s, unblocking UI');
                setProfileLoaded(true);
                hasLoaded = true;
            }
        }, 15000);

        const unsubscribe = subscribeToUserProfile(currentUserId, (data) => {
            console.log('[useDataSubscriptions] Profile update received:', data ? 'Data found' : 'No data');
            if (!hasLoaded) {
                clearTimeout(safetyTimeout);
                hasLoaded = true;
            }
            setUserProfile(data);
            setProfileLoaded(true);

            // SYNC WITH GLOBAL STORE
            if (data) {
                const store = useMemoryStore.getState();
                store.setUsername(data.username);
                store.setAvatarUri(data.avatarUrl || null);
                store.setBio(data.bio || null);
                if (data.pinColor) store.setPinColor(data.pinColor);
                if (data.friends) store.setFriends(data.friends);
                if (data.bucketList) store.setBucketList(data.bucketList);

                // PINS RE-SUBSCRIPTION: When friends list arrives, re-subscribe to include friends' pins
                const newFriends = data.friends || [];
                const friendsChanged = JSON.stringify(newFriends) !== JSON.stringify(friendsRef.current);

                if (friendsChanged && newFriends.length > 0) {
                    console.log('[useDataSubscriptions] Friends list loaded, re-subscribing to include friends pins');
                    console.log('[useDataSubscriptions] Friends count:', newFriends.length);
                    friendsRef.current = newFriends;

                    // Unsubscribe from own-pins-only listener
                    if (pinsUnsubscribeRef.current) {
                        pinsUnsubscribeRef.current();
                    }

                    // Re-subscribe with friends included
                    pinsUnsubscribeRef.current = subscribeToPins(newFriends, currentUserId, setAllPins);
                }
            }
        });

        // 3. Subscribe to User Stories (Journeys)
        const storyService = require('../services/StoryService').storyService;
        const unsubscribeStories = storyService.subscribeToUserStories(currentUserId, (stories: any[]) => {
            console.log('[useDataSubscriptions] Stories update received:', stories.length);
            const store = useMemoryStore.getState();
            store.setStories(stories);
        });

        return () => {
            console.log('[useDataSubscriptions] Unsubscribing from profile & stories');
            clearTimeout(safetyTimeout);
            unsubscribe();
            unsubscribeStories();
            friendsRef.current = [];
        };
    }, [currentUserId]);

    return { allPins, userProfile, profileLoaded };
};
