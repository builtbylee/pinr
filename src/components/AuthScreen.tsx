import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import React, { useState, useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { signInEmailPassword, signUpWithEmail, signInWithGoogle, deleteCurrentUser } from '../services/authService';
import Svg, { Path } from 'react-native-svg';
import { saveUserProfile, isUsernameTaken, getEmailByUsername } from '../services/userService';
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
                    await signInEmailPassword(creds.email, creds.pass);
                    // Fetch username to pass back
                    const { getUserProfile } = require('../services/userService');
                    const user = require('../services/authService').getCurrentUser();
                    if (user) {
                        const profile = await getUserProfile(user.uid);
                        onAuthenticated(profile?.username);
                    } else {
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
        if (!emailOrUsername || !password) {
            setError('Please enter email and password');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const loginEmail = emailOrUsername.trim();

            // Require valid email format
            if (!loginEmail.includes('@')) {
                throw new Error('Please enter a valid email address.');
            }

            await signInEmailPassword(loginEmail, password);

            // Fetch username to pass back
            const { getUserProfile } = require('../services/userService');
            const user = require('../services/authService').getCurrentUser();
            let loggedInUsername = '';
            if (user) {
                const profile = await getUserProfile(user.uid);
                loggedInUsername = profile?.username;
            }

            // Offer to save credentials for biometric login
            if (biometricAvailable && !hasSavedCredentials) {
                Alert.alert(
                    `Enable ${biometricType}?`,
                    `Would you like to use ${biometricType} for faster sign-in next time?`,
                    [
                        { text: 'Not Now', style: 'cancel', onPress: () => onAuthenticated(loggedInUsername) },
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

            onAuthenticated(loggedInUsername);

        } catch (e: any) {
            setError(e.message);
        } finally {
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
        setIsLoading(true);
        setError(null);
        try {
            const result = await signInWithGoogle();

            // If new user, save profile with display name as username
            if (result.isNewUser && result.displayName) {
                const { saveUserProfile, isUsernameTaken } = require('../services/userService');
                // Use display name as initial username, user can change it later
                let suggestedUsername = result.displayName.replace(/\s+/g, '').toLowerCase().substring(0, 15);

                // Check if username is taken and generate unique variant if needed
                let isTaken = await isUsernameTaken(suggestedUsername, result.uid);
                let attempts = 0;
                while (isTaken && attempts < 5) {
                    // Append random digits to make unique
                    suggestedUsername = suggestedUsername.substring(0, 12) + Math.floor(Math.random() * 1000);
                    isTaken = await isUsernameTaken(suggestedUsername, result.uid);
                    attempts++;
                }

                await saveUserProfile(result.uid, suggestedUsername, result.email || undefined);
                onAuthenticated(suggestedUsername);
            } else {
                // Existing user - fetch their username
                const { getUserProfile } = require('../services/userService');
                const profile = await getUserProfile(result.uid);
                onAuthenticated(profile?.username);
            }
        } catch (e: any) {
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

});
