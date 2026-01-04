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

    // 1. Subscribe to Profile (must load first to get friends list)
    useEffect(() => {
        console.log('[useDataSubscriptions] Effect triggered. currentUserId:', currentUserId);
        if (!currentUserId) {
            console.log('[useDataSubscriptions] No user ID, resetting profile and pins');
            setUserProfile(null);
            setProfileLoaded(false);
            setAllPins([]);
            friendsRef.current = [];
            if (pinsUnsubscribeRef.current) {
                pinsUnsubscribeRef.current();
                pinsUnsubscribeRef.current = null;
            }
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
                // Even on timeout, subscribe to own pins only
                if (!pinsUnsubscribeRef.current) {
                    console.log('[useDataSubscriptions] Subscribing to own pins only (profile timeout)');
                    pinsUnsubscribeRef.current = subscribeToPins([], currentUserId, setAllPins);
                }
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

                // PINS SUBSCRIPTION: Subscribe/re-subscribe when friends list changes
                const newFriends = data.friends || [];
                const friendsChanged = JSON.stringify(newFriends) !== JSON.stringify(friendsRef.current);

                if (friendsChanged || !pinsUnsubscribeRef.current) {
                    console.log('[useDataSubscriptions] Friends list changed or first load, (re)subscribing to pins');
                    console.log('[useDataSubscriptions] Friends count:', newFriends.length);
                    friendsRef.current = newFriends;

                    // Unsubscribe from old pins listener
                    if (pinsUnsubscribeRef.current) {
                        pinsUnsubscribeRef.current();
                    }

                    // Subscribe to pins with server-side filtering (self + friends only)
                    pinsUnsubscribeRef.current = subscribeToPins(newFriends, currentUserId, setAllPins);
                }
            } else {
                // No profile data - subscribe to own pins only
                if (!pinsUnsubscribeRef.current) {
                    console.log('[useDataSubscriptions] No profile, subscribing to own pins only');
                    pinsUnsubscribeRef.current = subscribeToPins([], currentUserId, setAllPins);
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
            console.log('[useDataSubscriptions] Unsubscribing from profile, pins & stories');
            clearTimeout(safetyTimeout);
            unsubscribe();
            unsubscribeStories();
            if (pinsUnsubscribeRef.current) {
                pinsUnsubscribeRef.current();
                pinsUnsubscribeRef.current = null;
            }
            friendsRef.current = [];
        };
    }, [currentUserId]);

    return { allPins, userProfile, profileLoaded };
};
