import { LogLevel, OneSignal } from 'react-native-onesignal';
import { Platform } from 'react-native';
import { getCurrentUser } from './authService';
import { getUserProfile } from './userService';

const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONE_SIGNAL_REST_API_KEY = 'os_v2_app_lgmokdxmfze7vhj7sy4rnbehvsajdjhgufbegzfkoyeuqj7txtsyebzctnwo577asbhicpokkrh5plskt3kx2zmrvjanqtsumxn22oi';

// Initialize OneSignal
OneSignal.initialize(ONE_SIGNAL_APP_ID);
OneSignal.Debug.setLogLevel(LogLevel.Verbose);

export const notificationService = {
    /**
     * Identify the user in OneSignal using their Firebase UID
     */
    async login(uid: string) {
        console.log('[OneSignal] Logging in user:', uid);
        try {
            OneSignal.login(uid);
            console.log('[OneSignal] Login complete for:', uid);
        } catch (error) {
            console.error('[OneSignal] Login error:', error);
        }
    },

    /**
     * Logout from OneSignal on sign out
     */
    async logout() {
        console.log('[OneSignal] Logging out');
        OneSignal.logout();
    },

    /**
     * Request permissions manually
     */
    async requestPermissions() {
        console.log('[OneSignal] Requesting permissions');
        return OneSignal.Notifications.requestPermission(true);
    },

    /**
     * Listen for notification clicks (Deep Linking)
     */
    addClickListener(handler: (data: any) => void) {
        console.log('[OneSignal] Adding click listener');
        OneSignal.Notifications.addEventListener('click', (event) => {
            console.log('[OneSignal] Notification clicked:', event);
            if (event.notification.additionalData) {
                handler(event.notification.additionalData);
            }
        });
    },

    /**
     * Mock for app/index.tsx compatibility
     */
    async registerForPushNotificationsAsync() {
        console.log('[OneSignal] Registering for push (Mock -> Real)');
        return OneSignal.User.pushSubscription.getPushSubscriptionId();
    },

    /**
     * Send a game invite to a specific user via OneSignal REST API
     * Target: friend's Firebase UID (which matches their OneSignal external_id)
     */
    async sendGameInvite(friendUid: string, gameName: string): Promise<{
        success: boolean;
        steps: string[];
        error?: string;
        apiResponse?: any;
    }> {
        const steps: string[] = [];
        try {
            steps.push(`Starting sendGameInvite for: ${friendUid}`);

            const currentUser = getCurrentUser();
            if (!currentUser) {
                return { success: false, steps, error: 'No current user' };
            }

            const currentProfile = await getUserProfile(currentUser.uid);
            const friendProfile = await getUserProfile(friendUid);

            if (!friendProfile) {
                return { success: false, steps, error: 'Friend profile not found' };
            }

            // Check if notifications are enabled in our own settings (optional, OneSignal handles subscription status too)
            const isGlobalEnabled = friendProfile.notificationSettings?.globalEnabled ?? true;
            const isGameInvitesEnabled = friendProfile.notificationSettings?.gameInvites ?? true;

            if (!isGlobalEnabled || !isGameInvitesEnabled) {
                return { success: false, steps, error: 'Notifications disabled for user in app settings' };
            }

            steps.push(`Preparing OneSignal payload for target: ${friendUid}`);

            // OneSignal Create Notification API
            const payload = {
                app_id: ONE_SIGNAL_APP_ID,
                include_aliases: {
                    external_id: [friendUid]
                },
                target_channel: "push",
                headings: {
                    en: `Game Invite from ${currentProfile?.username || 'A friend'}`
                },
                contents: {
                    en: `${currentProfile?.username} wants to play ${gameName} with you!`
                },
                data: {
                    type: 'game_invite',
                    game: gameName,
                    senderId: currentUser.uid
                },
                // Android specific
                android_group: 'game_invites',
                android_visibility: 1, // Public
            };

            if (ONE_SIGNAL_REST_API_KEY === 'YOUR_ONESIGNAL_REST_API_KEY') {
                steps.push('WARNING: OneSignal REST API Key is missing. Invite will fail.');
            }

            steps.push('Sending request to OneSignal API...');
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            steps.push(`OneSignal Response: ${JSON.stringify(result)}`);

            if (result.errors) {
                return { success: false, steps, error: JSON.stringify(result.errors) };
            }

            return { success: true, steps, apiResponse: result };

        } catch (error: any) {
            steps.push(`EXCEPTION: ${error.message}`);
            return { success: false, steps, error: error.message };
        }
    },

    /**
     * Notify a friend when you beat their high score
     */
    /**
     * Notify a friend that a challenge is complete
     */
    async notifyChallengeComplete(friendUid: string, gameName: string, result: { won: boolean, opponentName: string, challengeId: string }) {
        try {
            await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify({
                    app_id: ONE_SIGNAL_APP_ID,
                    include_aliases: { external_id: [friendUid] },
                    target_channel: "push",
                    headings: { en: result.won ? "You Won! 🎉" : "Challenge Complete" },
                    contents: { en: result.won ? `You beat ${result.opponentName} in ${gameName}!` : `${result.opponentName} beat you in ${gameName}.` },
                    data: {
                        type: 'challenge_result',
                        challengeId: result.challengeId,
                        game: gameName
                    }
                })
            });
        } catch (error) {
            console.error('Error notifying challenge complete:', error);
        }
    },

    /**
     * Notify friends when a user creates a new pin
     */
    async notifyNewPin(friendUid: string, creatorName: string) {
        console.log(`[NotificationService] notifyNewPin called - friendUid: ${friendUid}, creatorName: ${creatorName}`);
        try {
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify({
                    app_id: ONE_SIGNAL_APP_ID,
                    include_aliases: { external_id: [friendUid] },
                    target_channel: "push",
                    headings: { en: "New Pin! 📍" },
                    contents: { en: `${creatorName} added a new pin to the map.` },
                    data: {
                        type: 'new_pin',
                        creatorName: creatorName
                    }
                })
            });
            const result = await response.json();
            console.log(`[NotificationService] notifyNewPin response:`, JSON.stringify(result));
        } catch (error) {
            console.error('[NotificationService] Error notifying new pin:', error);
        }
    },

    /**
     * Notify friends when a user creates a new story
     */
    async notifyNewStory(friendUid: string, creatorName: string, storyTitle: string) {
        console.log(`[NotificationService] notifyNewStory called - friendUid: ${friendUid}, creatorName: ${creatorName}`);
        try {
            const friendProfile = await getUserProfile(friendUid);

            // Check if story notifications are enabled
            const isGlobalEnabled = friendProfile?.notificationSettings?.globalEnabled ?? true;
            const isStoryEnabled = friendProfile?.notificationSettings?.storyNotifications ?? true;

            if (!isGlobalEnabled || !isStoryEnabled) {
                console.log(`[NotificationService] Story notifications disabled for ${friendUid}`);
                return;
            }

            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify({
                    app_id: ONE_SIGNAL_APP_ID,
                    include_aliases: { external_id: [friendUid] },
                    target_channel: "push",
                    headings: { en: "New Journey! 🌍" },
                    contents: { en: `${creatorName} shared a new journey: "${storyTitle}"` },
                    data: {
                        type: 'new_story',
                        creatorName: creatorName
                    }
                })
            });
            const result = await response.json();
            console.log(`[NotificationService] notifyNewStory response:`, JSON.stringify(result));
        } catch (error) {
            console.error('[NotificationService] Error notifying new story:', error);
        }
    }
};
