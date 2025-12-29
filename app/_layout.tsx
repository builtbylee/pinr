import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, LogBox, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

import { MAPBOX_TOKEN } from '@/src/constants/Config';
import { onAuthStateChanged } from '@/src/services/authService';
import { useMemoryStore } from '@/src/store/useMemoryStore';
import { AuthScreen } from '@/src/components/AuthScreen';
import { initializeAppCheck } from '@/src/services/appCheckService';
import { useBanCheck } from '@/src/hooks/useBanCheck';

// Initialize App Check early (before any Firebase calls)
initializeAppCheck();

import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'RNMapbox DEPRECATION WARNING',
  'RNMapbox: Please upgrade to New Architecture',
  'RNMapbox: For sponsor-only support'
]);

// Set your Mapbox access token here
Mapbox.setAccessToken(MAPBOX_TOKEN);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

import { LogLevel, OneSignal } from 'react-native-onesignal';

// Initialize OneSignal
const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';
OneSignal.Debug.setLogLevel(LogLevel.Verbose);
OneSignal.initialize(ONE_SIGNAL_APP_ID);

// Request permission immediately (you might want to move this to a more appropriate time specific to your UX)
OneSignal.Notifications.requestPermission(true);

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [session, setSession] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
  });

  const setCurrentUserId = useMemoryStore((state) => state.setCurrentUserId);

  // Check if user is banned
  const { isBanned, isChecking: isBanCheckLoading } = useBanCheck();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged((userId) => {
      console.log('[Auth] State changed:', userId);
      if (!userId) {
        useMemoryStore.getState().resetUser();
      }
      setSession(userId); // Local state for immediate render decision
      setCurrentUserId(userId); // Sync store
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // Safety fallback: Force hide splash screen after 8 seconds if it hasn't hidden yet
  // This prevents the "infinity splash" issue if Mapbox or other assets fail to load.
  useEffect(() => {
    const timeout = setTimeout(async () => {
      console.log('[Layout] Safety timeout hit: forcing splash screen hide.');
      await SplashScreen.hideAsync();
    }, 8000);

    return () => clearTimeout(timeout);
  }, []);

  // Note: We delegate SplashScreen.hideAsync() to the child components (index.tsx / AuthScreen)
  // to ensure the splash stays visible until the actual screen is ready to render.

  if (isInitializing || !fontsLoaded || isBanCheckLoading) {
    return null;
  }

  // If user is banned, they'll be shown an alert and signed out via useBanCheck hook
  if (isBanned) {
    return null;
  }

  // Mandatory Auth: Show AuthScreen if no user is signed in
  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={(username) => {
          if (username) {
            console.log('[Auth] Pre-setting username:', username);
            useMemoryStore.getState().setUsername(username);
          }
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
