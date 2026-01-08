import '@/src/config/firestore'; // CRITICAL: Must be first import to configure Long Polling
import Mapbox from '@rnmapbox/maps';
// OneSignal imported conditionally to prevent crash if module not linked
let OneSignal: any;
let LogLevel: any;
try {
  const oneSignalModule = require('react-native-onesignal');
  OneSignal = oneSignalModule.OneSignal;
  LogLevel = oneSignalModule.LogLevel;
} catch (e: any) {
  if (__DEV__) console.warn('[Layout] OneSignal module not available:', e?.message || 'Unknown error');
  OneSignal = null;
  LogLevel = null;
}
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, LogBox, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

// Instrumentation: Global cold start timestamp
const COLD_START_TIME = Date.now();
const log = (tag: string, msg: string) => {
  if (__DEV__) {
    const elapsed = Date.now() - COLD_START_TIME;
    if (__DEV__) console.log(`[Perf +${elapsed}ms] [Layout:${tag}] ${msg}`);
  }
};
log('Init', 'Layout module loaded');

import { MAPBOX_TOKEN } from '@/src/constants/Config';
import { onAuthStateChanged, getCurrentUser, signOut, isAnonymous } from '@/src/services/authService';
import { useMemoryStore } from '@/src/store/useMemoryStore';
import { AuthScreen } from '@/src/components/AuthScreen';
import { initializeAppCheck } from '@/src/services/appCheckService';
import { useBanCheck } from '@/src/hooks/useBanCheck';
import { waitForFirebase } from '@/src/services/firebaseInitService';
import { getUserProfile } from '@/src/services/userService';
import auth from '@react-native-firebase/auth';

// Initialize App Check early (Firebase auto-initializes from config files)
// TEMPORARILY DISABLED FOR TESTING - App Check may be blocking Firestore requests
// TODO: Re-enable after verifying App Check debug token is registered in Firebase Console
// initializeAppCheck().catch((error) => {
//     console.warn('[Layout] AppCheck initialization failed (non-critical):', error);
//     // App Check is optional - app will work without it, just without verification
// });
if (__DEV__) console.log('[Layout] ⚠️ App Check is TEMPORARILY DISABLED for testing Firestore subscriptions');

// Safe font loading import with fallback
let useFonts: any;
let BebasNeue_400Regular: any;
try {
  const fontModule = require('@expo-google-fonts/bebas-neue');
  useFonts = fontModule.useFonts;
  BebasNeue_400Regular = fontModule.BebasNeue_400Regular;
} catch (e: any) {
  if (__DEV__) console.warn('[Layout] Font module failed to load:', e?.message || 'Unknown error');
}

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'RNMapbox DEPRECATION WARNING',
  'RNMapbox: Please upgrade to New Architecture',
  'RNMapbox: For sponsor-only support'
]);

// DIAGNOSTIC: Completely disabling OneSignal to isolate crash source
// If app works after this, OneSignal native module is the problem
const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONESIGNAL_DISABLED = true; // Set to false to re-enable

// CRITICAL: Initialize OneSignal at module scope to ensure it runs before any child useEffects
// This prevents race conditions where index.tsx calls notificationService.login() before init
if (!ONESIGNAL_DISABLED && OneSignal && LogLevel) {
  try {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(ONE_SIGNAL_APP_ID);
    if (__DEV__) console.log('[Layout] OneSignal initialized at module scope');
  } catch (e: any) {
    if (__DEV__) console.error('[Layout] Failed to initialize OneSignal at module scope:', e?.message || 'Unknown error');
  }
} else {
  if (ONESIGNAL_DISABLED) {
    if (__DEV__) console.log('[Layout] ⚠️ OneSignal is DISABLED for crash diagnosis');
  } else {
    if (__DEV__) console.log('[Layout] ⚠️ OneSignal module not available');
  }
}

import { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutContent />
    </ErrorBoundary>
  );
}

