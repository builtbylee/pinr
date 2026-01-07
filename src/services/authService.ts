import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Configure Google Sign-In (call this once at app startup)
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
if (!GOOGLE_WEB_CLIENT_ID) {
    console.error('[AuthService] CRITICAL: EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable is not set!');
}


try {
    GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
    });
} catch (error) {
    console.warn('[AuthService] Failed to configure Google Sign-In:', error);
}


// Helper function to ensure Firebase is ready before using auth
// Retries with exponential backoff if Firebase isn't ready
async function ensureFirebaseReady() {
    const { waitForFirebase } = require('./firebaseInitService');

    // Try waiting for Firebase
    try {
        await waitForFirebase();
        console.log('[AuthService] Firebase is ready');
        return;
    } catch (error) {
        console.warn('[AuthService] Firebase wait failed, will retry on actual call:', error);
        // Don't throw yet - we'll retry when actually calling Firebase
    }

    // If waitForFirebase failed, try a few more times with delays
    // Sometimes Firebase just needs a bit more time
    for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));

        try {
            // Try to actually use auth() to see if Firebase is ready
            const authInstance = auth();
            const _ = authInstance.currentUser; // This will throw if not ready
            console.log('[AuthService] Firebase is ready after retry');
            return;
        } catch (error: any) {
            if (attempt === 4) {
                // Last attempt failed
                console.error('[AuthService] Firebase still not ready after retries');
                throw new Error('Firebase is not initialized. Please wait a moment and try again.');
            }
            // Continue to next attempt
        }
    }
}

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> => {
    console.log('[AuthService] ========== signInWithGoogle START ==========');

    // Try to ensure Firebase is ready, but don't block if it fails
    console.log('[AuthService] 🔍 Checking Firebase readiness...');
    try {
        await ensureFirebaseReady();
        console.log('[AuthService] ✅ Firebase is ready');
    } catch (error) {
        console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    // Retry the actual Firebase operations with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        console.log(`[AuthService] 🔄 Google sign-in attempt ${attempt + 1}/5`);
        try {
            // Check if Play Services are available (Android only - skip on iOS)
            const { Platform } = require('react-native');
            console.log('[AuthService] Platform:', Platform.OS);
            if (Platform.OS === 'android') {
                console.log('[AuthService] 📱 Checking Play Services (Android only)...');
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                console.log('[AuthService] ✅ Play Services available');
            } else {
                console.log('[AuthService] 🍎 Skipping Play Services check (iOS)');
            }

            // Get the user's ID token
            console.log('[AuthService] 📱 Calling GoogleSignin.signIn()...');
            const signInStartTime = Date.now();
            const signInResult = await GoogleSignin.signIn();
            const signInDuration = Date.now() - signInStartTime;
            console.log('[AuthService] ✅ GoogleSignin.signIn() succeeded');
            console.log('[AuthService] Sign-in duration:', signInDuration + 'ms');
            const idToken = signInResult.data?.idToken;

            if (!idToken) {
                console.error('[AuthService] ❌ No ID token returned from Google Sign-In');
                throw new Error('No ID token returned from Google Sign-In');
            }
            console.log('[AuthService] ✅ ID token received (length:', idToken.length, ')');

            // Create a Google credential with the token
            console.log('[AuthService] 🔑 Creating Google credential...');
            const googleCredential = auth.GoogleAuthProvider.credential(idToken);
            console.log('[AuthService] ✅ Credential created');

            // Sign-in the user with the credential - this will throw if Firebase isn't ready
            console.log('[AuthService] 🔐 Signing in with credential...');
            const credentialStartTime = Date.now();
            const userCredential = await auth().signInWithCredential(googleCredential);
            const credentialDuration = Date.now() - credentialStartTime;
            console.log('[AuthService] ✅ Sign-in with credential succeeded');
            console.log('[AuthService] Credential sign-in duration:', credentialDuration + 'ms');
            console.log('[AuthService] User ID:', userCredential.user.uid);
            console.log('[AuthService] User email:', userCredential.user.email);
            console.log('[AuthService] Display name:', userCredential.user.displayName);
            console.log('[AuthService] Is new user:', userCredential.additionalUserInfo?.isNewUser ?? false);
            console.log('[AuthService] ========== signInWithGoogle SUCCESS ==========');

            return {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                displayName: userCredential.user.displayName,
                isNewUser: userCredential.additionalUserInfo?.isNewUser ?? false,
            };
        } catch (error: any) {
            lastError = error;

            // Check if it's a Firebase initialization error
            if (error.message?.includes('No Firebase App') || error.message?.includes('initializeApp')) {
                if (attempt < 4) {
                    // Retry after delay
                    const delay = 500 * (attempt + 1);
                    console.log(`[AuthService] Firebase not ready, retrying in ${delay}ms (attempt ${attempt + 1}/5)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    throw new Error('Firebase is still initializing. Please wait a moment and try again.');
                }
            }

            // Handle Google Sign-In specific errors
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                throw new Error('Sign-in was cancelled');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                throw new Error('Sign-in is already in progress');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                throw new Error('Google Play Services is not available');
            }

            // For other errors, throw immediately
            throw error;
        }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Google sign-in failed after retries');
};

/**
 * Sign in with Apple (iOS only)
 * Uses lazy imports to avoid loading native modules on Android or when not needed
 */
export const signInWithApple = async (): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> => {
    console.log('[AuthService] ========== signInWithApple START ==========');
    console.log('[AuthService] Platform:', Platform.OS);

    // Check if we're on Android - expo-apple-authentication is iOS-only
    if (Platform.OS === 'android') {
        throw new Error('Apple Sign-In is currently only available on iOS. Please use Google Sign-In or email/password on Android.');
    }

    // Lazy import native modules only when needed (prevents crash if module not linked)
    let AppleAuthentication: any;
    let Crypto: any;
    try {
        AppleAuthentication = require('expo-apple-authentication');
        Crypto = require('expo-crypto');
    } catch (error: any) {
        console.error('[AuthService] ❌ Failed to load Apple Sign-In modules:', error);
        throw new Error('Apple Sign-In is not available. Please ensure expo-apple-authentication is installed and linked.');
    }

    // Try to ensure Firebase is ready
    try {
        await ensureFirebaseReady();
        console.log('[AuthService] ✅ Firebase is ready');
    } catch (error) {
        console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    try {
        // Generate a secure nonce
        const nonce = Math.random().toString(36).substring(2, 15);
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            nonce
        );
        console.log('[AuthService] Generated nonce');

        // Request Apple Sign-In
        console.log('[AuthService] 📱 Calling AppleAuthentication.signInAsync()...');
        const appleCredential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        });
        console.log('[AuthService] ✅ AppleAuthentication.signInAsync() succeeded');

        if (!appleCredential.identityToken) {
            throw new Error('No identityToken returned from Apple Sign-In');
        }

        const { identityToken, email, fullName } = appleCredential;

        // Create a Firebase credential with the Apple ID token
        console.log('[AuthService] 🔑 Creating Apple credential...');
        console.log('[AuthService] Identity token length:', identityToken?.length || 0);
        console.log('[AuthService] Nonce length:', nonce?.length || 0);
        
        let firebaseCredential;
        try {
            firebaseCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
            console.log('[AuthService] ✅ Credential created');
        } catch (credError: any) {
            console.error('[AuthService] ❌ Failed to create Firebase credential:', credError);
            console.error('[AuthService] Credential error code:', credError.code);
            console.error('[AuthService] Credential error message:', credError.message);
            throw new Error(`Failed to create authentication credential: ${credError.message || 'Unknown error'}`);
        }

        // Sign in the user with the credential
        console.log('[AuthService] 🔐 Signing in with credential...');
        let userCredential;
        try {
            userCredential = await auth().signInWithCredential(firebaseCredential);
            console.log('[AuthService] ✅ Sign-in with credential succeeded');
        } catch (signInError: any) {
            console.error('[AuthService] ❌ Firebase sign-in failed:', signInError);
            console.error('[AuthService] Sign-in error code:', signInError.code);
            console.error('[AuthService] Sign-in error message:', signInError.message);
            
            // Provide more specific error messages
            if (signInError.code === 'auth/invalid-credential') {
                throw new Error('Invalid Apple Sign-In credential. Please try again.');
            } else if (signInError.code === 'auth/credential-already-in-use') {
                throw new Error('This Apple ID is already associated with another account.');
            } else if (signInError.code === 'auth/operation-not-allowed') {
                throw new Error('Apple Sign-In is not enabled. Please contact support.');
            } else {
                throw new Error(signInError.message || 'The authorization attempt failed for an unknown reason');
            }
        }

        const isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;
        const displayName = fullName
            ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
            : userCredential.user.displayName;

        console.log('[AuthService] User ID:', userCredential.user.uid);
        console.log('[AuthService] Is new user:', isNewUser);
        console.log('[AuthService] ========== signInWithApple SUCCESS ==========');

        return {
            uid: userCredential.user.uid,
            email: email || userCredential.user.email,
            displayName: displayName,
            isNewUser: isNewUser,
        };
    } catch (error: any) {
        console.error('[AuthService] ❌ Apple Sign-In failed:', error);
        console.error('[AuthService] Error code:', error.code);
        console.error('[AuthService] Error message:', error.message);

        if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_APPLE_AUTH_CANCELED') {
            throw new Error('Sign-in was cancelled');
        }

        // Handle Firebase auth errors
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/credential-already-in-use') {
            throw new Error('Unable to sign in with Apple. Please try again.');
        }

        // Provide a more user-friendly error message
        const errorMessage = error.message || 'The authorization attempt failed for an unknown reason';
        throw new Error(errorMessage);
    }
};

/**
 * Link an implementation-email/password credential to the current anonymous user.
 * This effectively "upgrades" the anonymous account to a permanent one.
 */
export const linkEmailPassword = async (email: string, password: string): Promise<void> => {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseReady();

        const credential = auth.EmailAuthProvider.credential(email, password);
        const currentUser = auth().currentUser;

        if (currentUser) {
            await currentUser.linkWithCredential(credential);
            console.log('[AuthService] Account linked with email/password');
        } else {
            throw new Error('No user currently signed in');
        }
    } catch (error: any) {
        console.error('[AuthService] Link failed:', error);
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error('This email is already associated with another account.');
        } else if (error.code === 'auth/email-already-in-use') {
            throw new Error('This email is already in use.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password is too weak.');
        }
        throw error;
    }
};

/**
 * Sign in with email and password.
 * Returns the user ID if successful.
 */
export const signInEmailPassword = async (email: string, password: string): Promise<string> => {
    console.log('[AuthService] ========== signInEmailPassword START ==========');
    console.log('[AuthService] Email:', email);
    console.log('[AuthService] Password length:', password.length);

    // Try to ensure Firebase is ready, but don't block if it fails
    console.log('[AuthService] 🔍 Checking Firebase readiness...');
    try {
        await ensureFirebaseReady();
        console.log('[AuthService] ✅ Firebase is ready');
    } catch (error) {
        console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    // Retry the actual Firebase call with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        console.log(`[AuthService] 🔄 Sign-in attempt ${attempt + 1}/5`);
        try {
            const signInStartTime = Date.now();
            const userCredential = await auth().signInWithEmailAndPassword(email, password);
            const signInDuration = Date.now() - signInStartTime;
            const userId = userCredential.user.uid;
            console.log('[AuthService] ✅ Sign-in succeeded');
            console.log('[AuthService] Sign-in duration:', signInDuration + 'ms');
            console.log('[AuthService] User ID:', userId);
            console.log('[AuthService] User email:', userCredential.user.email);

            // Wait a moment for auth state to propagate
            console.log('[AuthService] ⏳ Waiting 100ms for auth state to propagate...');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify user is still available
            const currentUser = auth().currentUser;
            console.log('[AuthService] Current user after wait:', currentUser ? `Found ${currentUser.uid}` : 'NOT FOUND');

            if (!currentUser || currentUser.uid !== userId) {
                console.warn('[AuthService] ⚠️ User not immediately available after sign-in, waiting 200ms more...');
                // Wait a bit more and check again
                await new Promise(resolve => setTimeout(resolve, 200));
                const retryUser = auth().currentUser;
                console.log('[AuthService] Current user after second wait:', retryUser ? `Found ${retryUser.uid}` : 'NOT FOUND');

                if (!retryUser || retryUser.uid !== userId) {
                    console.error('[AuthService] ❌ User state not available after sign-in');
                    throw new Error('Sign-in succeeded but user state not available');
                }
            }

            console.log('[AuthService] ✅ User verified, returning user ID');
            console.log('[AuthService] ========== signInEmailPassword SUCCESS ==========');
            return userId; // Return user ID
        } catch (error: any) {
            lastError = error;
            console.error(`[AuthService] ❌ Sign-in attempt ${attempt + 1} failed`);
            console.error('[AuthService] Error code:', error.code);
            console.error('[AuthService] Error message:', error.message);

            // Check if it's a Firebase initialization error
            if (error.message?.includes('No Firebase App') || error.message?.includes('initializeApp')) {
                if (attempt < 4) {
                    // Retry after delay
                    const delay = 500 * (attempt + 1);
                    console.log(`[AuthService] ⏳ Firebase not ready, retrying in ${delay}ms (attempt ${attempt + 1}/5)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    console.error('[AuthService] ❌ Firebase still not ready after all retries');
                    throw new Error('Firebase is still initializing. Please wait a moment and try again.');
                }
            }

            // Handle auth errors
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                console.error('[AuthService] ❌ Invalid credentials');
                throw new Error('Invalid email or password.');
            } else if (error.code === 'auth/invalid-email') {
                console.error('[AuthService] ❌ Invalid email format');
                throw new Error('Invalid email address.');
            }

            // For other errors, throw immediately
            console.error('[AuthService] ❌ Unexpected error, throwing immediately');
            throw error;
        }
    }

    // If we get here, all retries failed
    console.error('[AuthService] ❌ All sign-in attempts failed');
    console.error('[AuthService] ========== signInEmailPassword FAILED ==========');
    throw lastError || new Error('Sign in failed after retries');
};

