import '@/src/config/firestore'; // CRITICAL: Must be first import to configure Long Polling
import Mapbox from '@rnmapbox/maps';
import { OneSignal, LogLevel } from 'react-native-onesignal';
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
  const elapsed = Date.now() - COLD_START_TIME;
  console.log(`[Perf +${elapsed}ms] [Layout:${tag}] ${msg}`);
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
console.log('[Layout] ⚠️ App Check is TEMPORARILY DISABLED for testing Firestore subscriptions');

// Safe font loading import with fallback
let useFonts: any;
let BebasNeue_400Regular: any;
try {
  const fontModule = require('@expo-google-fonts/bebas-neue');
  useFonts = fontModule.useFonts;
  BebasNeue_400Regular = fontModule.BebasNeue_400Regular;
} catch (e) {
  console.warn('[Layout] Font module failed to load:', e);
}

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'RNMapbox DEPRECATION WARNING',
  'RNMapbox: Please upgrade to New Architecture',
  'RNMapbox: For sponsor-only support'
]);

// Initialize OneSignal - defined outside to keep const reference but init inside component
const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';

// CRITICAL: Initialize OneSignal at module scope to ensure it runs before any child useEffects
// This prevents race conditions where index.tsx calls notificationService.login() before init
try {
  OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  OneSignal.initialize(ONE_SIGNAL_APP_ID);
  console.log('[Layout] OneSignal initialized at module scope');
} catch (e) {
  console.error('[Layout] Failed to initialize OneSignal at module scope:', e);
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
            console.log('[Layout] Mapbox token configured');
          } else {
            console.warn('[Layout] Mapbox token is MISSING');
          }
        } catch (e) {
          console.error('[Layout] Failed to set Mapbox token:', e);
        }

        // 2. OneSignal Permission Request (init already happened at module scope)
        try {
          OneSignal.Notifications.requestPermission(true);
          console.log('[Layout] OneSignal permission requested');
        } catch (e) {
          console.error('[Layout] Failed to request OneSignal permission:', e);
        }

      } catch (error) {
        console.error('[Layout] Critical initialization error:', error);
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
    // Listen for auth state changes
    let unsubscribe: (() => void) | null = null;
    let isComplete = false;

    // Safety timeout: force initialization to complete after 5 seconds
    const safetyTimeout = setTimeout(() => {
      if (!isComplete) {
        console.warn('[Layout] Auth initialization timeout, proceeding with no session');
        isComplete = true;
        setIsInitializing(false);
        setSession(null);
      }
    }, 5000);

    const setupAuthListener = async () => {
      try {
        // Subscribe to authorization state changes (will wait for Firebase internally)
        unsubscribe = await onAuthStateChanged(async (userId) => {
          console.log('[Layout] ========== AUTH STATE CHANGED ==========');
          console.log('[Layout] User ID:', userId || 'NULL (signed out)');
          console.log('[Layout] Timestamp:', new Date().toISOString());

          // Clear timeout so it doesn't fire if we got a response
          clearTimeout(safetyTimeout);
          isComplete = true;

          if (!userId) {
            console.log('[Layout] 👋 User signed out - resetting state');
            useMemoryStore.getState().resetUser();
            setSession(null);
            setProfileValidated(false);
            setCurrentUserId(null);
            setIsInitializing(false);
            console.log('[Layout] ========== AUTH STATE CHANGE END (SIGNED OUT) ==========');
            return;
          }

          // User is authenticated - check if anonymous or Unknown profile first
          console.log('[Layout] ✅ User authenticated');
          console.log('[Layout] Setting session to:', userId);
          console.log('[Layout] Current session state before:', session);

          // Check if user is anonymous - if so, sign them out immediately
          if (isAnonymous()) {
            console.warn('[Layout] ⚠️ Anonymous user detected - signing out to prevent auto-login');
            signOut().then(() => {
              console.log('[Layout] ✅ Signed out anonymous user');
              setSession(null);
              setProfileValidated(false);
              profileValidationRef.current = false;
              setCurrentUserId(null);
              setIsInitializing(false);
            }).catch((signOutError: any) => {
              console.error('[Layout] ❌ Failed to sign out anonymous user:', signOutError);
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
          console.log('[Layout] ✅ User authenticated - session set');
          console.log('[Layout] isInitializing set to false');

          // Validate profile BEFORE allowing navigation
          console.log('[Layout] 🔍 Starting profile validation for user:', userId);

          // Helper function to validate profile with timeout
          const validateProfileWithTimeout = async (timeoutMs: number) => {
            const profilePromise = getUserProfile(userId);
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), timeoutMs)
            );

            try {
              const profile = await Promise.race([profilePromise, timeoutPromise]);
              return profile;
            } catch (error) {
              console.error('[Layout] Profile validation error:', error);
              return null;
            }
          };

          // Try immediate validation (12 second timeout to match getUserProfile timeout + buffer)
          const validationStartTime = Date.now();
          validateProfileWithTimeout(12000)
            .then((profile) => {
              const validationDuration = Date.now() - validationStartTime;
              console.log('[Layout] Profile validation completed');
              console.log('[Layout] Validation duration:', validationDuration + 'ms');
              console.log('[Layout] Profile exists:', profile ? 'YES' : 'NO');
              console.log('[Layout] Username:', profile?.username || 'NONE');

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
                console.log('[Layout] ✅ Synced initial profile to MemoryStore');
              }

              if (!profile || !profile.username || profile.username === 'Unknown') {
                console.warn('[Layout] ⚠️ Profile validation failed - profile is null, missing username, or Unknown');
                console.warn('[Layout] This may indicate an orphaned auth session or Firestore issue');
                console.warn('[Layout] Continuing session cautiously (no forced logout)');

                // DO NOT set profileValidationRef.current = true here!
                // This allows the 20s timeout to fire and sign out the user
                // The user should re-authenticate properly
                setProfileValidated(false);
                console.log('[Layout] profileValidated set to false - waiting for timeout to sign out');
              } else {
                console.log('[Layout] ✅ Profile validated successfully');
                console.log('[Layout] Validated username:', profile.username);

                // Profile is valid - allow navigation
                profileValidationRef.current = true;
                setProfileValidated(true);
                console.log('[Layout] ✅ Profile validation set to true (success)');
                console.log('[Layout] ✅ Session set, navigation allowed');
              }
              console.log('[Layout] ========== AUTH STATE CHANGE END (AUTHENTICATED) ==========');
            })
            .catch((error) => {
              console.error('[Layout] ❌ Profile validation promise rejected');
              console.error('[Layout] Validation error:', error);
              // On error, don't set profileValidationRef - let timeout handle it
              setProfileValidated(false);
              console.log('[Layout] profileValidated set to false due to error - waiting for timeout');
            });

          // Fallback: if profile still not validated after 20 seconds, sign out to prevent Unknown login
          const profileValidationTimeout = setTimeout(() => {
            if (!profileValidationRef.current) {
              console.warn('[Layout] ⚠️ Profile validation timeout after 20s - validation not confirmed');
              console.warn('[Layout] Keeping session active despite validation timeout to prevent logout loop');
              // We do NOT sign out here anymore.
              // Letting the user proceed (even if profile might be incomplete) is better than forced logout.
            }
          }, 20000);
        });
      } catch (error) {
        if (isComplete) return; // Already handled by timeout
        console.error('[Layout] Failed to setup auth listener:', error);
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

  // Debug logging
  console.log('[Layout] ========== RENDER CHECK ==========');
  console.log('[Layout] isInitializing:', isInitializing);
  console.log('[Layout] fontsLoaded:', fontsLoaded);
  console.log('[Layout] isBanCheckLoading:', isBanCheckLoading);
  console.log('[Layout] isBanned:', isBanned);
  console.log('[Layout] session:', session || 'NULL');
  console.log('[Layout] profileValidated:', profileValidated);
  console.log('[Layout] profileValidationRef.current:', profileValidationRef.current);
  console.log('[Layout] Will show AuthScreen:', !session || (session && !profileValidated));
  console.log('[Layout] Will show Main App:', session && profileValidated);
  console.log('[Layout] =================================');

  // Show loading screen only for fonts, not for Firebase/auth
  // Firebase will initialize in the background
  if (!fontsLoaded) {
    console.log('[Layout] Fonts not loaded, showing loading screen');
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
    console.log('[Layout] Still initializing auth - showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Once initialization is done, decide where to go
  console.log('[Layout] Initialization complete. Session:', session);


  // If ban check is still loading, proceed anyway (it will check in background)
  if (isBanCheckLoading) {
    console.log('[Layout] Ban check still loading, proceeding anyway');
  }

  // If user is banned, they'll be shown an alert and signed out via useBanCheck hook
  if (isBanned) {
    console.log('[Layout] User is banned, not rendering');
    return null;
  }

  // Mandatory Auth: Show AuthScreen if no user is signed in
  // Note: profileValidated is now set optimistically, so it won't block navigation
  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={async (username) => {
          console.log('[Layout] ========== onAuthenticated CALLED ==========');
          console.log('[Layout] Username received:', username || 'NONE');

          if (username) {
            console.log('[Layout] Setting username in store:', username);
            useMemoryStore.getState().setUsername(username);
            console.log('[Layout] ✅ Username set in store');
          }

          // Force check auth state immediately and set session if user is signed in
          // This handles cases where onAuthStateChanged hasn't fired yet
          const { getCurrentUser } = require('@/src/services/authService');
          let currentUser = getCurrentUser();

          // Wait a moment for auth state to propagate
          if (!currentUser) {
            console.log('[Layout] User not immediately available, waiting 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
            currentUser = getCurrentUser();
          }

          if (currentUser) {
            console.log('[Layout] ✅ User found, setting session immediately:', currentUser.uid);
            setSession(currentUser.uid);
            setCurrentUserId(currentUser.uid);
            setProfileValidated(true);
            setIsInitializing(false);
            console.log('[Layout] ✅ Session set, navigation should occur');
          } else {
            console.log('[Layout] ⏳ User not found yet, waiting for onAuthStateChanged...');
          }
          console.log('[Layout] ============================================');
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
