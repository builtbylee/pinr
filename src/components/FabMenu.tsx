import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence, withSpring, withRepeat, Easing } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;

interface ProfileMenuProps {
    avatarUri: string | null;
    onPressProfile: () => void;
    onPressFriends: () => void;
    onPressAddPin: () => void;
    onPressGames?: () => void;
    onPressCreateStory?: () => void;
    // Badge counts
    friendRequestCount?: number;
    gameInviteCount?: number;
    newPinCount?: number;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
    avatarUri,
    onPressProfile,
    onPressFriends,
    onPressAddPin,
    onPressGames,
    onPressCreateStory,
    friendRequestCount = 0,
    gameInviteCount = 0,
    newPinCount = 0,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const animation = useSharedValue(0);
    const rotationValue = useSharedValue(0);

    // Pulse animation for red ring
    const ringPulse = useSharedValue(1);
    const ringOpacity = useSharedValue(1);
    const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevNotificationCount = useRef<number>(0);

    const hasNotifications = friendRequestCount > 0 || gameInviteCount > 0 || newPinCount > 0;
    const currentNotificationCount = friendRequestCount + gameInviteCount + newPinCount;

    // Start pulse animation for 3 seconds
    const startPulseAnimation = () => {
        // Clear any existing timeout
        if (pulseTimeoutRef.current) {
            clearTimeout(pulseTimeoutRef.current);
        }

        // Start pulsing - stronger effect matching pin animation
        ringPulse.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 500, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
            ),
            -1,
            false
        );
        ringOpacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
                withTiming(0.7, { duration: 500, easing: Easing.in(Easing.ease) })
            ),
            -1,
            false
        );

        // Stop after 3 seconds
        pulseTimeoutRef.current = setTimeout(() => {
            ringPulse.value = withTiming(1, { duration: 200 });
            ringOpacity.value = withTiming(1, { duration: 200 });
        }, 3000);
    };

    // Trigger pulse on notification count increase or on mount with existing notifications
    useEffect(() => {
        if (currentNotificationCount > prevNotificationCount.current ||
            (prevNotificationCount.current === 0 && currentNotificationCount > 0)) {
            startPulseAnimation();
        }
        prevNotificationCount.current = currentNotificationCount;
    }, [currentNotificationCount]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
        };
    }, []);

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringPulse.value }],
        opacity: ringOpacity.value,
    }));

    const triggerBounce = () => {
        rotationValue.value = withSequence(
            withTiming(15, { duration: 100 }),
            withTiming(-5, { duration: 80 }),
            withTiming(0, { duration: 80 })
        );
    };

    const toggleMenu = () => {
        const toValue = isOpen ? 0 : 1;
        animation.value = withTiming(toValue, { duration: 250 });
        triggerBounce();
        setIsOpen(!isOpen);
    };

    const closeMenu = () => {
        animation.value = withTiming(0, { duration: 200 });
        setIsOpen(false);
    };

    const handleMenuPress = (action: () => void) => {
        closeMenu();
        action();
    };

    const rotationStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotationValue.value}deg` }]
    }));

    // Menu circles animate in with staggered timing
    const circleStyle = (index: number) => useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { translateX: withSpring((1 - animation.value) * (40 + index * 10), { damping: 18, stiffness: 180 }) },
            { scale: withSpring(0.8 + animation.value * 0.2, { damping: 15, stiffness: 200 }) }
        ]
    }));

    const circleSize = isSmallScreen ? 44 : 50;

    // Combined Badge for Friends Icon (Requests + New Pins)
    const combinedFriendBadge = friendRequestCount + newPinCount;

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Circular Menu Options */}
            <View style={styles.menuRow} pointerEvents={isOpen ? 'auto' : 'none'}>
                {/* Add Pin */}
                <Animated.View style={[circleStyle(0)]}>
                    <TouchableOpacity
                        style={[styles.circleButton, { width: circleSize, height: circleSize }]}
                        onPress={() => handleMenuPress(onPressAddPin)}
                    >
                        <Feather name="map-pin" size={20} color="#1a1a1a" />
                    </TouchableOpacity>
                </Animated.View>

                {/* Friends */}
                <Animated.View style={[circleStyle(1)]}>
                    <TouchableOpacity
                        style={[styles.circleButton, { width: circleSize, height: circleSize }]}
                        onPress={() => handleMenuPress(onPressFriends)}
                    >
                        <Feather name="users" size={20} color="#1a1a1a" />
                        {combinedFriendBadge > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {combinedFriendBadge > 9 ? '9+' : combinedFriendBadge}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Games */}
                {onPressGames && (
                    <Animated.View style={[circleStyle(2)]}>
                        <TouchableOpacity
                            style={[styles.circleButton, { width: circleSize, height: circleSize }]}
                            onPress={() => handleMenuPress(onPressGames)}
                        >
                            <Feather name="dribbble" size={20} color="#1a1a1a" />
                            {gameInviteCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {gameInviteCount > 9 ? '9+' : gameInviteCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Profile/Settings */}
                <Animated.View style={[circleStyle(4)]}>
                    <TouchableOpacity
                        style={[styles.circleButton, { width: circleSize, height: circleSize }]}
                        onPress={() => handleMenuPress(onPressProfile)}
                    >
                        <Feather name="user" size={20} color="#1a1a1a" />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Avatar Trigger Button */}
            <TouchableOpacity onPress={toggleMenu} activeOpacity={0.8} style={styles.fabShadowWrapper}>
                <Animated.View style={[styles.fab, rotationStyle]}>
                    {avatarUri ? (
                        <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatarImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={styles.defaultAvatar}>
                            <Feather name="user" size={28} color="white" />
                        </View>
                    )}
                    {/* Animated red ring overlay when notifications exist */}
                    {hasNotifications ? (
                        <Animated.View
                            style={[
                                styles.borderOverlay,
                                { borderColor: '#EF4444', borderWidth: 3 },
                                animatedRingStyle
                            ]}
                            pointerEvents="none"
                        />
                    ) : (
                        <View
                            style={styles.borderOverlay}
                            pointerEvents="none"
                        />
                    )}
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

// Keep old export for backwards compatibility
export const FabMenu = ProfileMenu;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: isSmallScreen ? 8 : 10,
        marginRight: 12,
    },
    circleButton: {
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    fabShadowWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        backgroundColor: 'transparent',
        zIndex: 20,
    },
    fab: {
        flex: 1,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
    },
    defaultAvatar: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: 'white',
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '700',
    },
});
