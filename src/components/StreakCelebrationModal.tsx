import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface StreakCelebrationModalProps {
    visible: boolean;
    streakCount: number;
    onDismiss: () => void;
    autoDismissMs?: number; // Auto dismiss after this many ms (default 4000)
}

export const StreakCelebrationModal: React.FC<StreakCelebrationModalProps> = ({
    visible,
    streakCount,
    onDismiss,
    autoDismissMs = 4000,
}) => {
    // Animation values
    const overlayOpacity = useSharedValue(0);
    const cardScale = useSharedValue(0.6);
    const cardOpacity = useSharedValue(0);
    const badgePulse = useSharedValue(1);
    const sparkle1Y = useSharedValue(0);
    const sparkle2Y = useSharedValue(0);
    const sparkle3Y = useSharedValue(0);
    const sparkle1Opacity = useSharedValue(0);
    const sparkle2Opacity = useSharedValue(0);
    const sparkle3Opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Trigger haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Animate in
            overlayOpacity.value = withTiming(1, { duration: 200 });
            cardOpacity.value = withTiming(1, { duration: 200 });
            cardScale.value = withSpring(1, { damping: 12, stiffness: 150 });

            // Continuous badge pulse
            badgePulse.value = withRepeat(
                withSequence(
                    withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );

            // Sparkle animations (staggered)
            const startSparkle = (
                yValue: Animated.SharedValue<number>,
                opacityValue: Animated.SharedValue<number>,
                delay: number
            ) => {
                yValue.value = 0;
                opacityValue.value = 0;
                yValue.value = withDelay(
                    delay,
                    withRepeat(
                        withTiming(-60, { duration: 1500, easing: Easing.out(Easing.ease) }),
                        -1,
                        false
                    )
                );
                opacityValue.value = withDelay(
                    delay,
                    withRepeat(
                        withSequence(
                            withTiming(1, { duration: 300 }),
                            withTiming(0, { duration: 1200 })
                        ),
                        -1,
                        false
                    )
                );
            };

            startSparkle(sparkle1Y, sparkle1Opacity, 0);
            startSparkle(sparkle2Y, sparkle2Opacity, 500);
            startSparkle(sparkle3Y, sparkle3Opacity, 1000);

            // Auto dismiss
            const timeout = setTimeout(() => {
                handleDismiss();
            }, autoDismissMs);

            return () => clearTimeout(timeout);
        } else {
            // Reset values when hidden
            overlayOpacity.value = 0;
            cardScale.value = 0.6;
            cardOpacity.value = 0;
        }
    }, [visible]);

    const handleDismiss = () => {
        // Animate out
        overlayOpacity.value = withTiming(0, { duration: 150 });
        cardScale.value = withTiming(0.8, { duration: 150 });
        cardOpacity.value = withTiming(0, { duration: 150 }, () => {
            runOnJS(onDismiss)();
        });
    };

    // Animated styles
    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [{ scale: cardScale.value }],
    }));

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgePulse.value }],
    }));

    const sparkleStyle = (y: Animated.SharedValue<number>, opacity: Animated.SharedValue<number>) =>
        useAnimatedStyle(() => ({
            transform: [{ translateY: y.value }],
            opacity: opacity.value,
        }));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleDismiss}
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleDismiss} activeOpacity={1}>
                    <Animated.View style={[styles.overlay, overlayStyle]} />
                </TouchableOpacity>

                {/* Card */}
                <Animated.View style={[styles.card, cardStyle]}>
                    {/* Sparkles */}
                    <View style={styles.sparkleContainer}>
                        <Animated.View style={[styles.sparkle, { left: '30%' }, sparkleStyle(sparkle1Y, sparkle1Opacity)]}>
                            <Text style={styles.sparkleText}>✦</Text>
                        </Animated.View>
                        <Animated.View style={[styles.sparkle, { left: '50%' }, sparkleStyle(sparkle2Y, sparkle2Opacity)]}>
                            <Text style={styles.sparkleText}>✦</Text>
                        </Animated.View>
                        <Animated.View style={[styles.sparkle, { left: '70%' }, sparkleStyle(sparkle3Y, sparkle3Opacity)]}>
                            <Text style={styles.sparkleText}>✦</Text>
                        </Animated.View>
                    </View>

                    {/* Flame Badge */}
                    <Animated.View style={[styles.badge, badgeStyle]}>
                        <Text style={styles.flameEmoji}>🔥</Text>
                        <Text style={styles.streakNumber}>{streakCount}</Text>
                    </Animated.View>

                    {/* Text */}
                    <Text style={styles.title}>Explore Streak!</Text>
                    <Text style={styles.subtitle}>{streakCount} {streakCount === 1 ? 'day' : 'days'} in a row</Text>

                    {/* Continue Button */}
                    <TouchableOpacity style={styles.button} onPress={handleDismiss}>
                        <Text style={styles.buttonText}>Continue</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    card: {
        width: width * 0.8,
        maxWidth: 320,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 28,
        paddingVertical: 36,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 20,
    },
    sparkleContainer: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        height: 80,
    },
    sparkle: {
        position: 'absolute',
        top: 60,
    },
    sparkleText: {
        fontSize: 18,
        color: '#FFB800',
    },
    badge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF8E7',
        borderWidth: 3,
        borderColor: '#FF8C00',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#FF8C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    flameEmoji: {
        fontSize: 32,
        marginBottom: -4,
    },
    streakNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FF6B00',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(0, 0, 0, 0.5)',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#FF8C00',
        paddingVertical: 14,
        paddingHorizontal: 48,
        borderRadius: 24,
        shadowColor: '#FF8C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
});
