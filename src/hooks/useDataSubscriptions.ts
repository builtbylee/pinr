import { useState, useEffect, useRef } from 'react';
import { subscribeToPins } from '../services/firestoreService';
import { subscribeToUserProfile, UserProfile } from '../services/userService';
import { Memory } from '../store/useMemoryStore';

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
            console.log('[useDataSubscriptions] Pins callback received:', pins.length, 'pins');
            if (pins.length > 0) {
                console.log('[useDataSubscriptions] First pin sample:', {
                    id: pins[0].id,
                    title: pins[0].title,
                    creatorId: pins[0].creatorId,
                    location: pins[0].location
                });
            }
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

        // Safety timeout: if profile doesn't load within 5 seconds, unblock the UI anyway
        let hasLoaded = false;
        const safetyTimeout = setTimeout(() => {
            if (!hasLoaded) {
                console.warn('[useDataSubscriptions] ⚠️ Profile load timeout after 5s, unblocking UI');
                setProfileLoaded(true);
                hasLoaded = true;
            }
        }, 5000);

        const unsubscribe = subscribeToUserProfile(currentUserId, (data) => {
            console.log('[useDataSubscriptions] Profile update received:', data ? 'Data found' : 'No data');
            if (data) {
                console.log('[useDataSubscriptions] Profile data:', {
                    username: data.username,
                    email: data.email,
                    avatarUrl: data.avatarUrl ? 'Present' : 'Missing',
                    pinColor: data.pinColor
                });
            }
            if (!hasLoaded) {
                clearTimeout(safetyTimeout);
                hasLoaded = true;
            }
            setUserProfile(data);
            setProfileLoaded(true); // Firestore has responded (even if null)
        });

        return () => {
            console.log('[useDataSubscriptions] Unsubscribing from profile');
            clearTimeout(safetyTimeout);
            unsubscribe();
        }
    }, [currentUserId]);

    return { allPins, userProfile, profileLoaded };
};
