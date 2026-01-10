import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

/**
 * This route handles the Apple Sign-In OAuth callback deep link.
 * The actual auth flow is handled by WebBrowser.openAuthSessionAsync in authService.
 * This route just ensures the app doesn't show "Unmatched Route" if the deep link
 * is processed by expo-router after the auth flow completes.
 */
export default function AppleAuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // The auth flow should have already completed by the time we get here.
        // Just navigate back to dismiss this screen.
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    }, [router]);

    // Show a brief loading state while redirecting
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator size="large" color="#fff" />
        </View>
    );
}
