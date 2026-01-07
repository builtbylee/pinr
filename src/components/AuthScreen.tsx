import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import React, { useState, useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { signInEmailPassword, signUpWithEmail, signInWithGoogle, signInWithApple, deleteCurrentUser } from '../services/authService';
import Svg, { Path } from 'react-native-svg';
import { saveUserProfile, isUsernameTaken, getEmailByUsername } from '../services/userService';
import { sendPasswordReset } from '../services/authService';
import { biometricService } from '../services/biometricService';


const { width, height } = Dimensions.get('window');

interface AuthScreenProps {
    onAuthenticated: (username?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
    // Mode defaults to 'login' now. 'welcome' is removed.
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    // Form State
    const [emailOrUsername, setEmailOrUsername] = useState(''); // Unified field for login
    const [email, setEmail] = useState(''); // Separate for signup
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // Only for signup
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showPassword, setShowPassword] = useState(false);

    // Biometric State
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState<string>('Biometrics');
    const [hasSavedCredentials, setHasSavedCredentials] = useState(false);

    // Forgot Password State
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState<string | null>(null);
    const [forgotError, setForgotError] = useState<string | null>(null);

    // Check biometrics and hide splash on mount
    useEffect(() => {
        // Hide splash screen when AuthScreen is mounted and visible
        SplashScreen.hideAsync();

        const checkBiometrics = async () => {
            const { available, type } = await biometricService.checkAvailability();
            setBiometricAvailable(available);
            if (type) setBiometricType(type);

            if (available) {
                const creds = await biometricService.getCredentials();
                if (creds) {
                    setHasSavedCredentials(true);
                    // Optional: Auto-prompt on launch if you prefer
                    handleBiometricLogin();
                }
            }
        };
        checkBiometrics();
    }, []);

    const handleBiometricLogin = async () => {
        try {
            const success = await biometricService.authenticate(`Login with ${biometricType}`);
            if (success) {
                const creds = await biometricService.getCredentials();
                if (creds) {
                    setIsLoading(true);
                    // Auto-fill and login
                    const userId = await signInEmailPassword(creds.email, creds.pass);
                    console.log('[AuthScreen] ✅ Biometric login succeeded, user ID:', userId);

                    // Fetch username to pass back (with timeout to prevent hang)
                    const { getUserProfile } = require('../services/userService');
                    const user = require('../services/authService').getCurrentUser();
                    if (user && user.uid === userId) {
                        try {
                            // Add timeout to prevent hang if Firestore is not responding
                            const profilePromise = getUserProfile(user.uid);
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
                            );
                            const profile = await Promise.race([profilePromise, timeoutPromise]) as any;
                            onAuthenticated(profile?.username);
                        } catch (profileError: any) {
                            console.warn('[AuthScreen] Failed to fetch profile (non-blocking):', profileError.message);
                            // Continue without username - it's not critical for login
                            onAuthenticated();
                        }
                    } else {
                        console.warn('[AuthScreen] User not available after biometric login');
                        onAuthenticated();
                    }
                }
            }
        } catch (e: any) {
            console.log('Biometric login failed:', e);
            // Don't alert detailed error, just let user try manual
        } finally {
            setIsLoading(false);
        }
    };



    const handleLogin = async () => {
        console.log('[AuthScreen] ========== LOGIN ATTEMPT START ==========');
        console.log('[AuthScreen] Email/Username:', emailOrUsername ? emailOrUsername.trim() : 'EMPTY');
        console.log('[AuthScreen] Password length:', password ? password.length : 0);

        if (!emailOrUsername || !password) {
            console.error('[AuthScreen] ❌ Missing email or password');
            setError('Please enter email and password');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const loginEmail = emailOrUsername.trim();
            console.log('[AuthScreen] Trimmed email:', loginEmail);

            // Require valid email format
            if (!loginEmail.includes('@')) {
                console.error('[AuthScreen] ❌ Invalid email format (no @)');
                throw new Error('Please enter a valid email address.');
            }

            console.log('[AuthScreen] 📧 Calling signInEmailPassword...');
            const startTime = Date.now();
            const userId = await signInEmailPassword(loginEmail, password);
            const duration = Date.now() - startTime;
            console.log('[AuthScreen] ✅ Email/password sign-in succeeded');
            console.log('[AuthScreen] User ID:', userId);
            console.log('[AuthScreen] Sign-in duration:', duration + 'ms');

            // Verify user is actually signed in
            console.log('[AuthScreen] 🔍 Verifying user is signed in...');
            const { getCurrentUser } = require('../services/authService');
            let user = getCurrentUser();
            console.log('[AuthScreen] Initial user check:', user ? `Found user ${user.uid}` : 'NO USER');

            // If user is not immediately available, wait a bit for auth state to propagate
            if (!user) {
                console.log('[AuthScreen] ⏳ User not immediately available, waiting 300ms for auth state...');
                await new Promise(resolve => setTimeout(resolve, 300));
                user = getCurrentUser();
                console.log('[AuthScreen] After wait, user:', user ? `Found user ${user.uid}` : 'STILL NO USER');
            }

            if (!user || user.uid !== userId) {
                console.error('[AuthScreen] ❌ Sign-in succeeded but user verification failed');
                console.error('[AuthScreen] Expected user ID:', userId);
                console.error('[AuthScreen] Got user:', user ? user.uid : 'null');
                console.error('[AuthScreen] User match:', user?.uid === userId ? 'YES' : 'NO');
                throw new Error('Sign-in failed. Please try again.');
            }
            console.log('[AuthScreen] ✅ User verified after sign-in:', user.uid);

            // Fetch username to pass back (with timeout to prevent hang)
            console.log('[AuthScreen] 📋 Fetching user profile...');
            const { getUserProfile } = require('../services/userService');
            let loggedInUsername = '';
            try {
                const profileStartTime = Date.now();
                // Add timeout to prevent hang if Firestore is not responding
                const profilePromise = getUserProfile(user.uid);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
                );
                const profile = await Promise.race([profilePromise, timeoutPromise]) as any;
                const profileDuration = Date.now() - profileStartTime;
                loggedInUsername = profile?.username || '';
                console.log('[AuthScreen] ✅ Profile fetched successfully');
                console.log('[AuthScreen] Profile duration:', profileDuration + 'ms');
                console.log('[AuthScreen] Username:', loggedInUsername || 'NONE');
                console.log('[AuthScreen] Profile exists:', profile ? 'YES' : 'NO');
            } catch (profileError: any) {
                console.warn('[AuthScreen] ⚠️ Failed to fetch profile (non-blocking)');
                console.warn('[AuthScreen] Profile error:', profileError.message);
                console.warn('[AuthScreen] Profile error code:', profileError.code);
                // Continue without username - it's not critical for login
                loggedInUsername = '';
            }

            console.log('[AuthScreen] ✅ Login flow complete');
            console.log('[AuthScreen] Username to pass:', loggedInUsername || 'NONE');
            console.log('[AuthScreen] Biometric available:', biometricAvailable);
            console.log('[AuthScreen] Has saved credentials:', hasSavedCredentials);
            console.log('[AuthScreen] 📞 Calling onAuthenticated...');

            // Offer to save credentials for biometric login
            if (biometricAvailable && !hasSavedCredentials) {
                console.log('[AuthScreen] Showing biometric prompt...');
                Alert.alert(
                    `Enable ${biometricType}?`,
                    `Would you like to use ${biometricType} for faster sign-in next time?`,
                    [
                        {
                            text: 'Not Now', style: 'cancel', onPress: () => {
                                console.log('[AuthScreen] User declined biometric, calling onAuthenticated');
                                onAuthenticated(loggedInUsername);
                            }
                        },
                        {
                            text: 'Enable',
                            onPress: async () => {
                                try {
                                    await biometricService.saveCredentials(loginEmail, password);
                                    setHasSavedCredentials(true);
                                    Alert.alert('Success', `${biometricType} enabled!`);
                                } catch (e) {
                                    console.error('Failed to save biometric credentials:', e);
                                }
                                onAuthenticated(loggedInUsername);
                            },
                        },
                    ]
                );
                return; // Wait for alert choice
            } else if (biometricAvailable && hasSavedCredentials) {
                // Update credentials if they changed
                await biometricService.saveCredentials(loginEmail, password);
            }

            // No biometric prompt - proceed directly
            console.log('[AuthScreen] No biometric prompt, calling onAuthenticated directly');
            onAuthenticated(loggedInUsername);
            console.log('[AuthScreen] ✅ onAuthenticated called, waiting for navigation...');
            console.log('[AuthScreen] ========== LOGIN ATTEMPT END ==========');

        } catch (e: any) {
            console.error('[AuthScreen] ❌ LOGIN ERROR');
            console.error('[AuthScreen] Error message:', e.message);
            console.error('[AuthScreen] Error code:', e.code);
            console.error('[AuthScreen] Error stack:', e.stack);
            console.error('[AuthScreen] ========== LOGIN ATTEMPT FAILED ==========');
            setError(e.message);
        } finally {
            console.log('[AuthScreen] Setting isLoading to false');
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!email || !password || !username) {
            setError('Please fill in all fields');
            return;
        }
        const cleanUsername = username.trim();
        if (cleanUsername.length < 2) {
            setError('Username must be at least 2 characters');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            // 1. Create Auth User FIRST (this authenticates us for Firestore queries)
            const uid = await signUpWithEmail(email, password);

            // 2. Now check if username is taken (we're authenticated now)
            const isTaken = await isUsernameTaken(cleanUsername, uid);

            if (isTaken) {
                // Username taken - delete the auth account we just created
                // Username taken - delete the auth account we just created
                await deleteCurrentUser();
                setError(`The username "${cleanUsername}" is already taken.`);
                setIsLoading(false);
                return;
            }

            // 3. Create Firestore Profile
            await saveUserProfile(uid, cleanUsername, email);

            // Pass username back to App to prevent "Enter Username" modal from appearing
            onAuthenticated(cleanUsername);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };



    const handleGoogleSignIn = async () => {
        console.log('[AuthScreen] ========== GOOGLE SIGN-IN ATTEMPT START ==========');
        setIsLoading(true);
        setError(null);
        try {
            console.log('[AuthScreen] 📱 Calling signInWithGoogle...');
            const startTime = Date.now();
            const result = await signInWithGoogle();
            const duration = Date.now() - startTime;
            console.log('[AuthScreen] ✅ Google sign-in succeeded');
            console.log('[AuthScreen] Sign-in duration:', duration + 'ms');
            console.log('[AuthScreen] User ID:', result.uid);
            console.log('[AuthScreen] Email:', result.email);
            console.log('[AuthScreen] Display name:', result.displayName);
            console.log('[AuthScreen] Is new user:', result.isNewUser);
            const { saveUserProfile, isUsernameTaken, getUserProfile } = require('../services/userService');

            console.log('[AuthScreen] Processing Google sign-in result...');
            console.log('[AuthScreen] Is new user:', result.isNewUser);

            if (result.isNewUser) {
                console.log('[AuthScreen] 🆕 New user - creating profile...');
                // New user - ALWAYS create a profile with a username
                let baseUsername: string;

                if (result.displayName) {
                    // Use display name as base, sanitized
                    baseUsername = result.displayName.replace(/\s+/g, '').toLowerCase().substring(0, 12);
                } else {
                    // No display name - generate random username
                    baseUsername = 'user';
                }

                // Ensure username is unique by appending random digits
                let finalUsername = baseUsername + Math.floor(Math.random() * 10000);
                let isTaken = await isUsernameTaken(finalUsername, result.uid);
                let attempts = 0;
                while (isTaken && attempts < 5) {
                    finalUsername = baseUsername + Math.floor(Math.random() * 100000);
                    isTaken = await isUsernameTaken(finalUsername, result.uid);
                    attempts++;
                }

                console.log('[AuthScreen] Saving profile for new user...');
                await saveUserProfile(result.uid, finalUsername, result.email || undefined);
                console.log('[AuthScreen] ✅ Profile saved, username:', finalUsername);
                console.log('[AuthScreen] 📞 Calling onAuthenticated for new user...');
                onAuthenticated(finalUsername);
                console.log('[AuthScreen] ✅ onAuthenticated called for new user');
            } else {
                console.log('[AuthScreen] 👤 Existing user - fetching profile...');
                // Existing user - fetch their profile (with timeout to prevent hang)
                try {
                    const profileStartTime = Date.now();
                    const profilePromise = getUserProfile(result.uid);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
                    );
                    const profile = await Promise.race([profilePromise, timeoutPromise]) as any;
                    const profileDuration = Date.now() - profileStartTime;
                    console.log('[AuthScreen] ✅ Profile fetched for existing user');
                    console.log('[AuthScreen] Profile duration:', profileDuration + 'ms');
                    console.log('[AuthScreen] Profile exists:', profile ? 'YES' : 'NO');
                    console.log('[AuthScreen] Username:', profile?.username || 'NONE');

                    if (profile?.username) {
                        console.log('[AuthScreen] 📞 Calling onAuthenticated for existing user...');
                        onAuthenticated(profile.username);
                        console.log('[AuthScreen] ✅ onAuthenticated called for existing user');
                    } else {
                        console.warn('[AuthScreen] ⚠️ Existing user has no username - creating fallback...');
                        // Edge case: existing user but no profile/username - create one now
                        const fallbackUsername = 'user' + Math.floor(Math.random() * 100000);
                        try {
                            await saveUserProfile(result.uid, fallbackUsername, result.email || undefined);
                        } catch (saveError) {
                            console.warn('[AuthScreen] Failed to save profile (non-blocking):', saveError);
                        }
                        console.log('[AuthScreen] 📞 Calling onAuthenticated with fallback username...');
                        onAuthenticated(fallbackUsername);
                        console.log('[AuthScreen] ✅ onAuthenticated called with fallback');
                    }
                } catch (profileError: any) {
                    console.warn('[AuthScreen] ⚠️ Failed to fetch profile (non-blocking)');
                    console.warn('[AuthScreen] Profile error:', profileError.message);
                    console.warn('[AuthScreen] Profile error code:', profileError.code);
                    // Continue without username - profile will load via subscription once in app
                    // Don't show alert as it's blocking - just log and proceed
                    console.log('[AuthScreen] 📞 Calling onAuthenticated without username (profile will load via subscription)...');
                    onAuthenticated();
                    console.log('[AuthScreen] ✅ onAuthenticated called without username');
                }
            }
            console.log('[AuthScreen] ========== GOOGLE SIGN-IN ATTEMPT END ==========');
        } catch (e: any) {
            console.error('[AuthScreen] ❌ GOOGLE SIGN-IN ERROR');
            console.error('[AuthScreen] Error message:', e.message);
            console.error('[AuthScreen] Error code:', e.code);
            console.error('[AuthScreen] Error stack:', e.stack);
            console.error('[AuthScreen] ========== GOOGLE SIGN-IN ATTEMPT FAILED ==========');
            if (e.message !== 'Sign-in was cancelled') {
                setError(e.message);
            }
        } finally {
            console.log('[AuthScreen] Setting isLoading to false (Google Sign-In)');
            setIsLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        console.log('[AuthScreen] ========== APPLE SIGN-IN ATTEMPT START ==========');
        setIsLoading(true);
        setError(null);
        try {
            const result = await signInWithApple();
            console.log('[AuthScreen] Apple Sign-In result:', result.uid);
            console.log('[AuthScreen] Is new user:', result.isNewUser);

            if (result.isNewUser) {
                console.log('[AuthScreen] 🆕 NEW USER - Creating profile...');
                // Generate a unique username for new Apple Sign-In users
                const generatedUsername = 'traveler' + Math.floor(Math.random() * 100000);
                await saveUserProfile(result.uid, generatedUsername, result.email || undefined);
                console.log('[AuthScreen] 📞 Calling onAuthenticated for new user...');
                onAuthenticated(generatedUsername);
            } else {
                console.log('[AuthScreen] 👤 EXISTING USER - Fetching profile...');
                const { getUserProfile } = require('../services/userService');
                try {
                    const profile = await getUserProfile(result.uid);
                    if (profile?.username) {
                        onAuthenticated(profile.username);
                    } else {
                        const fallbackUsername = 'traveler' + Math.floor(Math.random() * 100000);
                        await saveUserProfile(result.uid, fallbackUsername, result.email || undefined);
                        onAuthenticated(fallbackUsername);
                    }
                } catch (profileError: any) {
                    console.warn('[AuthScreen] Failed to fetch profile:', profileError.message);
                    onAuthenticated();
                }
            }
        } catch (e: any) {
            console.error('[AuthScreen] Apple Sign-In error:', e.message);
            if (e.message !== 'Sign-in was cancelled') {
                setError(e.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setError(null);
        setEmailOrUsername('');
        setEmail('');
        setPassword('');
        setUsername('');
    };

    const toggleMode = () => {
        resetForm();
        setMode(mode === 'login' ? 'signup' : 'login');
    };

    const handleForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            setForgotError('Please enter your email address');
            return;
        }
        if (!forgotEmail.includes('@')) {
            setForgotError('Please enter a valid email address');
            return;
        }

        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);

        try {
            await sendPasswordReset(forgotEmail.trim());
            setForgotMessage('If an account exists with this email, a password reset link has been sent.');
            setForgotEmail('');
        } catch (e: any) {
            setForgotError(e.message || 'Failed to send reset email');
        } finally {
            setForgotLoading(false);
        }
    };

    const renderForm = (isLogin: boolean) => (
        <View style={styles.contentContainer}>
            {/* Share your Journey text removed */}

            {/* Form Fields */}
            <View style={styles.formFields}>
                {!isLogin ? (
                    // SIGN UP FIELDS
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="rgba(0,0,0,0.4)"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="rgba(0,0,0,0.4)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </>
                ) : (
                    // LOGIN FIELDS
                    <TextInput
                        testID="auth-email-input"
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(0,0,0,0.4)"
                        value={emailOrUsername}
                        onChangeText={setEmailOrUsername}
                        autoCapitalize="none"
                    />
                )}

                <View style={styles.passwordContainer}>
                    <TextInput
                        testID="auth-password-input"
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor="rgba(0,0,0,0.4)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        <Feather
                            name={showPassword ? "eye-off" : "eye"}
                            size={24}
                            color="rgba(0,0,0,0.4)"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Forgot Password Link - Login only */}
            {isLogin && (
                <TouchableOpacity
                    style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 8 }}
                    onPress={() => {
                        setShowForgotPassword(true);
                        setForgotEmail(emailOrUsername.includes('@') ? emailOrUsername : '');
                        setForgotError(null);
                        setForgotMessage(null);
                    }}
                >
                    <Text style={{ color: 'rgba(0, 0, 0, 0.5)', fontSize: 14, fontWeight: '500' }}>
                        Forgot Password?
                    </Text>
                </TouchableOpacity>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}



            {/* Login Button Row with optional Biometric */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    testID="auth-submit-button"
                    style={[
                        styles.primaryButton,
                        isLogin && hasSavedCredentials && styles.primaryButtonWithBiometric
                    ]}
                    onPress={isLogin ? handleLogin : handleSignup}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.primaryButtonText}>
                            {isLogin ? 'Log In' : 'Sign Up'}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Biometric Icon Button */}
                {isLogin && hasSavedCredentials && !isLoading && (
                    <TouchableOpacity
                        testID="auth-biometric-button"
                        style={styles.biometricIconButton}
                        onPress={handleBiometricLogin}
                    >
                        <MaterialCommunityIcons name="fingerprint" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            </View>


            <TouchableOpacity
                style={styles.textLink}
                onPress={toggleMode}
            >
                <Text style={styles.textLinkText}>
                    {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
            >
                <Svg width={20} height={20} viewBox="0 0 48 48">
                    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </Svg>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Apple Sign-In Button (iOS only) */}
            {Platform.OS === 'ios' && (
                <TouchableOpacity
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                >
                    <Feather name="apple" size={20} color="white" />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
            )}

        </View>
    );

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior="padding"
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.globeContainer}>
                        <View style={styles.staticGlobe}>
                            <Image
                                source={require('../../assets/images/pinr-logo.png')}
                                style={styles.globeImage}
                                contentFit="contain"
                            />
                        </View>
                    </View>




                    <View style={styles.signatureContainer} pointerEvents="none">
                        <Image
                            source={require('../../assets/images/builtbylee-signature.png')}
                            style={styles.signatureImage}
                            contentFit="contain"
                        />
                    </View>

                    {renderForm(mode === 'login')}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Forgot Password Modal */}
            <Modal
                visible={showForgotPassword}
                transparent
                animationType="fade"
                onRequestClose={() => setShowForgotPassword(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 24,
                }}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        maxWidth: 340,
                    }}>
                        <Text style={{
                            fontSize: 20,
                            fontWeight: '700',
                            color: '#1F2937',
                            marginBottom: 8,
                            textAlign: 'center',
                        }}>Reset Password</Text>
                        <Text style={{
                            fontSize: 14,
                            color: '#6B7280',
                            marginBottom: 20,
                            textAlign: 'center',
                        }}>Enter your email address and we'll send you a link to reset your password.</Text>

                        <TextInput
                            style={{
                                backgroundColor: '#F9FAFB',
                                borderRadius: 12,
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                                fontSize: 16,
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                marginBottom: 16,
                            }}
                            placeholder="Email"
                            placeholderTextColor="rgba(0,0,0,0.4)"
                            value={forgotEmail}
                            onChangeText={setForgotEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoFocus
                        />

                        {forgotError && (
                            <Text style={{ color: '#EF4444', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
                                {forgotError}
                            </Text>
                        )}

                        {forgotMessage && (
                            <Text style={{ color: '#10B981', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
                                {forgotMessage}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={{
                                backgroundColor: '#4F46E5',
                                paddingVertical: 14,
                                borderRadius: 12,
                                marginBottom: 12,
                            }}
                            onPress={handleForgotPassword}
                            disabled={forgotLoading}
                        >
                            {forgotLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                                    Send Reset Link
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ paddingVertical: 10 }}
                            onPress={() => {
                                setShowForgotPassword(false);
                                setForgotEmail('');
                                setForgotError(null);
                                setForgotMessage(null);
                            }}
                        >
                            <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF', // White background
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyboardView: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },

    globeContainer: {
        marginBottom: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ... rest of existing styles ...
    googleButtonText: {
        color: '#1a1a1a',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    signatureContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 20, // Add space between signature and form
    },
    signatureImage: {
        width: 120,
        height: 60,
        opacity: 0.8,
    },
    staticGlobe: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
    },
    globeImage: {
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        width: '80%',
        alignItems: 'center',
    },
    appTitle: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#1a1a1a', // Dark text
        marginBottom: 8,
        letterSpacing: 2,
    },
    tagline: {
        fontSize: 18,
        color: 'rgba(0, 0, 0, 0.6)',
        marginBottom: 24,
        fontStyle: 'italic',
    },
    formTitle: {
        fontSize: 32,
        fontFamily: 'BebasNeue_400Regular',
        color: '#1a1a1a',
        marginBottom: 24,
        letterSpacing: 1,
    },
    formFields: {
        width: '100%',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 56,
        backgroundColor: 'rgba(0, 0, 0, 0.05)', // Light gray
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 16,
        color: '#1a1a1a',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    primaryButton: {
        flex: 1,
        height: 56,
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonWithBiometric: {
        marginRight: 12,
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    biometricIconButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    secondaryButton: {
        width: '100%',
        height: 56,
        backgroundColor: 'transparent',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    secondaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    createAccountButton: {
        backgroundColor: '#FF00FF',
        borderColor: '#FF00FF',
        shadowColor: '#FF00FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    createAccountButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    textLink: {
        marginTop: 4,
    },
    textLinkText: {
        color: 'rgba(0, 0, 0, 0.5)',
        fontSize: 14,
    },
    errorText: {
        color: '#FF3B30',
        marginBottom: 12,
        textAlign: 'center',
    },
    recoveryContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
        padding: 16,
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 0, 0.3)',
    },
    recoveryText: {
        color: '#FF9500',
        fontSize: 16,
        marginBottom: 12,
        fontWeight: '500',
    },
    recoveryButton: {
        backgroundColor: '#FF9500',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    recoveryButtonText: {
        color: '#000',
        fontWeight: 'bold',
    },
    passwordContainer: {
        width: '100%',
        height: 56,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        paddingHorizontal: 20,
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#1a1a1a',
    },
    eyeIcon: {
        padding: 4,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
        width: '100%',
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    dividerText: {
        color: 'rgba(0, 0, 0, 0.4)',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    googleButton: {
        width: '100%',
        height: 56,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    appleButton: {
        width: '100%',
        height: 56,
        backgroundColor: '#000000',
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    appleButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },

});
