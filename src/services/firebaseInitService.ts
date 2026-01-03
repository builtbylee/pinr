/**
 * Firebase Initialization Service
 * 
 * React Native Firebase auto-initializes from google-services.json/GoogleService-Info.plist.
 * This service provides a simple way to ensure Firebase is ready before use.
 * 
 * ROOT CAUSE: With Expo dev client, the native bridge may not be ready when we first
 * try to use Firebase. We need to wait for both:
 * 1. Native bridge to be ready
 * 2. Firebase native module to have read GoogleService-Info.plist and initialized
 */

import { NativeModules, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { getApp, initializeApp } from '@react-native-firebase/app';

let isFirebaseReady = false;
let initPromise: Promise<void> | null = null;
let explicitInitAttempted = false;

let isFirestoreReady = false;
let firestoreInitPromise: Promise<void> | null = null;

let hasAlertedInit = false;
let hasAlertedReady = false;

/**
 * Wait for Firebase to be initialized
 * Returns a promise that resolves when Firebase is ready
 * We test by actually trying to use auth() methods to verify it's ready
 */
export async function waitForFirebase(): Promise<void> {
    if (isFirebaseReady) {
        return Promise.resolve();
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 200; // 20 seconds max (200 * 100ms)
        const nativeBridgeCheckAttempts = 30; // First 3 seconds: check native bridge

        const checkFirebase = async () => {
            attempts++;

            // Phase 1: Wait for native bridge to be ready (first 30 attempts = 3 seconds)
            if (attempts <= nativeBridgeCheckAttempts) {
                try {
                    // Check if native modules are available
                    // RNFBApp should be available if the native module is loaded
                    const rnfbAppModule = NativeModules.RNFBApp;
                    if (!rnfbAppModule) {
                        // Native module not loaded yet, wait a bit more
                        if (attempts < nativeBridgeCheckAttempts) {
                            setTimeout(checkFirebase, 100);
                            return;
                        } else {
                            console.warn('[FirebaseInit] Native bridge check timeout, proceeding to Firebase check');
                        }
                    } else {
                        // Native module is loaded, give it a moment to initialize
                        if (attempts < nativeBridgeCheckAttempts) {
                            setTimeout(checkFirebase, 100);
                            return;
                        }
                    }
                } catch (error) {
                    // NativeModules might not be ready yet
                    if (attempts < nativeBridgeCheckAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    }
                }
            }

            // Phase 2: Check if Firebase is initialized (remaining attempts)
            try {
                // First, check if NATIVE_FIREBASE_APPS is populated
                const appModule = NativeModules.RNFBAppModule;
                if (appModule && appModule.NATIVE_FIREBASE_APPS) {
                    const nativeApps = appModule.NATIVE_FIREBASE_APPS;
                    console.log(`[FirebaseInit] Found ${nativeApps.length} native Firebase app(s)`);
                    if (nativeApps.length === 0 && attempts < 100) {
                        // Native module is ready but no apps yet - wait a bit more
                        setTimeout(checkFirebase, 100);
                        return;
                    }
                }

                // Try to get the app - this will throw if not initialized
                let app;
                try {
                    app = getApp();
                    // If we got here, the app exists - but it might not be fully initialized yet
                } catch (error: any) {
                    // App doesn't exist yet
                    if (error.message?.includes('No Firebase App')) {
                        // Try explicit initialization as fallback if native configure didn't work
                        if (!explicitInitAttempted && attempts > 50) {
                            explicitInitAttempted = true;
                            console.log('[FirebaseInit] Native configure may have failed, attempting explicit JS initialization...');
                            try {
                                // Try to initialize with explicit config from plist values
                                // This is a fallback if native configure didn't work
                                const firebaseConfig = {
                                    apiKey: "AIzaSyAUKW5TCvDSYK_G-T9CuxVGaCeYv57ikBE",
                                    projectId: "days-c4ad4",
                                    storageBucket: "days-c4ad4.firebasestorage.app",
                                    appId: "1:760973100570:ios:35508928194bfacfcef3a3",
                                    messagingSenderId: "760973100570"
                                };
                                initializeApp(firebaseConfig);
                                console.log('[FirebaseInit] Explicit JS initialization with config attempted, waiting...');
                                // Give it time to initialize
                                setTimeout(checkFirebase, 1000);
                                return;
                            } catch (initError: any) {
                                console.error('[FirebaseInit] Explicit JS initialization failed:', initError);
                                // If explicit init also fails, there's a deeper issue
                                if (initError.message?.includes('already been created') || initError.message?.includes('already exists')) {
                                    // App might already exist, try to get it
                                    console.log('[FirebaseInit] App may already exist, retrying getApp()...');
                                    setTimeout(checkFirebase, 500);
                                    return;
                                }
                                // Continue with retry logic
                            }
                        }

                        if (attempts < maxAttempts) {
                            setTimeout(checkFirebase, 100);
                            return;
                        } else {
                            // Timeout - this is a critical error
                            console.error('[FirebaseInit] CRITICAL: Firebase app not found after timeout');
                            console.error('[FirebaseInit] This indicates FirebaseApp.configure() in AppDelegate did not work');
                            console.error('[FirebaseInit] Verify: 1) plist is in app bundle, 2) FirebaseApp.configure() is called, 3) app was rebuilt');
                            isFirebaseReady = true; // Set to true to prevent infinite loops, but log the error
                            resolve();
                            return;
                        }
                    }
                    // Other error, retry
                    if (attempts < maxAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        console.error('[FirebaseInit] Error getting app:', error);
                        isFirebaseReady = true;
                        resolve();
                        return;
                    }
                }

                // If we got the app, verify auth() works - this confirms Firebase is fully ready
                try {
                    const authInstance = auth();
                    // Try to access currentUser - this will work if Firebase is initialized
                    const _ = authInstance.currentUser;

                    isFirebaseReady = true;
                    console.log(`[FirebaseInit] ✅ Firebase Auth is ready (after ${attempts} attempts, ${(attempts * 100) / 1000}s)`);
                    resolve();
                    return;
                } catch (authError: any) {
                    // If auth() throws, Firebase isn't ready yet
                    const errorMessage = authError?.message || '';
                    if (errorMessage.includes('No Firebase App') ||
                        errorMessage.includes('has been created') ||
                        errorMessage.includes('initializeApp')) {

                        if (attempts < maxAttempts) {
                            setTimeout(checkFirebase, 100);
                            return;
                        } else {
                            // Timeout - critical error
                            console.error('[FirebaseInit] CRITICAL: Firebase auth not ready after timeout');
                            console.error('[FirebaseInit] Error:', authError);
                            isFirebaseReady = true;
                            resolve();
                            return;
                        }
                    }
                    // For other errors, retry
                    if (attempts < maxAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        console.error('[FirebaseInit] Auth check failed after timeout:', authError);
                        isFirebaseReady = true;
                        resolve();
                        return;
                    }
                }
            } catch (error: any) {
                const errorMessage = error?.message || '';
                if (errorMessage.includes('No Firebase App') ||
                    errorMessage.includes('has been created') ||
                    errorMessage.includes('initializeApp')) {

                    if (attempts < maxAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        console.error('[FirebaseInit] Firebase initialization timeout:', error);
                        isFirebaseReady = true;
                        resolve();
                        return;
                    }
                } else {
                    // Unexpected error - retry
                    if (attempts < maxAttempts) {
                        setTimeout(checkFirebase, 100);
                        return;
                    } else {
                        console.error('[FirebaseInit] Unexpected error after timeout:', error);
                        isFirebaseReady = true;
                        resolve();
                        return;
                    }
                }
            }
        };

        // Start checking immediately - we'll check native bridge first, then Firebase
        console.log('[FirebaseInit] Starting Firebase initialization check...');
        setTimeout(checkFirebase, 500); // Small initial delay to let React Native start
    });

    return initPromise;
}

