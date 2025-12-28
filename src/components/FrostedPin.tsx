import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
} from 'react-native-reanimated';

interface FrostedPinProps {
    color: string;
    selected?: boolean;
    isHighlighted?: boolean;
}

export const FrostedPin: React.FC<FrostedPinProps> = ({ color, selected = false, isHighlighted = false }) => {
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.4);

    useEffect(() => {
        if (isHighlighted) {
            // Animate pulse when highlighted
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.3, { duration: 500, easing: Easing.out(Easing.ease) }),
                    withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
                ),
                -1,
                true
            );
            pulseOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 500 }),
                    withTiming(0.4, { duration: 500 })
                ),
                -1,
                true
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 200 });
            pulseOpacity.value = withTiming(0.4, { duration: 200 });
        }
    }, [isHighlighted]);

    const animatedGlowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Ambient glow behind pin - animated when highlighted */}
            <Animated.View style={[styles.glow, { backgroundColor: color }, animatedGlowStyle]} />

            {/* Frosted glass pin body */}
            <View style={styles.pinBody}>
                {/* Blur layer for frosted effect */}
                <View style={[styles.blurOverlay, { backgroundColor: 'rgba(255, 255, 255, 0.7)' }]} />

                {/* Pin icon with color */}
                <Feather
                    name="map-pin"
                    size={44}
                    color={color}
                    style={styles.icon}
                />

                {/* White center dot */}
                <View style={styles.centerDot} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 50,
        height: 60,
    },
    glow: {
        position: 'absolute',
        bottom: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        opacity: 0.4,
    },
    pinBody: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 52,
    },
    blurOverlay: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        top: 4,
        overflow: 'hidden',
    },
    icon: {
        // Icon sits on top of blur
    },
    centerDot: {
        position: 'absolute',
        top: 14,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'white',
        // Subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
});

