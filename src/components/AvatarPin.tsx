import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, ImageStyle, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
} from 'react-native-reanimated';

interface AvatarPinProps {
    avatarUri: string | null;
    ringColor: string;
    isPulsing?: boolean;
    isStory?: boolean; // Shows red + badge for story pins
}

/**
 * AvatarPin - Displays user's profile picture with a colored ring and glow aura
 * When isPulsing is true, the entire pin turns red and pulses
 * When isStory is true, shows a red + badge in top-right corner
 */
export const AvatarPin: React.FC<AvatarPinProps> = ({ avatarUri, ringColor, isPulsing = false, isStory = false }) => {
    // Animation values for pulsing effect
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(1);

    // Handle pulse animation when isPulsing changes
    useEffect(() => {
        if (isPulsing) {
            // Start pulsing animation - entire pin scales
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 500, easing: Easing.out(Easing.ease) }),
                    withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
                ),
                -1, // Infinite repeat
                false
            );
            // Subtle opacity pulse
            pulseOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
                    withTiming(0.85, { duration: 500, easing: Easing.in(Easing.ease) })
                ),
                -1,
                false
            );
        } else {
            // Reset to static state
            pulseScale.value = withTiming(1, { duration: 200 });
            pulseOpacity.value = withTiming(1, { duration: 200 });
        }
    }, [isPulsing]);

    const animatedPinStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    // When pulsing, preserve original color but scale/opacity changes
    const currentRingColor = ringColor;

    return (
        <Animated.View style={[styles.container, animatedPinStyle]}>
            {/* Story Badge - Plus symbol in top right, overlapping ring */}
            {isStory && (
                <View style={styles.storyBadge}>
                    <Feather name="plus" size={14} color="white" />
                </View>
            )}

            {/* Shadow View - Explicitly rendered to match ClusterPin */}
            <View style={styles.pinShadow} />

            {/* The Teardrop Shape (Rotated Square) containing the Avatar */}
            <View style={[styles.pinBody, { backgroundColor: currentRingColor }]}>
                <View style={styles.avatarContainer}>
                    {avatarUri ? (
                        <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatar as any}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder as any} />
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 70, // Taller to accommodate the point
    },
    innerGlow: {
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
        top: 6, // Align with the circular head of the pin
    },
    pinShadow: {
        position: 'absolute',
        width: 46,
        height: 46,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 23,
        borderBottomLeftRadius: 0,
        transform: [{ rotate: '-45deg' }, { translateY: 2 }],
        top: 14,
    },
    pinBody: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 46,
        height: 46,
        borderTopLeftRadius: 23,
        borderTopRightRadius: 23,
        borderBottomRightRadius: 23,
        borderBottomLeftRadius: 0,
        borderBottomLeftRadius: 0,
        transform: [{ rotate: '-45deg' }],
        // Shadow for depth (matches ClusterPin)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    avatarContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff', // White border effect
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '45deg' }], // Counter-rotate to keep image upright
    },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
    },
    avatarPlaceholder: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    storyBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFD700', // Gold background
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        borderWidth: 1.5,
        borderColor: 'white', // White border to separate from map/pin
        // Shadow for visibility
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    storyBadgeText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: -2,
    },
});
