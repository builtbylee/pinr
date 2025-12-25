import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In (call this once at app startup)
GoogleSignin.configure({
    webClientId: '760973100570-m7rblrrm2fkcjk61mjnu9bruvkrs03qp.apps.googleusercontent.com',
});

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<{ uid: string; email: string | null; displayName: string | null; isNewUser: boolean }> => {
    try {
        // Check if Play Services are available
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Get the user's ID token
        const signInResult = await GoogleSignin.signIn();
        const idToken = signInResult.data?.idToken;

        if (!idToken) {
            throw new Error('No ID token returned from Google Sign-In');
        }

        // Create a Google credential with the token
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);

        // Sign-in the user with the credential
        const userCredential = await auth().signInWithCredential(googleCredential);

        console.log('[AuthService] Signed in with Google:', userCredential.user.email);

        return {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            displayName: userCredential.user.displayName,
            isNewUser: userCredential.additionalUserInfo?.isNewUser ?? false,
        };
    } catch (error: any) {
        console.error('[AuthService] Google sign-in failed:', error);

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            throw new Error('Sign-in was cancelled');
        } else if (error.code === statusCodes.IN_PROGRESS) {
            throw new Error('Sign-in is already in progress');
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error('Google Play Services is not available');
        }

        throw error;
    }
};
/**
 * Link an implementation-email/password credential to the current anonymous user.
 * This effectively "upgrades" the anonymous account to a permanent one.
 */
export const linkEmailPassword = async (email: string, password: string): Promise<void> => {
    try {
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
 */
export const signInEmailPassword = async (email: string, password: string): Promise<void> => {
    try {
        await auth().signInWithEmailAndPassword(email, password);
        console.log('[AuthService] Signed in with email/password');
    } catch (error: any) {
        console.error('[AuthService] Sign in failed:', error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error('Invalid email or password.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address.');
        }
        throw error;
    }
};

/**
 * Send a password reset email.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
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
 */
export const onAuthStateChanged = (callback: (userId: string | null) => void) => {
    return auth().onAuthStateChanged(user => {
        callback(user ? user.uid : null);
    });
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
