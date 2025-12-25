// Firebase Storage Service
import storage from '@react-native-firebase/storage';

/**
 * Upload an image to Firebase Storage
 * @param uri Local file URI from image picker
 * @param userId User's Firebase UID
 * @param pinId Unique pin identifier
 * @returns Download URL of the uploaded image
 */
export const uploadImage = async (
    uri: string,
    userId: string,
    pinId: string
): Promise<string> => {
    try {
        // Create a reference to the file location
        const reference = storage().ref(`pins/${userId}/${pinId}.jpg`);

        // Upload the file
        console.log('[Storage] Uploading image...', uri);
        await reference.putFile(uri);

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
