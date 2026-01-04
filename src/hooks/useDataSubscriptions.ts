import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { subscribeToPins } from '../services/firestoreService';
import { subscribeToUserProfile, UserProfile } from '../services/userService';
import { useMemoryStore, Memory } from '../store/useMemoryStore';

// Instrumentation: Track cold start time
const COLD_START_TIME = Date.now();
const log = (tag: string, msg: string) => {
    const elapsed = Date.now() - COLD_START_TIME;
    console.log(`[Perf +${elapsed}ms] [${tag}] ${msg}`);
};

export const useDataSubscriptions = (currentUserId: string | null) => {
    log('Hook', `useDataSubscriptions called with userId: ${currentUserId ? 'present' : 'null'}`);

    const [allPins, setAllPins] = useState<Memory[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false); // Flag to track if Firestore has responded
    const [pinsLoaded, setPinsLoaded] = useState(false); // Flag to track if Pins have loaded

    // 0. Reactive Hydration (Instant Load)
    // Listen to the store and populate state as soon as disk data is ready (~50ms)
    // This bypasses the 11s network wait for the initial render.
    const [hasUsedCache, setHasUsedCache] = useState(false);
    const hasHydratedRef = useRef(false);

    // FIX: Properly wait for Zustand to finish hydrating from AsyncStorage
    // The old approach used useMemoryStore(state => state.memories) which returns
    // the INITIAL empty array on first render, before AsyncStorage hydration completes.
    useEffect(() => {
        log('Hydration', 'Setting up hydration listener...');

        // Function to apply cached data
        const applyCachedData = (source: string) => {
            if (hasUsedCache) return; // Already used cache

            const memories = useMemoryStore.getState().memories;
            log('Hydration', `Checking cache (${source}): ${memories?.length ?? 0} memories available`);

            if (memories && memories.length > 0) {
                log('Hydration', `⚡️ FAST HYDRATION: Loaded ${memories.length} pins from disk`);
                setAllPins(memories);
                setPinsLoaded(true);
                setHasUsedCache(true);
                hasHydratedRef.current = true;
                log('Hydration', `setPinsLoaded(true) called - map should now render`);
            } else {
                hasHydratedRef.current = true;
            }
        };

        // Check if already hydrated (app was backgrounded/foregrounded)
        const alreadyHydrated = useMemoryStore.persist?.hasHydrated?.() ?? false;

        if (alreadyHydrated) {
            log('Hydration', 'Store already hydrated, applying immediately');
            applyCachedData('already-hydrated');
        }

        // Subscribe to hydration completion (for cold start)
        const unsub = useMemoryStore.persist?.onFinishHydration?.(() => {
            log('Hydration', 'onFinishHydration callback fired');
            applyCachedData('onFinishHydration');
        });

        return () => {
            if (unsub) unsub();
        };
    }, [hasUsedCache]);

    // 1. Subscribe to Pins
    useEffect(() => {
        log('Pins', `Pins effect triggered - currentUserId: ${currentUserId ? 'present' : 'null'}`);
        if (!currentUserId) {
            log('Pins', 'No user ID, setting empty pins');
            setAllPins([]);
            setPinsLoaded(true); // Technically loaded as empty
            return;
        }

        log('Pins', 'Subscribing to pins (network)...');

        // RESILIENCE: If state pins are empty (e.g. due to user ID flicker wiping them),
        // but Store still has data, RESTORE IT IMMEDIATELY.
        const currentStoreMemories = useMemoryStore.getState().memories;
        if (allPins.length === 0 && currentStoreMemories.length > 0) {
            log('Pins', `Resilience: Restoring ${currentStoreMemories.length} pins from store`);
            setAllPins(currentStoreMemories);
            setPinsLoaded(true);
        }

        const unsubscribe = subscribeToPins((pins) => {
            log('Pins', `Network callback received - pins count: ${pins.length}`);
            // SAFETY: If we have already hydrated data, and Firestore returns EMPTY (0),
            // and we are in the initial loading phase, it's likely a false-positive from an empty cache.
            // Ignore it to preserve the "Instant Load" experience.
            const currentStoreMemories = useMemoryStore.getState().memories;
            const isHydrated = hasHydratedRef.current;

            if (pins.length === 0) {
                if (currentStoreMemories.length > 0) {
                    log('Pins', 'Ignoring empty network update (Store has data)');
                    setPinsLoaded(true);
                    return;
                }
                if (!isHydrated) {
                    log('Pins', 'Ignoring empty network update (Not yet hydrated)');
                    return;
                }
            }

            log('Pins', `Setting ${pins.length} pins from network, calling setPinsLoaded(true)`);
            setAllPins(pins);
            setPinsLoaded(true);
        });

        return () => unsubscribe();
    }, [currentUserId]);

    // 2. Subscribe to Profile
    useEffect(() => {
        log('Profile', `Profile effect triggered - currentUserId: ${currentUserId ? 'present' : 'null'}`);
        if (!currentUserId) {
            log('Profile', 'No user ID, resetting profile');
            setUserProfile(null);
            setProfileLoaded(false);
            return;
        }

        log('Profile', `Subscribing to profile for user`);
        setProfileLoaded(false); // Reset on new user

        // Safety timeout: if profile doesn't load within 15 seconds, unblock the UI anyway
        let hasLoaded = false;
        const timeoutMs = Platform.OS === 'ios' ? 3000 : 15000;
        log('Profile', `Setting safety timeout: ${timeoutMs}ms`);
        const safetyTimeout = setTimeout(() => {
            if (!hasLoaded) {
                log('Profile', `⚠️ Profile load TIMEOUT after ${timeoutMs}ms, unblocking UI`);
                setProfileLoaded(true);
                hasLoaded = true;
            }
        }, timeoutMs);

        const unsubscribe = subscribeToUserProfile(currentUserId, (data) => {
            log('Profile', `Profile callback received - data: ${data ? 'present' : 'null'}`);
            if (!hasLoaded) {
                log('Profile', 'Clearing safety timeout - profile loaded from network');
                clearTimeout(safetyTimeout);
                hasLoaded = true;
            }
            setUserProfile(data);
            setProfileLoaded(true);
            log('Profile', 'setProfileLoaded(true) called');

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
            log('Stories', `Stories callback received - count: ${stories.length}`);
            const store = useMemoryStore.getState();
            store.setStories(stories);
        });

        return () => {
            log('Cleanup', 'Unsubscribing from profile & stories');
            clearTimeout(safetyTimeout);
            unsubscribe();
            unsubscribeStories();
        };
    }, [currentUserId]);

    log('Return', `Returning: allPins=${allPins.length}, profileLoaded=${profileLoaded}, pinsLoaded=${pinsLoaded}`);
    return { allPins, userProfile, profileLoaded, pinsLoaded };
};
