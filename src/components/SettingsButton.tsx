import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';

interface SettingsButtonProps {
    onPressSettings: () => void;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({
    onPressSettings,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const animation = useSharedValue(0);
    const rotationValue = useSharedValue(0);

    const triggerRotation = () => {
        rotationValue.value = withSequence(
            withTiming(90, { duration: 150 }),
            withTiming(0, { duration: 100 })
        );
    };

    const toggleMenu = () => {
        const toValue = isOpen ? 0 : 1;
        animation.value = withTiming(toValue, { duration: 200 });
        triggerRotation();
        setIsOpen(!isOpen);
    };

    const closeMenu = () => {
        animation.value = withTiming(0, { duration: 150 });
        setIsOpen(false);
    };

    const handlePress = () => {
        closeMenu();
        onPressSettings();
    };

    const rotationStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotationValue.value}deg` }]
    }));

    // Dropdown slides down from button
    const dropdownStyle = useAnimatedStyle(() => ({
        opacity: animation.value,
        transform: [
            { translateY: withTiming((1 - animation.value) * -20, { duration: 200 }) },
            { scale: withTiming(0.9 + animation.value * 0.1, { duration: 150 }) }
        ]
    }));

    return (
        <View style={styles.container}>
            {/* Settings Gear Button */}
            <TouchableOpacity onPress={toggleMenu} activeOpacity={0.8} style={styles.buttonWrapper}>
                <Animated.View style={[styles.button, rotationStyle]}>
                    <Feather name="settings" size={22} color="white" />
                </Animated.View>
            </TouchableOpacity>

            {/* Dropdown Menu */}
            <Animated.View style={[styles.dropdown, dropdownStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
                <View style={[styles.blurBg, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}>
                    <TouchableOpacity style={styles.menuItem} onPress={handlePress}>
                        <Feather name="sliders" size={18} color="#1a1a1a" />
                        <Text style={styles.menuText}>Settings</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        right: 20,
        alignItems: 'flex-end',
        zIndex: 10,
    },
    buttonWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    button: {
        flex: 1,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dropdown: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    blurBg: {
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    menuText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginLeft: 8,
    },
});
