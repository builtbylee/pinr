// Firebase Storage Service
import storage from '@react-native-firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';

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
        console.log('[Storage] Compressing image...');

        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: MAX_IMAGE_DIMENSION } }], // Resize width, height auto-scales
            {
                compress: IMAGE_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        console.log('[Storage] Compression complete:', result.uri);
        return result.uri;
    } catch (error) {
        console.warn('[Storage] Compression failed, using original:', error);
        return uri; // Fallback to original if compression fails
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
        console.log('[Storage] Uploading image...', imageUri);
        await reference.putFile(imageUri);

        // Get the download URL
        const downloadUrl = await reference.getDownloadURL();
        console.log('[Storage] Upload complete:', downloadUrl);

        return downloadUrl;
    } catch (error) {
        console.error('[Storage] Upload failed:', error);
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
        console.log('[Storage] Image deleted');
    } catch (error) {
        console.error('[Storage] Delete failed:', error);
        // Don't throw - image might not exist
    }
};

