import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

/**
 * Hook to check if the current user is banned
 * Should be used at the app root level to prevent banned users from accessing the app
 */
export function useBanCheck() {
    const [isBanned, setIsBanned] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkBanStatus = async () => {
            try {
                // Wait a bit for Firebase to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                let currentUser;
                try {
                    currentUser = auth().currentUser;
                } catch (error: any) {
                    // Firebase not ready yet
                    console.log('[useBanCheck] Firebase not ready, skipping ban check');
                    setIsChecking(false);
                    return;
                }

                if (!currentUser) {
                    setIsChecking(false);
                    return;
                }

                try {
                    const checkBan = functions().httpsCallable('checkBanStatus');
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
                                        await auth().signOut();
                                    },
                                },
                            ],
                            { cancelable: false }
                        );
                    }
                } catch (error) {
                    console.error('[useBanCheck] Error checking ban status:', error);
                }
            } catch (error) {
                console.error('[useBanCheck] Error in ban check:', error);
            } finally {
                setIsChecking(false);
            }
        };

        // Don't block - check in background
        checkBanStatus();
        
        // Timeout after 3 seconds to unblock the UI
        const timeout = setTimeout(() => {
            if (isChecking) {
                console.log('[useBanCheck] Timeout, proceeding without ban check');
                setIsChecking(false);
            }
        }, 3000);

        return () => clearTimeout(timeout);
    }, []);

    return { isBanned, isChecking };
}
