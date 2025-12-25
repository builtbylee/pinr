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
            setAllPins(pins);
        });

        return () => unsubscribe();
    }, [currentUserId]);

    // 2. Subscribe to Profile
    useEffect(() => {
        if (!currentUserId) {
            setUserProfile(null);
            setProfileLoaded(false);
            return;
        }

        console.log('[useDataSubscriptions] Subscribing to profile...');
        setProfileLoaded(false); // Reset on new user

        const unsubscribe = subscribeToUserProfile(currentUserId, (data) => {
            setUserProfile(data);
            setProfileLoaded(true); // Firestore has responded (even if null)
        });

        return () => unsubscribe();
    }, [currentUserId]);

    return { allPins, userProfile, profileLoaded };
};