/**
 * Wait for Firestore to be initialized and ready
 * Firestore may initialize after Firebase Auth, so we need a separate check
 * We verify readiness by checking if the native module is available
 */
export async function waitForFirestore(): Promise<void> {
    if (!hasAlertedInit) {
        // Alert.alert('Debug: Init', 'Waiting for Firestore...');
        hasAlertedInit = true;
    }

    // First ensure Firebase is ready
    await waitForFirebase();

    if (isFirestoreReady) {
        return Promise.resolve();
    }

    if (firestoreInitPromise) {
        return firestoreInitPromise;
    }

    firestoreInitPromise = new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max (50 * 100ms) - Firestore should be ready quickly after Firebase

        const checkFirestore = async () => {
            attempts++;

            try {
                // Try to access Firestore instance directly
                // Note: We skip checking NativeModules.RNFBFirestore because it may not be visible
                // when using use_frameworks! (Static Linking), yet the SDK is functional.
                const firestoreInstance = firestore();

                // If we got an instance, we assume it's usable or will queue requests
                if (firestoreInstance) {
                    try {
                        // Critical: Enable Long Polling to avoid gRPC connection hangs
                        // We enable this on Physical Devices too because standard gRPC seems to be failing
                        // (likely network/firewall issues causing timeouts)
                        console.log('[FirebaseInit] Enabling experimentalForceLongPolling for ALL devices...');

                        // API Check: .settings might be a function (Standard) or property (New/Legacy)
                        console.log('[FirebaseInit] DEBUG: Instance:', firestoreInstance);

                        const settingsProp = (firestoreInstance as any).settings;

                        if (typeof settingsProp === 'function') {
                            await firestoreInstance.settings({ experimentalForceLongPolling: true });
                            console.log('[FirebaseInit] ✅ experimentalForceLongPolling enabled (via Method)');
                        } else {
                            (firestoreInstance as any).settings = { experimentalForceLongPolling: true };
                            console.log('[FirebaseInit] ✅ experimentalForceLongPolling enabled (via Assignment)');
                        }
                    } catch (e: any) {
                        console.warn('[FirebaseInit] ⚠️ Failed to configure Firestore settings:', e.message);
                    }

                    isFirestoreReady = true;
                    console.log(`[FirebaseInit] ✅ Firestore is ready (after ${attempts} attempts)`);

                    if (!hasAlertedReady) {
                        // Alert.alert('Debug: Init', 'Firestore Ready!');
                        hasAlertedReady = true;
                    }
                    resolve();
                    return;
                }

                // Retry if no instance returned (unlikely for RNFB, but safe)
                if (attempts < maxAttempts) {
                    setTimeout(checkFirestore, 100);
                    return;
                } else {
                    console.warn('[FirebaseInit] Firestore check timed out, proceeding anyway');
                    isFirestoreReady = true;
                    if (!hasAlertedReady) {
                        Alert.alert('Debug: Init', 'Firestore Timed Out (Max Attempts)');
                        hasAlertedReady = true;
                    }
                    resolve();
                    return;
                }
            } catch (error: any) {
                console.warn('[FirebaseInit] Firestore check error:', error);

                // For critical errors, retry a few times then give up
                if (attempts < maxAttempts) {
                    setTimeout(checkFirestore, 100);
                    return;
                } else {
                    isFirestoreReady = true;
                    if (!hasAlertedReady) {
                        Alert.alert('Debug: Init', `Init Error: ${error.message}`);
                        hasAlertedReady = true;
                    }
                    resolve();
                    return;
                }
            }
        };

        console.log('[FirebaseInit] Starting Firestore initialization check...');
        setTimeout(checkFirestore, 200); // Small delay to let Firestore initialize after Firebase
    });

    return firestoreInitPromise;
}

/**
 * Check if Firebase is ready (synchronous check)
 */
export function isFirebaseInitialized(): boolean {
    try {
        const authInstance = auth();
        return authInstance !== null && authInstance !== undefined;
    } catch {
        return false;
    }
}

/**
 * Check if Firestore is ready (synchronous check)
 */
export function isFirestoreInitialized(): boolean {
    try {
        const firestoreInstance = firestore();
        return firestoreInstance !== null && firestoreInstance !== undefined;
    } catch {
        return false;
    }
}