function RootLayoutContent() {
  log('Component', 'RootLayout function called');
  const [isInitializing, setIsInitializing] = useState(true);
  const [session, setSession] = useState<string | null>(null);
  const [profileValidated, setProfileValidated] = useState(false); // Track if profile loaded successfully
  const profileValidationRef = useRef<boolean>(false); // Ref to track validation status for timeout closure

  // Safe Initialization Side Effect
  useEffect(() => {
    const performSafeInit = async () => {
      try {
        log('Init', 'Starting safe initialization sequence...');

        // 1. Mapbox Init
        try {
          if (MAPBOX_TOKEN) {
            Mapbox.setAccessToken(MAPBOX_TOKEN);
            if (__DEV__) console.log('[Layout] Mapbox token configured');
          } else {
            if (__DEV__) console.warn('[Layout] Mapbox token is MISSING');
          }
        } catch (e) {
          if (__DEV__) console.error('[Layout] Failed to set Mapbox token:', e?.message || 'Unknown error');
        }

        // 2. OneSignal Permission Request (init already happened at module scope)
        if (!ONESIGNAL_DISABLED && OneSignal) {
          try {
            OneSignal.Notifications.requestPermission(true);
            if (__DEV__) console.log('[Layout] OneSignal permission requested');
          } catch (e: any) {
            if (__DEV__) console.error('[Layout] Failed to request OneSignal permission:', e?.message || 'Unknown error');
          }
        }

      } catch (error: any) {
        if (__DEV__) console.error('[Layout] Critical initialization error:', error?.message || 'Unknown error');
      }
    };

    performSafeInit();
  }, []);


  // Safe font loading with fallback if useFonts is unavailable
  const [fontsLoaded] = useFonts
    ? useFonts({ BebasNeue_400Regular })
    : [true]; // If fonts can't load, don't block the app

  const setCurrentUserId = useMemoryStore((state) => state.setCurrentUserId);
  log('Component', `State: isInitializing=${isInitializing}, session=${!!session}, profileValidated=${profileValidated}`);

  // Check if user is banned
  const { isBanned, isChecking: isBanCheckLoading } = useBanCheck();

  useEffect(() => {
    // OPTIMIZATION: Check auth state synchronously first for instant launch
    // This prevents the loading screen from appearing while waiting for onAuthStateChanged
    try {
      const currentUser = getCurrentUser();
      if (currentUser && !isAnonymous()) {
        // User is already authenticated - show app immediately
        const userId = currentUser.uid;
        if (__DEV__) console.log('[Layout] ✅ Fast path: User already authenticated, showing app immediately');
        setSession(userId);
        setCurrentUserId(userId);
        setIsInitializing(false);
        // Profile validation will happen in background via onAuthStateChanged
        setProfileValidated(true); // Optimistically allow navigation
      } else {
        // No user or anonymous - show auth screen immediately
        if (__DEV__) console.log('[Layout] ✅ Fast path: No user, showing auth screen immediately');
        setIsInitializing(false);
        setSession(null);
      }
    } catch (error: any) {
      if (__DEV__) console.warn('[Layout] Fast path check failed, falling back to listener:', error?.message || 'Unknown error');
      // Fall through to normal listener setup
    }

    // Listen for auth state changes (for future auth changes and profile validation)
    let unsubscribe: (() => void) | null = null;
    let isComplete = false;

    // Safety timeout: force initialization to complete after 2 seconds (reduced from 5s since we have fast path)
    const safetyTimeout = setTimeout(() => {
      if (!isComplete) {
        if (__DEV__) console.warn('[Layout] Auth listener timeout, proceeding');
        isComplete = true;
        setIsInitializing(false); // Safe to call even if already false
      }
    }, 2000);

    const setupAuthListener = async () => {
      try {
        // Subscribe to authorization state changes (will wait for Firebase internally)
        unsubscribe = await onAuthStateChanged(async (userId) => {
          if (__DEV__) console.log('[Layout] ========== AUTH STATE CHANGED ==========');
          if (__DEV__) console.log('[Layout] User ID:', userId ? userId.substring(0, 8) + '...' : 'NULL (signed out)');
          if (__DEV__) console.log('[Layout] Timestamp:', new Date().toISOString());

          // Clear timeout so it doesn't fire if we got a response
          clearTimeout(safetyTimeout);
          isComplete = true;

          if (!userId) {
            if (__DEV__) console.log('[Layout] 👋 User signed out - resetting state');
            useMemoryStore.getState().resetUser();
            setSession(null);
            setProfileValidated(false);
            setCurrentUserId(null);
            setIsInitializing(false);
            if (__DEV__) console.log('[Layout] ========== AUTH STATE CHANGE END (SIGNED OUT) ==========');
            return;
          }

          // User is authenticated - check if anonymous or Unknown profile first
          if (__DEV__) console.log('[Layout] ✅ User authenticated');
          if (__DEV__) console.log('[Layout] Setting session to:', userId ? userId.substring(0, 8) + '...' : 'NULL');
          if (__DEV__) console.log('[Layout] Current session state before:', session ? session.substring(0, 8) + '...' : 'NULL');

          // Check if user is anonymous - if so, sign them out immediately
          if (isAnonymous()) {
            if (__DEV__) console.warn('[Layout] ⚠️ Anonymous user detected - signing out to prevent auto-login');
            signOut().then(() => {
              if (__DEV__) console.log('[Layout] ✅ Signed out anonymous user');
              setSession(null);
              setProfileValidated(false);
              profileValidationRef.current = false;
              setCurrentUserId(null);
              setIsInitializing(false);
            }).catch((signOutError: any) => {
              if (__DEV__) console.error('[Layout] ❌ Failed to sign out anonymous user:', signOutError?.message || 'Unknown error');
              setSession(null);
              setProfileValidated(false);
              profileValidationRef.current = false;
              setCurrentUserId(null);
              setIsInitializing(false);
            });
            return; // Don't proceed with navigation
          }

          // Not anonymous - proceed with normal flow
          // Set session immediately - user is authenticated
          // Profile validation is for data loading, not authentication
          setSession(userId);
          setCurrentUserId(userId);
          setIsInitializing(false);
          // Optimistically allow navigation - profile validation happens in background
          setProfileValidated(true);
          if (__DEV__) console.log('[Layout] ✅ User authenticated - session set');
          if (__DEV__) console.log('[Layout] isInitializing set to false');

          // Validate profile BEFORE allowing navigation
          if (__DEV__) console.log('[Layout] 🔍 Starting profile validation for user:', userId ? userId.substring(0, 8) + '...' : 'NULL');

          // Helper function to validate profile with timeout
          const validateProfileWithTimeout = async (timeoutMs: number) => {
            const profilePromise = getUserProfile(userId);
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), timeoutMs)
            );

            try {
              const profile = await Promise.race([profilePromise, timeoutPromise]);
              return profile;
            } catch (error: any) {
              if (__DEV__) console.error('[Layout] Profile validation error:', error?.message || 'Unknown error');
              return null;
            }
          };

          // Try immediate validation (12 second timeout to match getUserProfile timeout + buffer)
          const validationStartTime = Date.now();
          validateProfileWithTimeout(12000)
            .then((profile) => {
              const validationDuration = Date.now() - validationStartTime;
              if (__DEV__) console.log('[Layout] Profile validation completed');
              if (__DEV__) console.log('[Layout] Validation duration:', validationDuration + 'ms');
              if (__DEV__) console.log('[Layout] Profile exists:', profile ? 'YES' : 'NO');
              if (__DEV__) console.log('[Layout] Username:', profile?.username || 'NONE');

              // Set session immediately - user is authenticated
              // Profile validation is for data loading, not authentication
              setSession(userId);

              // SYNC WITH GLOBAL STORE (Redundancy for Startup)
              if (profile) {
                const store = useMemoryStore.getState();
                store.setUsername(profile.username);
                store.setAvatarUri(profile.avatarUrl || null);
                store.setBio(profile.bio || null);
                if (profile.pinColor) store.setPinColor(profile.pinColor);
                if (profile.friends) store.setFriends(profile.friends);
                if (profile.bucketList) store.setBucketList(profile.bucketList);
                if (__DEV__) console.log('[Layout] ✅ Synced initial profile to MemoryStore');
              }

              if (!profile || !profile.username || profile.username === 'Unknown') {
                if (__DEV__) console.warn('[Layout] ⚠️ Profile validation failed - profile is null, missing username, or Unknown');
                if (__DEV__) console.warn('[Layout] This may indicate an orphaned auth session or Firestore issue');
                if (__DEV__) console.warn('[Layout] Continuing session cautiously (no forced logout)');

                // DO NOT set profileValidationRef.current = true here!
                // This allows the 20s timeout to fire and sign out the user
                // The user should re-authenticate properly
                setProfileValidated(false);
                if (__DEV__) console.log('[Layout] profileValidated set to false - waiting for timeout to sign out');
              } else {
                if (__DEV__) console.log('[Layout] ✅ Profile validated successfully');
                if (__DEV__) console.log('[Layout] Validated username:', profile.username);

                // Profile is valid - allow navigation
                profileValidationRef.current = true;
                setProfileValidated(true);
                if (__DEV__) console.log('[Layout] ✅ Profile validation set to true (success)');
                if (__DEV__) console.log('[Layout] ✅ Session set, navigation allowed');
              }
              if (__DEV__) console.log('[Layout] ========== AUTH STATE CHANGE END (AUTHENTICATED) ==========');
            })
            .catch((error: any) => {
              if (__DEV__) console.error('[Layout] ❌ Profile validation promise rejected');
              if (__DEV__) console.error('[Layout] Validation error:', error?.message || 'Unknown error');
              // On error, don't set profileValidationRef - let timeout handle it
              setProfileValidated(false);
              if (__DEV__) console.log('[Layout] profileValidated set to false due to error - waiting for timeout');
            });

          // Fallback: if profile still not validated after 20 seconds, sign out to prevent Unknown login
          const profileValidationTimeout = setTimeout(() => {
            if (!profileValidationRef.current) {
              if (__DEV__) console.warn('[Layout] ⚠️ Profile validation timeout after 20s - validation not confirmed');
              if (__DEV__) console.warn('[Layout] Keeping session active despite validation timeout to prevent logout loop');
              // We do NOT sign out here anymore.
              // Letting the user proceed (even if profile might be incomplete) is better than forced logout.
            }
          }, 20000);
        });
      } catch (error: any) {
        if (isComplete) return; // Already handled by timeout
        if (__DEV__) console.error('[Layout] Failed to setup auth listener:', error?.message || 'Unknown error');
        isComplete = true;
        clearTimeout(safetyTimeout);
        // Set initializing to false so app can still render
        setIsInitializing(false);
        setSession(null);
        setProfileValidated(false);
      }
    };

    setupAuthListener();

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Safety fallback: Force hide splash screen after 8 seconds if it hasn't hidden yet
  // This prevents the "infinity splash" issue if Mapbox or other assets fail to load.
  useEffect(() => {
    log('Splash', 'Setting up 8s safety timeout for splash hide');
    const timeout = setTimeout(async () => {
      log('Splash', '⚠️ SAFETY TIMEOUT HIT - forcing splash screen hide at 8s');
      await SplashScreen.hideAsync();
      log('Splash', 'Splash screen hidden (forced)');
    }, 8000);

    return () => clearTimeout(timeout);
  }, []);

  // Note: We delegate SplashScreen.hideAsync() to the child components (index.tsx / AuthScreen)
  // to ensure the splash stays visible until the actual screen is ready to render.

  // Debug logging (dev only)
  if (__DEV__) {
    console.log('[Layout] ========== RENDER CHECK ==========');
    console.log('[Layout] isInitializing:', isInitializing);
    console.log('[Layout] fontsLoaded:', fontsLoaded);
    console.log('[Layout] isBanCheckLoading:', isBanCheckLoading);
    console.log('[Layout] isBanned:', isBanned);
    console.log('[Layout] session:', session ? session.substring(0, 8) + '...' : 'NULL');
    console.log('[Layout] profileValidated:', profileValidated);
    console.log('[Layout] profileValidationRef.current:', profileValidationRef.current);
    console.log('[Layout] Will show AuthScreen:', !session || (session && !profileValidated));
    console.log('[Layout] Will show Main App:', session && profileValidated);
    console.log('[Layout] =================================');
  }

  // Show loading screen only for fonts, not for Firebase/auth
  // Firebase will initialize in the background
  if (!fontsLoaded) {
    if (__DEV__) console.log('[Layout] Fonts not loaded, showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  // If still initializing auth, show loading screen
  // This prevents AuthScreen from mounting and triggering biometrics prematurely
  if (isInitializing) {
    if (__DEV__) console.log('[Layout] Still initializing auth - showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Once initialization is done, decide where to go
  if (__DEV__) console.log('[Layout] Initialization complete. Session:', session ? session.substring(0, 8) + '...' : 'NULL');


  // If ban check is still loading, proceed anyway (it will check in background)
  if (isBanCheckLoading) {
    if (__DEV__) console.log('[Layout] Ban check still loading, proceeding anyway');
  }

  // If user is banned, they'll be shown an alert and signed out via useBanCheck hook
  if (isBanned) {
    if (__DEV__) console.log('[Layout] User is banned, not rendering');
    return null;
  }

  // Mandatory Auth: Show AuthScreen if no user is signed in
  // Note: profileValidated is now set optimistically, so it won't block navigation
  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={async (username) => {
          if (__DEV__) console.log('[Layout] ========== onAuthenticated CALLED ==========');
          if (__DEV__) console.log('[Layout] Username received:', username || 'NONE');

          if (username) {
            if (__DEV__) console.log('[Layout] Setting username in store:', username);
            useMemoryStore.getState().setUsername(username);
            if (__DEV__) console.log('[Layout] ✅ Username set in store');
          }

          // Force check auth state immediately and set session if user is signed in
          // This handles cases where onAuthStateChanged hasn't fired yet
          const { getCurrentUser } = require('@/src/services/authService');
          let currentUser = getCurrentUser();

          // Wait a moment for auth state to propagate
          if (!currentUser) {
            if (__DEV__) console.log('[Layout] User not immediately available, waiting 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
            currentUser = getCurrentUser();
          }

          if (currentUser) {
            if (__DEV__) console.log('[Layout] ✅ User found, setting session immediately:', currentUser.uid ? currentUser.uid.substring(0, 8) + '...' : 'NULL');
            setSession(currentUser.uid);
            setCurrentUserId(currentUser.uid);
            setProfileValidated(true);
            setIsInitializing(false);
            if (__DEV__) console.log('[Layout] ✅ Session set, navigation should occur');
          } else {
            if (__DEV__) console.log('[Layout] ⏳ User not found yet, waiting for onAuthStateChanged...');
          }
          if (__DEV__) console.log('[Layout] ============================================');
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({});
