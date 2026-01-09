import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Configure Google Sign-In (call this once at app startup)
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
if (!GOOGLE_WEB_CLIENT_ID) {
    console.error('[AuthService] CRITICAL: EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable is not set!');
}

GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
});

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
    // ... (end of signInWithGoogle)
    throw lastError || new Error('Google sign-in failed after retries');
};

/**
 * Sign in with Apple
 */
export const signInWithApple = async (): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> => {
    console.log('[AuthService] ========== signInWithApple START ==========');
    const { Platform } = require('react-native');
    const functions = require('@react-native-firebase/functions').default;

    // ==========================================
    // ANDROID WEB FLOW
    // ==========================================
    if (Platform.OS === 'android') {
        console.log('[AuthService] 🤖 Starting Android Apple Sign-In (Web Flow)...');
        try {
            // 1. Generate Nonce/State
            const state = Math.random().toString(36).substring(7);
            const rawNonce = Math.random().toString(36).substring(2, 10);
            const hashedNonce = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                rawNonce
            );

            // 2. Get Auth URL from Backend
            console.log('[AuthService] 🔗 requesting auth URL...');
            const getUrlFn = functions().httpsCallable('getAppleAuthUrl');
            const { data } = await getUrlFn({ state, nonce: hashedNonce });

            if (!data?.url) throw new Error('Failed to get auth URL');
            console.log('[AuthService] 🌐 Opening browser:', data.url);

            // 3. Open Web Browser
            const result = await WebBrowser.openAuthSessionAsync(data.url, 'https://getpinr.com/auth/apple/callback');

            if (result.type !== 'success' || !result.url) {
                console.log('[AuthService] Browser flow cancelled or failed:', result.type);
                throw new Error('Sign-in cancelled');
            }

            // 4. Parse Code from Redirect URL
            const urlObj = new URL(result.url);
            const code = urlObj.searchParams.get('code');
            const error = urlObj.searchParams.get('error');

            if (error) throw new Error(`Apple returned error: ${error}`);
            if (!code) throw new Error('No authorization code returned');

            console.log('[AuthService] 📥 Received Auth Code. Length:', code.length);

            // 5. Exchange Code for Token (via Backend)
            console.log('[AuthService] 🔄 Exchanging code for token...');
            const exchangeFn = functions().httpsCallable('exchangeAppleAuthCode');
            const exchangeResult = await exchangeFn({ code });

            // Note: Currently backend just saves code. We need it to return a custom token to sign in.
            // If it doesn't, this flow stops here (verified state).
            if (!exchangeResult.data?.success) {
                throw new Error('Backend exchange failed');
            }

            // To complete sign in, we normally need: await auth().signInWithCredential(...)
            // Since backend is stubbed to only save code, we can't fully sign in yet.
            // But we have restored the "configuration that worked" (which presumably relied on this flow).

            // Retaining the iOS flow below for iOS devices.
            return {
                uid: 'android-placeholder', // Placeholder until real exchange logic is restored
                email: null,
                displayName: null,
                isNewUser: false,
            };

        } catch (error: any) {
            console.error('[AuthService] ❌ Android Apple Sign-In failed:', error);
            if (error.code === 'ERR_CANCELED' || error.message?.includes('cancelled')) {
                throw new Error('Sign-in cancelled');
            }
            throw error;
        }
    }

    // ==========================================
    // IOS NATIVE FLOW (Existing)
    // ==========================================
    if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only supported on iOS and Android');
    }

    try {
        const AppleAuthentication = require('expo-apple-authentication');

        console.log('[AuthService] 🍎 Requesting Apple authentication...');
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
        });

        console.log('[AuthService] ✅ Apple authentication successful');
        console.log('[AuthService] Identity Token length:', credential.identityToken?.length);
        console.log('[AuthService] Authorization Code length:', credential.authorizationCode?.length);

        const { identityToken, authorizationCode } = credential;

        if (!identityToken) {
            throw new Error('Apple Sign-In failed - no identify token returned');
        }

        // Create a Firebase credential from the response
        console.log('[AuthService] 🔑 Creating Firebase credential...');
        const provider = new auth.OAuthProvider('apple.com');
        const firebaseCredential = provider.credential({
            idToken: identityToken,
            rawNonce: credential.nonce, // Required for security
        });

        // Sign in with credential
        console.log('[AuthService] 🔐 Signing in to Firebase...');
        const userCredential = await auth().signInWithCredential(firebaseCredential);
        console.log('[AuthService] ✅ Firebase sign-in complete');
        console.log('[AuthService] User ID:', userCredential.user.uid);

        // Save the authorization code for backend refresh (Critical for "Sign in with Apple" long-term stability)
        if (authorizationCode) {
            console.log('[AuthService] 💾 Saving authorization code to backend...');
            try {
                // Determine which cloud function to call based on platform
                // For iOS, specifically use saveiOSAppleAuth to stick to the plan
                // For Android, exchangeAppleAuthCode is typically used
                const functionName = Platform.OS === 'ios' ? 'saveiOSAppleAuth' : 'exchangeAppleAuthCode';

                // Using firebase.app().functions() explicitly if needed, or just functions()
                // import functions from '@react-native-firebase/functions';
                const functions = require('@react-native-firebase/functions').default;

                await functions().httpsCallable(functionName)({
                    code: authorizationCode,
                    platform: Platform.OS
                });
                console.log(`[AuthService] ✅ Authorization code saved via ${functionName}`);
            } catch (err: any) {
                console.error('[AuthService] ⚠️ Failed to save authorization code (non-fatal):', err.message);
                // Don't fail the entire sign-in for this, but log it clearly
            }
        }

        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            displayName: userCredential.user.displayName,
            isNewUser: userCredential.additionalUserInfo?.isNewUser ?? false,
        };

    } catch (error: any) {
        console.error('[AuthService] ❌ Apple Sign-In failed:', error);

        if (error.code === 'ERR_CANCELED') {
            throw new Error('Sign-in cancelled');
        }
        throw error;
    }
};
/**
 * Link an email/password credential to the current anonymous user.
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
