import { useState, useEffect, useRef } from 'react';
import { subscribeToPins } from '../services/firestoreService';
import { subscribeToUserProfile, UserProfile } from '../services/userService';
import useMemoryStore, { Memory } from '../store/useMemoryStore';

export const useDataSubscriptions = (currentUserId: string | null) => {
    const [allPins, setAllPins] = useState<Memory[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false); // Flag to track if Firestore has responded

    // 1. Subscribe to Pins
    useEffect(() => {
        if (!currentUserId) {
            setAllPins([]);
            return;
        }

        console.log('[useDataSubscriptions] Subscribing to pins...');
        const unsubscribe = subscribeToPins((pins) => {
            setAllPins(pins);
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

    return { allPins, userProfile, profileLoaded };
};
