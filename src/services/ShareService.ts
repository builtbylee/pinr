// Share Service - Handles app invites and content sharing
// NOTE: Using only React Native's built-in Share API until native rebuild adds expo-sharing and view-shot
import { Share, Platform } from 'react-native';

const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.builtbylee.app80days';
const APP_NAME = 'Pinr';

export const shareService = {
    /**
     * Check if sharing is available on this device
     */
    async isAvailable(): Promise<boolean> {
        // Built-in Share is always available
        return true;
    },

    /**
     * Share app invite link with message
     */
    async shareAppInvite(customMessage?: string): Promise<boolean> {
        try {
            const message = customMessage ||
                `Join me on ${APP_NAME}! Pin your travels, share memories with friends, and play geography games 🌍\n\n${APP_STORE_URL}`;

            await Share.share({
                message: message,
                title: `Join me on ${APP_NAME}!`,
            });

            console.log('[ShareService] App invite shared successfully');
            return true;
        } catch (error) {
            console.error('[ShareService] Share app invite failed:', error);
            return false;
        }
    },

    /**
     * Share a pin as text (image sharing requires native rebuild)
     */
    async sharePin(pinTitle: string, locationName: string, pinId: string, username?: string): Promise<boolean> {
        try {
            const pinUrl = `https://builtbylee.github.io/pinr/pin.html?id=${pinId}`;
            const viewText = username ? `View ${username}'s pin on Pinr` : 'View this pin on Pinr';
            const message = `📍 ${pinTitle} - ${locationName}\n\n${viewText}: ${pinUrl}`;

            await Share.share({
                message: message,
                title: `Check out my pin!`,
            });

            console.log('[ShareService] Pin shared successfully');
            return true;
        } catch (error) {
            console.error('[ShareService] Share pin failed:', error);
            return false;
        }
    },

    /**
     * Share a journey/story as text (image sharing requires native rebuild)
     */
    async shareJourney(storyTitle: string): Promise<boolean> {
        try {
            const message = `🗺️ ${storyTitle}\n\nShared from ${APP_NAME} - Create your travel story! ${APP_STORE_URL}`;

            await Share.share({
                message: message,
                title: storyTitle,
            });

            console.log('[ShareService] Journey shared successfully');
            return true;
        } catch (error) {
            console.error('[ShareService] Share journey failed:', error);
            return false;
        }
    },
};
