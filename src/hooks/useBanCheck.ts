import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { functions, auth } from '../config/firebase';

/**
 * Hook to check if the current user is banned
 * Should be used at the app root level to prevent banned users from accessing the app
 */
export function useBanCheck() {
    const [isBanned, setIsBanned] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkBanStatus = async () => {
            if (!auth.currentUser) {
                setIsChecking(false);
                return;
            }

            try {
                const checkBan = httpsCallable(functions, 'checkBanStatus');
                const result = await checkBan({});
                const data = result.data as { banned: boolean; message?: string };

                if (data.banned) {
                    setIsBanned(true);
                    Alert.alert(
                        'Account Suspended',
                        data.message || 'Your account has been suspended for violating our community guidelines.',
                        [
                            {
                                text: 'OK',
                                onPress: async () => {
                                    // Sign out the banned user
                                    await signOut(auth);
                                },
                            },
                        ],
                        { cancelable: false }
                    );
                }
            } catch (error) {
                console.error('Error checking ban status:', error);
            } finally {
                setIsChecking(false);
            }
        };

        checkBanStatus();
    }, []);

    return { isBanned, isChecking };
}
