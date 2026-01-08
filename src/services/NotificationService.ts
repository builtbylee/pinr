// OneSignal imported conditionally to prevent crash if module not linked (same fix as _layout.tsx)
let OneSignal: any;
let LogLevel: any;
try {
  const oneSignalModule = require('react-native-onesignal');
  OneSignal = oneSignalModule.OneSignal;
  LogLevel = oneSignalModule.LogLevel;
} catch (e: any) {
  if (__DEV__) console.warn('[NotificationService] OneSignal module not available:', e?.message || 'Unknown error');
  OneSignal = null;
  LogLevel = null;
}

import { Platform } from 'react-native';
import { getCurrentUser } from './authService';
import { getUserProfile } from './userService';

// DIAGNOSTIC FLAG: Set to true to completely disable all OneSignal SDK calls
const ONESIGNAL_DISABLED = true;

const ONE_SIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONE_SIGNAL_REST_API_KEY = process.env.EXPO_PUBLIC_ONESIGNAL_REST_API_KEY;

// Debug: Log key status (without exposing the full key)
if (!ONE_SIGNAL_REST_API_KEY) {
    if (__DEV__) console.error('[NotificationService] CRITICAL: EXPO_PUBLIC_ONESIGNAL_REST_API_KEY environment variable is not set!');
} else {
    // Log first 10 chars and last 4 chars for verification (safe to log)
    const keyPreview = ONE_SIGNAL_REST_API_KEY.length > 14
        ? `${ONE_SIGNAL_REST_API_KEY.substring(0, 10)}...${ONE_SIGNAL_REST_API_KEY.substring(ONE_SIGNAL_REST_API_KEY.length - 4)}`
        : '***';
    if (__DEV__) console.log(`[NotificationService] OneSignal REST API Key loaded: ${keyPreview} (length: ${ONE_SIGNAL_REST_API_KEY.length})`);

    // Verify key format (should start with 'os_' or be a long alphanumeric string)
    if (!ONE_SIGNAL_REST_API_KEY.startsWith('os_') && ONE_SIGNAL_REST_API_KEY.length < 50) {
        if (__DEV__) console.warn('[NotificationService] WARNING: REST API Key format looks unusual. Expected format: starts with "os_" or is 50+ characters long.');
    }
}

// NOTE: OneSignal initialization happens in _layout.tsx, not here
// This prevents double-initialization crashes on iOS
// OneSignal.initialize(ONE_SIGNAL_APP_ID);
// OneSignal.Debug.setLogLevel(LogLevel.Verbose);

