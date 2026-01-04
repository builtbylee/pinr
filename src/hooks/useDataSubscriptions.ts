import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { subscribeToPins } from '../services/firestoreService';
import { subscribeToUserProfile, UserProfile } from '../services/userService';
import { useMemoryStore, Memory } from '../store/useMemoryStore';

export const useDataSubscriptions = (currentUserId: string | null) => {
    const [allPins, setAllPins] = useState<Memory[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false); // Flag to track if Firestore has responded
    const [pinsLoaded, setPinsLoaded] = useState(false); // Flag to track if Pins have loaded

    // 0. Reactive Hydration (Instant Load)
    // Listen to the store and populate state as soon as disk data is ready (~50ms)
    // This bypasses the 11s network wait for the initial render.
    const cachedMemories = useMemoryStore((state) => state.memories);
    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        if (!hasHydrated && cachedMemories && cachedMemories.length > 0) {
            console.log(`[Perf] ⚡️ FAST HYDRATION: Loaded ${cachedMemories.length} pins from disk`);
            setAllPins(cachedMemories);
            setPinsLoaded(true);
            setHasHydrated(true); // Only do this once on mount
        }
    }, [cachedMemories, hasHydrated]);

    // 1. Subscribe to Pins
    useEffect(() => {
        if (!currentUserId) {
            setAllPins([]);
            setPinsLoaded(true); // Technically loaded as empty
            return;
        }

        console.log('[useDataSubscriptions] Subscribing to pins...');
        // CRITICAL FIX: Do NOT reset pinsLoaded to false here.
        // If we have already hydrated from disk, we want to keep showing those pins
        // while the network updates in the background (Stale-While-Revalidate).

        const unsubscribe = subscribeToPins((pins) => {
            // SAFETY: If we have already hydrated data, and Firestore returns EMPTY (0),
            // and we are in the initial loading phase, it's likely a false-positive from an empty cache.
            // Ignore it to preserve the "Instant Load" experience.
            const currentStoreMemories = useMemoryStore.getState().memories;

            if (pins.length === 0 && currentStoreMemories.length > 0) {
                console.log('[useDataSubscriptions] Ignoring empty network update (preserving hydrated state)');
                setPinsLoaded(true);
                return;
            }

            setAllPins(pins);
            setPinsLoaded(true);
        });

        return () => unsubscribe();
    }, [currentUserId]);

    // 2. Subscribe to Profile
    useEffect(() => {
        console.log('[useDataSubscriptions] Effect triggered. currentUserId:', currentUserId);
        if (!currentUserId) {
            console.log('[useDataSubscriptions] No user ID, resetting profile');
            setUserProfile(null);
            setProfileLoaded(false);
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
        }, Platform.OS === 'ios' ? 3000 : 15000);

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
                try {
                    // Safe access to store
                    if (useMemoryStore && useMemoryStore.getState) {
                        const store = useMemoryStore.getState();
                        store.setUsername(data.username);
                        store.setAvatarUri(data.avatarUrl || null);
                        if (data.bio) store.setBio(data.bio);
                        if (data.pinColor) store.setPinColor(data.pinColor);
                        if (data.friends) store.setFriends(data.friends);
                        if (data.bucketList) store.setBucketList(data.bucketList);
                    }
                } catch (err) {
                    console.warn('[useDataSubscriptions] Store sync failed:', err);
                }
            }
        });

        // 2. Subscribe to User Stories (Journeys)
        // using the new Fail-Fast logic in StoryService
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
        };
    }, [currentUserId]);

    return { allPins, userProfile, profileLoaded, pinsLoaded };
};
