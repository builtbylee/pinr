// Firebase Storage Service
import storage from '@react-native-firebase/storage';
import { moderateImage } from './ModerationService';
// Image compression settings
const MAX_IMAGE_DIMENSION = 1200; // Max width or height
const IMAGE_QUALITY = 0.9; // 90% quality (nearly lossless)

/**
 * Compress an image before upload
 * - Resizes to max 1200px (maintaining aspect ratio)
 * - Compresses to 90% JPEG quality
 * - Typically reduces file size by 50-70%
 */
const compressImage = async (uri: string): Promise<string> => {
    try {
        if (__DEV__) console.log('[Storage] Compressing image...');

        // Lazy load ImageManipulator to prevent startup crashes on old APKs
        // that don't have the native module installed yet.
        const ImageManipulator = require('expo-image-manipulator');

        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: MAX_IMAGE_DIMENSION } }], // Resize width, height auto-scales
            {
                compress: IMAGE_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        if (__DEV__) console.log('[Storage] Compression complete:', result.uri);
        return result.uri;
    } catch (error) {
        if (__DEV__) console.warn('[Storage] Compression failed or module missing, using original:', error);
        return uri; // Fallback to original if compression fails or module missing
    }
};

/**
 * Upload an image to Firebase Storage
 * @param uri Local file URI from image picker
 * @param userId User's Firebase UID
 * @param pinId Unique pin identifier
 * @param skipCompression Skip compression (for already-optimized images)
 * @returns Download URL of the uploaded image
 */
export const uploadImage = async (
    uri: string,
    userId: string,
    pinId: string,
    skipCompression = false
): Promise<string> => {
    try {
        // Compress image before upload (unless skipped)
        const imageUri = skipCompression ? uri : await compressImage(uri);

        // Create a reference to the file location
        const reference = storage().ref(`pins/${userId}/${pinId}.jpg`);

        // Upload the file
        if (__DEV__) console.log('[Storage] Uploading image...', imageUri);
        await reference.putFile(imageUri);

        // Get the download URL
        const downloadUrl = await reference.getDownloadURL();
        if (__DEV__) console.log('[Storage] Upload complete:', downloadUrl);

        // Moderate the uploaded image
        if (__DEV__) console.log('[Storage] Checking image moderation...');
        const moderationResult = await moderateImage(downloadUrl);

        if (!moderationResult.approved) {
            // Image failed moderation - delete it and throw error
            if (__DEV__) console.warn('[Storage] Image failed moderation:', moderationResult.reason);
            try {
                await reference.delete();
                if (__DEV__) console.log('[Storage] Deleted image that failed moderation');
            } catch (deleteError) {
                if (__DEV__) console.error('[Storage] Failed to delete moderated image:', deleteError);
            }
            throw new Error(moderationResult.reason || 'This image violates our content guidelines and cannot be uploaded.');
        }

        if (__DEV__) console.log('[Storage] Image passed moderation');
        return downloadUrl;
    } catch (error) {
        if (__DEV__) console.error('[Storage] Upload failed:', error);
        throw error;
    }
};

/**
 * Delete an image from Firebase Storage
 * @param userId User's Firebase UID  
 * @param pinId Unique pin identifier
 */
export const deleteImage = async (userId: string, pinId: string): Promise<void> => {
    try {
        const reference = storage().ref(`pins/${userId}/${pinId}.jpg`);
        await reference.delete();
        if (__DEV__) console.log('[Storage] Image deleted');
    } catch (error) {
        if (__DEV__) console.error('[Storage] Delete failed:', error);
        // Don't throw - image might not exist
    }
};