export const notificationService = {
    /**
     * Debug function to verify OneSignal configuration
     * Call this to check if the REST API key is properly loaded
     */
    async verifyConfiguration(): Promise<{
        appId: string;
        restApiKeyLoaded: boolean;
        restApiKeyLength: number;
        restApiKeyPreview: string;
        issues: string[];
    }> {
        const issues: string[] = [];

        if (!ONE_SIGNAL_REST_API_KEY) {
            issues.push('REST API Key is not set');
        } else if (ONE_SIGNAL_REST_API_KEY.length < 50) {
            issues.push(`REST API Key seems too short (${ONE_SIGNAL_REST_API_KEY.length} chars). Expected 50+ characters.`);
        }

        if (!ONE_SIGNAL_APP_ID) {
            issues.push('App ID is not set');
        }

        const keyPreview = ONE_SIGNAL_REST_API_KEY
            ? (ONE_SIGNAL_REST_API_KEY.length > 14
                ? `${ONE_SIGNAL_REST_API_KEY.substring(0, 10)}...${ONE_SIGNAL_REST_API_KEY.substring(ONE_SIGNAL_REST_API_KEY.length - 4)}`
                : '***')
            : 'NOT SET';

        return {
            appId: ONE_SIGNAL_APP_ID,
            restApiKeyLoaded: !!ONE_SIGNAL_REST_API_KEY,
            restApiKeyLength: ONE_SIGNAL_REST_API_KEY?.length || 0,
            restApiKeyPreview: keyPreview,
            issues,
        };
    },

    /**
     * Identify the user in OneSignal using their Firebase UID
     * Sets the external_id alias so notifications can target users by UID
     */
    async login(uid: string) {
        if (ONESIGNAL_DISABLED || !OneSignal) {
            if (__DEV__) console.log('[OneSignal] DISABLED or not available - skipping login');
            return Promise.resolve();
        }
        
        // Additional safety check: Verify OneSignal is initialized before calling login
        // This prevents "Must call 'initWithContext' before 'login'" errors
        try {
            // Check if OneSignal is initialized by trying to access a property
            if (!OneSignal || typeof OneSignal.login !== 'function') {
                if (__DEV__) console.warn('[OneSignal] OneSignal not properly initialized, skipping login');
                return Promise.resolve();
            }
        } catch (e: any) {
            if (__DEV__) console.warn('[OneSignal] OneSignal initialization check failed, skipping login:', e?.message || 'Unknown error');
            return Promise.resolve();
        }
        
        if (__DEV__) console.log('[OneSignal] Logging in user:', uid ? uid.substring(0, 8) + '...' : 'NULL');
        try {
            // Login sets the user identity and external_id automatically in SDK v5
            OneSignal.login(uid);

            // Explicitly set external_id alias to ensure it's available for targeting
            // This is critical for sending notifications via REST API using external_id
            // Note: addAlias may not be available in all SDK versions, so we catch errors
            try {
                if (OneSignal.User && OneSignal.User.addAlias) {
                    await OneSignal.User.addAlias('external_id', uid);
                    if (__DEV__) console.log('[OneSignal] External ID alias explicitly set');
                }
            } catch (aliasError: any) {
                // If addAlias fails, login() should have set external_id automatically
                if (__DEV__) console.log('[OneSignal] addAlias not available or failed (this is OK if login() sets external_id):', aliasError.message || 'Unknown error');
            }

            if (__DEV__) console.log('[OneSignal] Login complete for:', uid ? uid.substring(0, 8) + '...' : 'NULL');
        } catch (error: any) {
            // Don't throw - just log the error to prevent crashes
            // This handles cases where OneSignal isn't properly initialized
            if (__DEV__) console.error('[OneSignal] Login error (non-critical):', error?.message || 'Unknown error');
        }
        return Promise.resolve();
    },

    /**
     * Logout from OneSignal on sign out
     */
    async logout() {
        if (ONESIGNAL_DISABLED || !OneSignal) {
            if (__DEV__) console.log('[OneSignal] DISABLED or not available - skipping logout');
            return;
        }
        if (__DEV__) console.log('[OneSignal] Logging out');
        OneSignal.logout();
    },

    /**
     * Request permissions manually
     */
    async requestPermissions() {
        if (ONESIGNAL_DISABLED || !OneSignal) {
            if (__DEV__) console.log('[OneSignal] DISABLED or not available - skipping permission request');
            return false;
        }
        if (__DEV__) console.log('[OneSignal] Requesting permissions');
        return OneSignal.Notifications.requestPermission(true);
    },

    /**
     * Listen for notification clicks (Deep Linking)
     */
    addClickListener(handler: (data: any) => void) {
        if (ONESIGNAL_DISABLED || !OneSignal) {
            if (__DEV__) console.log('[OneSignal] DISABLED or not available - skipping click listener');
            return;
        }
        if (__DEV__) console.log('[OneSignal] Adding click listener');
        OneSignal.Notifications.addEventListener('click', (event) => {
            if (__DEV__) console.log('[OneSignal] Notification clicked (sanitized for security)');
            if (event.notification.additionalData) {
                handler(event.notification.additionalData);
            }
        });
    },

    /**
     * Mock for app/index.tsx compatibility
     */
    async registerForPushNotificationsAsync() {
        if (ONESIGNAL_DISABLED || !OneSignal) {
            if (__DEV__) console.log('[OneSignal] DISABLED or not available - returning null token');
            return null;
        }
        if (__DEV__) console.log('[OneSignal] Registering for push (Mock -> Real)');
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
            steps.push(`OneSignal Response Status: ${response.status}`);
            steps.push(`OneSignal Response: ${JSON.stringify(result)}`);

            // Check HTTP status code
            if (!response.ok) {
                const errorMsg = result.errors ? JSON.stringify(result.errors) : `HTTP ${response.status}: ${response.statusText}`;
                return { success: false, steps, error: errorMsg };
            }

            // Check for OneSignal API errors
            if (result.errors) {
                return { success: false, steps, error: JSON.stringify(result.errors) };
            }

            // Check if any recipients were found
            if (result.recipients === 0) {
                return { success: false, steps, error: 'No recipients found. User may not be subscribed or external_id not set.' };
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
        if (!ONE_SIGNAL_REST_API_KEY) {
            if (__DEV__) console.error('[NotificationService] Cannot send notification - REST API key is not configured');
            return;
        }

        // Check if game result notifications are enabled
        const friendProfile = await getUserProfile(friendUid);
        const isGlobalEnabled = friendProfile?.notificationSettings?.globalEnabled ?? true;
        const isGameResultsEnabled = friendProfile?.notificationSettings?.gameResults ?? true;

        if (!isGlobalEnabled || !isGameResultsEnabled) {
            if (__DEV__) console.log(`[NotificationService] Game result notifications disabled for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}`);
            return;
        }

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
                    headings: { en: result.won ? "You Won! 🎉" : "Challenge Complete" },
                    contents: { en: result.won ? `You beat ${result.opponentName} in ${gameName}!` : `${result.opponentName} beat you in ${gameName}.` },
                    data: {
                        type: 'challenge_result',
                        challengeId: result.challengeId,
                        game: gameName
                    }
                })
            });

            const apiResult = await response.json();
            if (__DEV__) console.log(`[NotificationService] notifyChallengeComplete response (sanitized for security)`);

            if (!response.ok || apiResult.errors) {
                if (__DEV__) console.error(`[NotificationService] Failed to send challenge complete notification:`, apiResult.errors || `HTTP ${response.status}`);
            } else if (apiResult.recipients === 0) {
                if (__DEV__) console.warn(`[NotificationService] Challenge complete notification sent but no recipients found for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}`);
            }
        } catch (error: any) {
            if (__DEV__) console.error('[NotificationService] Error notifying challenge complete:', error?.message || 'Unknown error');
        }
    },

    /**
     * Notify friends when a user creates a new pin
     * Includes pin location for deep linking
     */
    async notifyNewPin(friendUid: string, creatorName: string, pinData?: { pinId: string; lat: number; lon: number }) {
        if (__DEV__) console.log(`[NotificationService] notifyNewPin called - friendUid: ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}, creatorName: ${creatorName || 'NONE'}`);

        if (!ONE_SIGNAL_REST_API_KEY) {
            if (__DEV__) console.error('[NotificationService] Cannot send notification - REST API key is not configured');
            return;
        }

        // Check if friend has pin notifications enabled
        const friendProfile = await getUserProfile(friendUid);
        const isGlobalEnabled = friendProfile?.notificationSettings?.globalEnabled ?? true;
        const isPinsEnabled = friendProfile?.notificationSettings?.pinNotifications ?? true;

        if (!isGlobalEnabled || !isPinsEnabled) {
            if (__DEV__) console.log(`[NotificationService] Pin notifications disabled for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}`);
            return;
        }

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
                        creatorName: creatorName,
                        pinId: pinData?.pinId,
                        lat: pinData?.lat,
                        lon: pinData?.lon
                    }
                })
            });
            const result = await response.json();
            if (__DEV__) console.log(`[NotificationService] notifyNewPin response status: ${response.status} (sanitized for security)`);

            if (!response.ok || result.errors) {
                if (__DEV__) console.error(`[NotificationService] Failed to send pin notification:`, result.errors || `HTTP ${response.status}`);
            } else if (result.recipients === 0) {
                if (__DEV__) console.warn(`[NotificationService] Pin notification sent but no recipients found for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}. User may not be subscribed or external_id not set.`);
            } else {
                if (__DEV__) console.log(`[NotificationService] Pin notification sent successfully to ${result.recipients} recipient(s)`);
            }
        } catch (error: any) {
            if (__DEV__) console.error('[NotificationService] Error notifying new pin:', error?.message || 'Unknown error');
        }
    },

    /**
     * Notify friends when a user creates a new story
     * Includes story info for deep linking
     */
    async notifyNewStory(friendUid: string, creatorName: string, storyTitle: string, storyData?: { storyId: string; coverLat?: number; coverLon?: number }) {
        if (__DEV__) console.log(`[NotificationService] notifyNewStory called - friendUid: ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}, creatorName: ${creatorName || 'NONE'}`);
        try {
            const friendProfile = await getUserProfile(friendUid);

            // Check if story notifications are enabled
            const isGlobalEnabled = friendProfile?.notificationSettings?.globalEnabled ?? true;
            const isStoryEnabled = friendProfile?.notificationSettings?.storyNotifications ?? true;

            if (!isGlobalEnabled || !isStoryEnabled) {
                if (__DEV__) console.log(`[NotificationService] Story notifications disabled for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}`);
                return;
            }

            if (!ONE_SIGNAL_REST_API_KEY) {
                if (__DEV__) console.error('[NotificationService] Cannot send notification - REST API key is not configured');
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
                        creatorName: creatorName,
                        storyId: storyData?.storyId,
                        storyTitle: storyTitle,
                        lat: storyData?.coverLat,
                        lon: storyData?.coverLon
                    }
                })
            });
            const result = await response.json();
            if (__DEV__) console.log(`[NotificationService] notifyNewStory response status: ${response.status} (sanitized for security)`);

            if (!response.ok || result.errors) {
                if (__DEV__) console.error(`[NotificationService] Failed to send story notification:`, result.errors || `HTTP ${response.status}`);
            } else if (result.recipients === 0) {
                if (__DEV__) console.warn(`[NotificationService] Story notification sent but no recipients found for ${friendUid ? friendUid.substring(0, 8) + '...' : 'NULL'}. User may not be subscribed or external_id not set.`);
            } else {
                if (__DEV__) console.log(`[NotificationService] Story notification sent successfully to ${result.recipients} recipient(s)`);
            }
        } catch (error: any) {
            if (__DEV__) console.error('[NotificationService] Error notifying new story:', error?.message || 'Unknown error');
        }
    }
};
