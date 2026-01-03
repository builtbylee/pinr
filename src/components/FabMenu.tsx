import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence, withSpring, withRepeat, Easing } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;

interface ProfileMenuProps {
    avatarUri: string | null;
    pinColor?: string; // User's pin color for ring
    onPressProfile: () => void;
    onPressFriends: () => void;
    onPressAddPin: () => void;
    onPressGames?: () => void;
    onPressCreateStory?: () => void;
    onPressExplore?: () => void;
    // Badge counts
    friendRequestCount?: number;
    gameInviteCount?: number;
    newPinCount?: number;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
    avatarUri,
    pinColor,
    onPressProfile,
    onPressFriends,
    onPressAddPin,
    onPressGames,
    onPressCreateStory,
    onPressExplore,
    friendRequestCount = 0,
    gameInviteCount = 0,
    newPinCount = 0,
}) => {
    const insets = useSafeAreaInsets();
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
        }, 3000) as any;
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

    // Animated pill bar style - slides from right to left
    const pillBarStyle = useAnimatedStyle(() => ({
        opacity: animation.value,
        transform: [
            { translateX: withSpring((1 - animation.value) * 300, { damping: 20, stiffness: 200 }) },
            { scale: withSpring(0.9 + animation.value * 0.1, { damping: 15, stiffness: 200 }) }
        ],
    }));

    const circleSize = isSmallScreen ? 40 : 44;
    const iconSize = isSmallScreen ? 18 : 20;

    // Combined Badge for Friends Icon (Requests + New Pins)
    const combinedFriendBadge = friendRequestCount + newPinCount;

    return (
        <View style={[styles.container, { bottom: 20 + (insets.bottom || 20) }]} pointerEvents="box-none">
            {/* Pill-shaped Menu Bar */}
            <Animated.View
                style={[styles.pillBar, pillBarStyle]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                {/* Add Pin */}
                <TouchableOpacity
                    testID="fab-add-pin"
                    style={[styles.pillIcon, { width: circleSize, height: circleSize }]}
                    onPress={() => handleMenuPress(onPressAddPin)}
                >
                    <Feather name="map-pin" size={iconSize} color="#4B5563" />
                </TouchableOpacity>

                {/* Friends */}
                <TouchableOpacity
                    testID="fab-friends-button"
                    style={[styles.pillIcon, { width: circleSize, height: circleSize }]}
                    onPress={() => handleMenuPress(onPressFriends)}
                >
                    <Feather name="users" size={iconSize} color="#4B5563" />
                    {combinedFriendBadge > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {combinedFriendBadge > 9 ? '9+' : combinedFriendBadge}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Games */}
                {onPressGames && (
                    <TouchableOpacity
                        style={[styles.pillIcon, { width: circleSize, height: circleSize }]}
                        onPress={() => handleMenuPress(onPressGames)}
                    >
                        <Ionicons name="trophy-outline" size={iconSize} color="#4B5563" />
                        {gameInviteCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {gameInviteCount > 9 ? '9+' : gameInviteCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {/* Explore / Search */}
                {onPressExplore && (
                    <TouchableOpacity
                        testID="fab-search-button"
                        style={[styles.pillIcon, { width: circleSize, height: circleSize }]}
                        onPress={() => handleMenuPress(onPressExplore)}
                    >
                        <Feather name="search" size={iconSize} color="#4B5563" />
                    </TouchableOpacity>
                )}

                {/* Profile */}
                <TouchableOpacity
                    testID="fab-profile-button"
                    style={[styles.pillIcon, { width: circleSize, height: circleSize }]}
                    onPress={() => handleMenuPress(onPressProfile)}
                >
                    <Feather name="user" size={iconSize} color="#4B5563" />
                </TouchableOpacity>
            </Animated.View>

            {/* Avatar Trigger Button */}
            <TouchableOpacity testID="fab-menu-toggle" onPress={toggleMenu} activeOpacity={0.8} style={styles.fabShadowWrapper}>
                <Animated.View style={[styles.fab, rotationStyle]}>
                    {avatarUri ? (
                        <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatarImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={styles.defaultAvatar}>
                            <Feather name="user" size={28} color="rgba(0,0,0,0.3)" />
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
                            style={[
                                styles.borderOverlay,
                                {
                                    borderColor: avatarUri && pinColor ? pinColor : '#FFFFFF',
                                    borderWidth: 3
                                }
                            ]}
                            pointerEvents="none"
                        />
                    )}
                </Animated.View>
            </TouchableOpacity>
        </View >
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
    pillBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 999,
        paddingHorizontal: isSmallScreen ? 8 : 12,
        paddingVertical: 8,
        marginRight: 12,
        gap: isSmallScreen ? 4 : 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    pillIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 999,
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
        backgroundColor: '#e0e0e0',
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
        backgroundColor: '#e0e0e0',
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