/**
 * Send a password reset email.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseReady();

        await auth().sendPasswordResetEmail(email);
        console.log('[AuthService] Password reset email sent to:', email);
    } catch (error: any) {
        console.error('[AuthService] Password reset failed:', error);
        if (error.code === 'auth/user-not-found') {
            // Don't reveal if user exists or not for security, or handle UI specific
            throw new Error('If an account exists with this email, a reset link has been sent.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address.');
        }
        throw error;
    }
};

/**
 * Update the current user's password.
 * Requires recent login (re-authentication might be needed in UI flow).
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseReady();

        const currentUser = auth().currentUser;
        if (currentUser) {
            await currentUser.updatePassword(newPassword);
            console.log('[AuthService] Password updated');
        } else {
            throw new Error('No user currently signed in');
        }
    } catch (error: any) {
        console.error('[AuthService] Update password failed:', error);
        if (error.code === 'auth/requires-recent-login') {
            throw new Error('Please sign out and sign in again to change your password.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password is too weak.');
        }
        throw error;
    }
};

/**
 * Check if the current user is anonymous.
 */
export const isAnonymous = (): boolean => {
    return auth().currentUser?.isAnonymous ?? true;
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
    console.log('[AuthService] ========== signOut START ==========');
    try {
        // Check if user is already signed out
        const currentUser = auth().currentUser;
        if (!currentUser) {
            console.log('[AuthService] ℹ️ No user currently signed in, sign out not needed');
            return;
        }

        await auth().signOut();
        console.log('[AuthService] ✅ User signed out successfully');
    } catch (error: any) {
        // Ignore "no-current-user" errors - user is already signed out
        if (error.code === 'auth/no-current-user' || error.message?.includes('No user currently signed in')) {
            console.log('[AuthService] ℹ️ User already signed out, ignoring error');
            return;
        }
        console.error('[AuthService] ❌ Sign out failed:', error);
        throw error;
    }
    console.log('[AuthService] ========== signOut END ==========');
};

