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
    const cachedMemories = useMemoryStore((state) => state.memories);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Instrumentation: Check Zustand's actual hydration state
    const storeHasHydrated = useMemoryStore.persist?.hasHydrated?.() ?? false;
    log('Hydration', `Zustand store hasHydrated: ${storeHasHydrated}, cachedMemories.length: ${cachedMemories?.length ?? 0}, local hasHydrated: ${hasHydrated}`);

    useEffect(() => {
        log('Hydration', `Effect triggered - cachedMemories: ${cachedMemories?.length ?? 0}, hasHydrated: ${hasHydrated}`);
        if (!hasHydrated && cachedMemories && cachedMemories.length > 0) {
            log('Hydration', `⚡️ FAST HYDRATION: Loaded ${cachedMemories.length} pins from disk`);
            setAllPins(cachedMemories);
            setPinsLoaded(true);
            setHasHydrated(true); // Only do this once on mount
            log('Hydration', `setPinsLoaded(true) called - map should now render`);
        }
    }, [cachedMemories, hasHydrated]);

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
        // CRITICAL FIX: Do NOT reset pinsLoaded to false here.
        // If we have already hydrated from disk, we want to keep showing those pins
        // while the network updates in the background (Stale-While-Revalidate).

        const unsubscribe = subscribeToPins((pins) => {
            log('Pins', `Network callback received - pins count: ${pins.length}`);
            // SAFETY: If we have already hydrated data, and Firestore returns EMPTY (0),
            // and we are in the initial loading phase, it's likely a false-positive from an empty cache.
            // Ignore it to preserve the "Instant Load" experience.
            const currentStoreMemories = useMemoryStore.getState().memories;

            if (pins.length === 0 && currentStoreMemories.length > 0) {
                log('Pins', 'Ignoring empty network update (preserving hydrated state)');
                setPinsLoaded(true);
                return;
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
