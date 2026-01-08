import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Configure Google Sign-In (call this once at app startup)
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
if (!GOOGLE_WEB_CLIENT_ID) {
    if (__DEV__) console.error('[AuthService] CRITICAL: EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable is not set!');
}


try {
    GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
    });
} catch (error: any) {
    if (__DEV__) console.warn('[AuthService] Failed to configure Google Sign-In:', error?.message || 'Unknown error');
}


// Helper function to ensure Firebase is ready before using auth
// Retries with exponential backoff if Firebase isn't ready
async function ensureFirebaseReady() {
    const { waitForFirebase } = require('./firebaseInitService');

    // Try waiting for Firebase
    try {
        await waitForFirebase();
        if (__DEV__) console.log('[AuthService] Firebase is ready');
        return;
    } catch (error: any) {
        if (__DEV__) console.warn('[AuthService] Firebase wait failed, will retry on actual call:', error?.message || 'Unknown error');
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
            if (__DEV__) console.log('[AuthService] Firebase is ready after retry');
            return;
        } catch (error: any) {
            if (attempt === 4) {
                // Last attempt failed
                if (__DEV__) console.error('[AuthService] Firebase still not ready after retries');
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
    if (__DEV__) console.log('[AuthService] ========== signInWithGoogle START ==========');

    // Try to ensure Firebase is ready, but don't block if it fails
    if (__DEV__) console.log('[AuthService] 🔍 Checking Firebase readiness...');
    try {
        await ensureFirebaseReady();
        if (__DEV__) console.log('[AuthService] ✅ Firebase is ready');
    } catch (error: any) {
        if (__DEV__) console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    // Retry the actual Firebase operations with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        if (__DEV__) console.log(`[AuthService] 🔄 Google sign-in attempt ${attempt + 1}/5`);
        try {
            // Check if Play Services are available (Android only - skip on iOS)
            const { Platform } = require('react-native');
            if (__DEV__) console.log('[AuthService] Platform:', Platform.OS);
            if (Platform.OS === 'android') {
                if (__DEV__) console.log('[AuthService] 📱 Checking Play Services (Android only)...');
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                if (__DEV__) console.log('[AuthService] ✅ Play Services available');
            } else {
                if (__DEV__) console.log('[AuthService] 🍎 Skipping Play Services check (iOS)');
            }

            // Get the user's ID token
            if (__DEV__) console.log('[AuthService] 📱 Calling GoogleSignin.signIn()...');
            const signInStartTime = Date.now();
            const signInResult = await GoogleSignin.signIn();
            const signInDuration = Date.now() - signInStartTime;
            if (__DEV__) console.log('[AuthService] ✅ GoogleSignin.signIn() succeeded');
            if (__DEV__) console.log('[AuthService] Sign-in duration:', signInDuration + 'ms');
            const idToken = signInResult.data?.idToken;

            if (!idToken) {
                if (__DEV__) console.error('[AuthService] ❌ No ID token returned from Google Sign-In');
                throw new Error('No ID token returned from Google Sign-In');
            }
            if (__DEV__) console.log('[AuthService] ✅ ID token received (length:', idToken.length, ')');

            // Create a Google credential with the token
            if (__DEV__) console.log('[AuthService] 🔑 Creating Google credential...');
            const googleCredential = auth.GoogleAuthProvider.credential(idToken);
            if (__DEV__) console.log('[AuthService] ✅ Credential created');

            // Sign-in the user with the credential - this will throw if Firebase isn't ready
            if (__DEV__) console.log('[AuthService] 🔐 Signing in with credential...');
            const credentialStartTime = Date.now();
            const userCredential = await auth().signInWithCredential(googleCredential);
            const credentialDuration = Date.now() - credentialStartTime;
            if (__DEV__) console.log('[AuthService] ✅ Sign-in with credential succeeded');
            if (__DEV__) console.log('[AuthService] Credential sign-in duration:', credentialDuration + 'ms');
            if (__DEV__) console.log('[AuthService] User ID:', userCredential.user.uid ? userCredential.user.uid.substring(0, 8) + '...' : 'NULL');
            if (__DEV__) console.log('[AuthService] User email:', userCredential.user.email ? userCredential.user.email.substring(0, 10) + '...' : 'NULL');
            if (__DEV__) console.log('[AuthService] Display name:', userCredential.user.displayName || 'NONE');
            if (__DEV__) console.log('[AuthService] Is new user:', userCredential.additionalUserInfo?.isNewUser ?? false);
            if (__DEV__) console.log('[AuthService] ========== signInWithGoogle SUCCESS ==========');

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
                    if (__DEV__) console.log(`[AuthService] Firebase not ready, retrying in ${delay}ms (attempt ${attempt + 1}/5)`);
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
 * Sign in with Apple (iOS and Android)
 * iOS: Uses native expo-apple-authentication
 * Android: Uses Firebase Auth web-based OAuth flow via browser
 */
export const signInWithApple = async (): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> => {
    if (__DEV__) console.log('[AuthService] ========== signInWithApple START ==========');
    if (__DEV__) console.log('[AuthService] Platform:', Platform.OS);

    // Android: Use web-based OAuth flow
    if (Platform.OS === 'android') {
        return await signInWithAppleAndroid();
    }

    // Lazy import native modules only when needed (prevents crash if module not linked)
    let AppleAuthentication: any;
    let Crypto: any;
    try {
        AppleAuthentication = require('expo-apple-authentication');
        Crypto = require('expo-crypto');
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] ❌ Failed to load Apple Sign-In modules:', error?.message || 'Unknown error');
        throw new Error('Apple Sign-In is not available. Please ensure expo-apple-authentication is installed and linked.');
    }

    // Try to ensure Firebase is ready
    try {
        await ensureFirebaseReady();
        if (__DEV__) console.log('[AuthService] ✅ Firebase is ready');
    } catch (error: any) {
        if (__DEV__) console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    try {
        // Generate a secure nonce using cryptographically secure random bytes
        // Use getRandomBytes which returns Uint8Array synchronously (crypto-secure)
        const randomBytes = Crypto.getRandomBytes(16);
        const nonce = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            nonce
        );
        if (__DEV__) console.log('[AuthService] Generated nonce');

        // Request Apple Sign-In
        if (__DEV__) console.log('[AuthService] 📱 Calling AppleAuthentication.signInAsync()...');
        const appleCredential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        });
        if (__DEV__) console.log('[AuthService] ✅ AppleAuthentication.signInAsync() succeeded');

        if (!appleCredential.identityToken) {
            throw new Error('No identityToken returned from Apple Sign-In');
        }

        const { identityToken, email, fullName } = appleCredential;

        // Create a Firebase credential with the Apple ID token
        if (__DEV__) console.log('[AuthService] 🔑 Creating Apple credential...');
        if (__DEV__) console.log('[AuthService] Identity token length:', identityToken?.length || 0);
        if (__DEV__) console.log('[AuthService] Nonce length:', nonce?.length || 0);
        
        let firebaseCredential;
        try {
            firebaseCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
            if (__DEV__) console.log('[AuthService] ✅ Credential created');
        } catch (credError: any) {
            if (__DEV__) console.error('[AuthService] ❌ Failed to create Firebase credential:', credError?.message || 'Unknown error');
            if (__DEV__) console.error('[AuthService] Credential error code:', credError.code || 'N/A');
            if (__DEV__) console.error('[AuthService] Credential error message:', credError.message || 'Unknown error');
            throw new Error(`Failed to create authentication credential: ${credError.message || 'Unknown error'}`);
        }

        // Sign in the user with the credential
        if (__DEV__) console.log('[AuthService] 🔐 Signing in with credential...');
        let userCredential;
        try {
            userCredential = await auth().signInWithCredential(firebaseCredential);
            if (__DEV__) console.log('[AuthService] ✅ Sign-in with credential succeeded');
        } catch (signInError: any) {
            if (__DEV__) console.error('[AuthService] ❌ Firebase sign-in failed:', signInError?.message || 'Unknown error');
            if (__DEV__) console.error('[AuthService] Sign-in error code:', signInError.code || 'N/A');
            if (__DEV__) console.error('[AuthService] Sign-in error message:', signInError.message || 'Unknown error');
            
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

        if (__DEV__) console.log('[AuthService] User ID:', userCredential.user.uid ? userCredential.user.uid.substring(0, 8) + '...' : 'NULL');
        if (__DEV__) console.log('[AuthService] Is new user:', isNewUser);
        if (__DEV__) console.log('[AuthService] ========== signInWithApple SUCCESS ==========');

        return {
            uid: userCredential.user.uid,
            email: email || userCredential.user.email,
            displayName: displayName,
            isNewUser: isNewUser,
        };
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] ❌ Apple Sign-In failed:', error?.message || 'Unknown error');
        if (__DEV__) console.error('[AuthService] Error code:', error.code || 'N/A');
        if (__DEV__) console.error('[AuthService] Error message:', error.message || 'Unknown error');

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
 * Sign in with Apple on Android using Firebase Auth web-based OAuth flow
 * This requires:
 * 1. Apple Developer account with Service ID configured
 * 2. Firebase project with Apple provider enabled
 * 3. Redirect URI configured in Apple Developer portal
 * 4. Cloud Functions: getAppleAuthUrl and exchangeAppleAuthCode
 */
async function signInWithAppleAndroid(): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> {
    if (__DEV__) console.log('[AuthService] ========== signInWithAppleAndroid START ==========');
    
    try {
        await ensureFirebaseReady();
        if (__DEV__) console.log('[AuthService] ✅ Firebase is ready');
    } catch (error: any) {
        if (__DEV__) console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    try {
        // Generate a secure nonce
        const Crypto = require('expo-crypto');
        const randomBytes = Crypto.getRandomBytes(16);
        const nonce = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            nonce
        );
        if (__DEV__) console.log('[AuthService] Generated nonce for Android');

        // Use Firebase Cloud Functions to handle OAuth flow
        const functions = require('@react-native-firebase/functions').default();
        
        try {
            if (__DEV__) console.log('[AuthService] Attempting to use Cloud Function for Apple Sign-In...');
            
            // Call Cloud Function to get OAuth URL
            const getAppleAuthUrl = functions().httpsCallable('getAppleAuthUrl');
            const urlResult = await getAppleAuthUrl({ nonce: hashedNonce });
            
            if (urlResult.data?.authUrl) {
                // Open browser for OAuth flow
                const authUrl = urlResult.data.authUrl;
                if (__DEV__) console.log('[AuthService] Opening OAuth URL in browser...');
                
                // Use HTTPS callback URL (Service IDs only support HTTPS, not custom schemes)
                const redirectUri = 'https://getpinr.com/auth/apple/callback';
                const result = await WebBrowser.openAuthSessionAsync(
                    authUrl,
                    redirectUri
                );
                
                if (result.type === 'success' && result.url) {
                    // Extract authorization code from callback URL
                    const url = new URL(result.url);
                    const code = url.searchParams.get('code');
                    const state = url.searchParams.get('state');
                    
                    if (!code) {
                        throw new Error('No authorization code received from Apple');
                    }
                    
                    // Exchange authorization code for ID token via Cloud Function
                    const exchangeCode = functions().httpsCallable('exchangeAppleAuthCode');
                    const tokenResult = await exchangeCode({ 
                        code, 
                        nonce: hashedNonce,
                        state 
                    });
                    
                    if (tokenResult.data?.identityToken) {
                        const identityToken = tokenResult.data.identityToken;
                        const email = tokenResult.data.email || null;
                        const fullName = tokenResult.data.fullName || null;
                        
                        // Create Firebase credential
                        const firebaseCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
                        
                        // Sign in with credential
                        const userCredential = await auth().signInWithCredential(firebaseCredential);
                        
                        const isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;
                        const displayName = fullName
                            ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
                            : userCredential.user.displayName;
                        
                        if (__DEV__) console.log('[AuthService] ✅ Apple Sign-In on Android succeeded');
                        
                        return {
                            uid: userCredential.user.uid,
                            email: email || userCredential.user.email,
                            displayName: displayName,
                            isNewUser: isNewUser,
                        };
                    } else {
                        throw new Error('Failed to exchange authorization code for ID token');
                    }
                } else if (result.type === 'cancel') {
                    throw new Error('Sign-in was cancelled');
                } else {
                    throw new Error('Apple Sign-In failed: ' + (result.type || 'Unknown error'));
                }
            } else {
                throw new Error('Cloud Function did not return OAuth URL');
            }
        } catch (cloudFunctionError: any) {
            if (__DEV__) console.error('[AuthService] Cloud Function approach failed:', cloudFunctionError?.message || 'Unknown error');
            
            // Fallback: Show helpful error message
            throw new Error(
                'Apple Sign-In on Android requires backend setup. ' +
                'Please configure the Apple Sign-In Cloud Functions or use Google Sign-In instead.'
            );
        }
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] ❌ Apple Sign-In on Android failed:', error?.message || 'Unknown error');
        
        if (error.message === 'Sign-in was cancelled') {
            throw new Error('Sign-in was cancelled');
        }
        
        throw error;
    }
}

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
            if (__DEV__) console.log('[AuthService] Account linked with email/password');
        } else {
            throw new Error('No user currently signed in');
        }
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] Link failed:', error?.message || 'Unknown error');
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
    if (__DEV__) console.log('[AuthService] ========== signInEmailPassword START ==========');
    if (__DEV__) console.log('[AuthService] Email:', email ? email.substring(0, 10) + '...' : 'NULL');
    if (__DEV__) console.log('[AuthService] Password length:', password.length);

    // Try to ensure Firebase is ready, but don't block if it fails
    if (__DEV__) console.log('[AuthService] 🔍 Checking Firebase readiness...');
    try {
        await ensureFirebaseReady();
        if (__DEV__) console.log('[AuthService] ✅ Firebase is ready');
    } catch (error: any) {
        if (__DEV__) console.warn('[AuthService] ⚠️ Firebase wait failed, will retry on actual call');
    }

    // Retry the actual Firebase call with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        if (__DEV__) console.log(`[AuthService] 🔄 Sign-in attempt ${attempt + 1}/5`);
        try {
            const signInStartTime = Date.now();
            const userCredential = await auth().signInWithEmailAndPassword(email, password);
            const signInDuration = Date.now() - signInStartTime;
            const userId = userCredential.user.uid;
            if (__DEV__) console.log('[AuthService] ✅ Sign-in succeeded');
            if (__DEV__) console.log('[AuthService] Sign-in duration:', signInDuration + 'ms');
            if (__DEV__) console.log('[AuthService] User ID:', userId ? userId.substring(0, 8) + '...' : 'NULL');
            if (__DEV__) console.log('[AuthService] User email:', userCredential.user.email ? userCredential.user.email.substring(0, 10) + '...' : 'NULL');

            // Wait a moment for auth state to propagate
            if (__DEV__) console.log('[AuthService] ⏳ Waiting 100ms for auth state to propagate...');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify user is still available
            const currentUser = auth().currentUser;
            if (__DEV__) console.log('[AuthService] Current user after wait:', currentUser ? `Found ${currentUser.uid ? currentUser.uid.substring(0, 8) + '...' : 'NULL'}` : 'NOT FOUND');

            if (!currentUser || currentUser.uid !== userId) {
                if (__DEV__) console.warn('[AuthService] ⚠️ User not immediately available after sign-in, waiting 200ms more...');
                // Wait a bit more and check again
                await new Promise(resolve => setTimeout(resolve, 200));
                const retryUser = auth().currentUser;
                if (__DEV__) console.log('[AuthService] Current user after second wait:', retryUser ? `Found ${retryUser.uid ? retryUser.uid.substring(0, 8) + '...' : 'NULL'}` : 'NOT FOUND');

                if (!retryUser || retryUser.uid !== userId) {
                    if (__DEV__) console.error('[AuthService] ❌ User state not available after sign-in');
                    throw new Error('Sign-in succeeded but user state not available');
                }
            }

            if (__DEV__) console.log('[AuthService] ✅ User verified, returning user ID');
            if (__DEV__) console.log('[AuthService] ========== signInEmailPassword SUCCESS ==========');
            return userId; // Return user ID
        } catch (error: any) {
            lastError = error;
            if (__DEV__) console.error(`[AuthService] ❌ Sign-in attempt ${attempt + 1} failed`);
            if (__DEV__) console.error('[AuthService] Error code:', error.code || 'N/A');
            if (__DEV__) console.error('[AuthService] Error message:', error.message || 'Unknown error');

            // Check if it's a Firebase initialization error
            if (error.message?.includes('No Firebase App') || error.message?.includes('initializeApp')) {
                if (attempt < 4) {
                    // Retry after delay
                    const delay = 500 * (attempt + 1);
                    if (__DEV__) console.log(`[AuthService] ⏳ Firebase not ready, retrying in ${delay}ms (attempt ${attempt + 1}/5)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    if (__DEV__) console.error('[AuthService] ❌ Firebase still not ready after all retries');
                    throw new Error('Firebase is still initializing. Please wait a moment and try again.');
                }
            }

            // Handle auth errors
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                if (__DEV__) console.error('[AuthService] ❌ Invalid credentials');
                throw new Error('Invalid email or password.');
            } else if (error.code === 'auth/invalid-email') {
                if (__DEV__) console.error('[AuthService] ❌ Invalid email format');
                throw new Error('Invalid email address.');
            }

            // For other errors, throw immediately
            if (__DEV__) console.error('[AuthService] ❌ Unexpected error, throwing immediately');
            throw error;
        }
    }

    // If we get here, all retries failed
    if (__DEV__) console.error('[AuthService] ❌ All sign-in attempts failed');
    if (__DEV__) console.error('[AuthService] ========== signInEmailPassword FAILED ==========');
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
        if (__DEV__) console.log('[AuthService] Password reset email sent to:', email ? email.substring(0, 10) + '...' : 'NULL');
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] Password reset failed:', error?.message || 'Unknown error');
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
            if (__DEV__) console.log('[AuthService] Password updated');
        } else {
            throw new Error('No user currently signed in');
        }
    } catch (error: any) {
        if (__DEV__) console.error('[AuthService] Update password failed:', error?.message || 'Unknown error');
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
    if (__DEV__) console.log('[AuthService] ========== signOut START ==========');
    try {
        // Check if user is already signed out
        const currentUser = auth().currentUser;
        if (!currentUser) {
            if (__DEV__) console.log('[AuthService] ℹ️ No user currently signed in, sign out not needed');
            return;
        }

        await auth().signOut();
        if (__DEV__) console.log('[AuthService] ✅ User signed out successfully');
    } catch (error: any) {
        // Ignore "no-current-user" errors - user is already signed out
        if (error.code === 'auth/no-current-user' || error.message?.includes('No user currently signed in')) {
            if (__DEV__) console.log('[AuthService] ℹ️ User already signed out, ignoring error');
            return;
        }
        if (__DEV__) console.error('[AuthService] ❌ Sign out failed:', error?.message || 'Unknown error');
        throw error;
    }
    if (__DEV__) console.log('[AuthService] ========== signOut END ==========');
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
        if (__DEV__) console.error('[AuthService] Anonymous sign-in failed:', error?.message || 'Unknown error');
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
        if (__DEV__) console.error('[AuthService] Sign up failed:', error?.message || 'Unknown error');
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
        if (__DEV__) console.warn('[AuthService] Firebase wait failed, will retry on actual call:', error?.message || 'Unknown error');
    }

    // Retry subscribing to auth state with exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            // Try to subscribe to auth state changes
            const unsubscribe = auth().onAuthStateChanged(user => {
                callback(user ? user.uid : null);
            });

            if (__DEV__) console.log('[AuthService] Successfully subscribed to auth state changes');
            return unsubscribe;
        } catch (error: any) {
            lastError = error;
            if (__DEV__) console.error(`[AuthService] Failed to subscribe to auth state (attempt ${attempt + 1}/5):`, error?.message || 'Unknown error');

            // Check if it's a Firebase initialization error
            if (error.message?.includes('No Firebase App') || error.message?.includes('initializeApp')) {
                if (attempt < 4) {
                    // Retry after delay
                    const delay = 500 * (attempt + 1);
                    if (__DEV__) console.log(`[AuthService] Firebase not ready, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    // Last attempt failed - return a no-op function
                    if (__DEV__) console.error('[AuthService] Firebase still not ready after retries, returning no-op unsubscribe');
                    return () => { };
                }
            }

            // For other errors, throw immediately
            throw error;
        }
    }

    // If all retries failed, return a no-op function
    if (__DEV__) console.error('[AuthService] All retries failed, returning no-op unsubscribe');
    return () => { };
};

/**
 * Delete the current user's account.
 */
export const deleteAccount = async () => {
    const user = auth().currentUser;
    if (user) {
        await user.delete();
        if (__DEV__) console.log('[AuthService] User account deleted');
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
    if (__DEV__) console.log('[AuthService] User re-authenticated');
};

/**
 * Delete the current user account (for signup cleanup when username is taken)
 */
export const deleteCurrentUser = async (): Promise<void> => {
    const user = auth().currentUser;
    if (user) {
        await user.delete();
        if (__DEV__) console.log('[AuthService] Current user deleted (signup cleanup)');
    }
};
