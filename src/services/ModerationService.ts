import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface ModerationResult {
    approved: boolean;
    reason: string | null;
    error?: string;
}

/**
 * Moderate an image URL using Cloud Vision API
 * @param imageUrl - The public URL of the image to check
 * @returns Whether the image is approved or blocked
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
    try {
        const moderate = httpsCallable(functions, 'moderateImage');
        const result = await moderate({ imageUrl });
        return result.data as ModerationResult;
    } catch (error: any) {
        console.error('Image moderation error:', error);
        // Fail open on error - allow the image but log
        return { approved: true, reason: null, error: error.message };
    }
}

/**
 * Check if an image passes moderation before upload
 * This is a wrapper that handles the full flow including alerts
 */
export async function checkImageModeration(imageUrl: string): Promise<{
    passed: boolean;
    message?: string;
}> {
    const result = await moderateImage(imageUrl);

    if (!result.approved) {
        return {
            passed: false,
            message: result.reason || 'This image violates our content guidelines and cannot be uploaded.',
        };
    }

    return { passed: true };
}