/**
 * Get current user email
 */
export const getCurrentEmail = (): string | null => {
    return auth().currentUser?.email || null;
};

/**
 * Get current user object
 */
export const getCurrentUser = () => {
    return auth().currentUser;
};

/**
 * Sign in anonymously
 */
export const signInAnonymously = async (): Promise<string | null> => {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseReady();

        const userCredential = await auth().signInAnonymously();
        return userCredential.user.uid;
    } catch (error) {
        console.error('[AuthService] Anonymous sign-in failed:', error);
        return null;
    }
};


/**
 * Sign up with email and password.
 */
export const signUpWithEmail = async (email: string, password: string): Promise<string> => {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseReady();

        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        return userCredential.user.uid;
    } catch (error: any) {
        console.error('[AuthService] Sign up failed:', error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('That email address is already in use!');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('That email address is invalid!');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password is too weak!');
        }
        throw error;
    }
};

/**
 * Subscribe to auth state changes
 * Waits for Firebase to be initialized before subscribing
 * Returns a Promise that resolves to the unsubscribe function
 */
export const onAuthStateChanged = async (callback: (userId: string | null) => void): Promise<() => void> => {
    // Import here to avoid circular dependency
    const { waitForFirebase } = require('./firebaseInitService');

    // Try to wait for Firebase, but don't block forever
    try {
        await waitForFirebase();
    } catch (error) {
        console.warn('[AuthService] Firebase wait failed, will retry on actual call:', error);
    }

    // Retry subscribing to auth state with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            // Try to subscribe to auth state changes
            const unsubscribe = auth().onAuthStateChanged(user => {
                callback(user ? user.uid : null);
            });

            console.log('[AuthService] Successfully subscribed to auth state changes');
            return unsubscribe;
        } catch (error: any) {
            lastError = error;
            console.error(`[AuthService] Failed to subscribe to auth state (attempt ${attempt + 1}/5):`, error);

            // Check if it's a Firebase initialization error
            if (error.message?.includes('No Firebase App') || error.message?.includes('initializeApp')) {
                if (attempt < 4) {
                    // Retry after delay
                    const delay = 500 * (attempt + 1);
                    console.log(`[AuthService] Firebase not ready, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    // Last attempt failed - return a no-op function
                    console.error('[AuthService] Firebase still not ready after retries, returning no-op unsubscribe');
                    return () => { };
                }
            }

            // For other errors, throw immediately
            throw error;
        }
    }

    // If all retries failed, return a no-op function
    console.error('[AuthService] All retries failed, returning no-op unsubscribe');
    return () => { };
};

/**
 * Delete the current user's account.
 */
export const deleteAccount = async () => {
    const user = auth().currentUser;
    if (user) {
        await user.delete();
        console.log('[AuthService] User account deleted');
    }
};

/**
 * Re-authenticate the user with their password.
 * Required for sensitive operations like account deletion.
 */
export const reauthenticateUser = async (password: string) => {
    const user = auth().currentUser;
    if (!user || !user.email) throw new Error('No user found');

    const credential = auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(credential);
    console.log('[AuthService] User re-authenticated');
};

/**
 * Delete the current user account (for signup cleanup when username is taken)
 */
export const deleteCurrentUser = async (): Promise<void> => {
    const user = auth().currentUser;
    if (user) {
        await user.delete();
        console.log('[AuthService] Current user deleted (signup cleanup)');
    }
};
