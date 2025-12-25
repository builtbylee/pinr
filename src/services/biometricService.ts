import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';

const KEY_EMAIL = 'user_email';
const KEY_PASSWORD = 'user_password';

export const biometricService = {
    /**
     * Check if hardware supports biometrics and if user has enrolled
     */
    async checkAvailability(): Promise<{ available: boolean; type?: string }> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) return { available: false };

        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) return { available: false };

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        let type = 'Biometrics';

        // Prioritize Fingerprint for Android (more common), Face ID for iOS
        if (Platform.OS === 'ios') {
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                type = 'Face ID';
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                type = 'Touch ID';
            }
        } else {
            // Android: Prefer fingerprint (more reliable on most devices)
            if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                type = 'Fingerprint';
            } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                type = 'Face Unlock';
            }
        }

        return { available: true, type };
    },

    /**
     * Prompt user to authenticate
     */
    async authenticate(promptMessage: string = 'Login to 80 Days'): Promise<boolean> {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage,
            fallbackLabel: 'Use Passcode',
            disableDeviceFallback: false,
        });
        return result.success;
    },

    /**
     * Securely store user credentials
     */
    async saveCredentials(email: string, pass: string): Promise<void> {
        if (!email || !pass) return;
        try {
            await SecureStore.setItemAsync(KEY_EMAIL, email);
            await SecureStore.setItemAsync(KEY_PASSWORD, pass);
        } catch (error) {
            console.error('SecureStore Error:', error);
            throw error;
        }
    },

    /**
     * Retrieve stored credentials (if any)
     */
    async getCredentials(): Promise<{ email: string; pass: string } | null> {
        try {
            const email = await SecureStore.getItemAsync(KEY_EMAIL);
            const pass = await SecureStore.getItemAsync(KEY_PASSWORD);

            if (email && pass) {
                return { email, pass };
            }
            return null;
        } catch (error) {
            console.error('SecureStore Retrieval Error:', error);
            return null;
        }
    },

    /**
     * Clear credentials on logout
     */
    async clearCredentials(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(KEY_EMAIL);
            await SecureStore.deleteItemAsync(KEY_PASSWORD);
        } catch (error) {
            console.error('SecureStore Clear Error:', error);
        }
    },
};
