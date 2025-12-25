import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface BriefcasePinProps {
    color: string;
    selected?: boolean;
}

/**
 * Briefcase Pin - Frosted glass briefcase/suitcase icon for travel memories
 */
export const BriefcasePin: React.FC<BriefcasePinProps> = ({ color, selected = false }) => {
    return (
        <View style={styles.container}>
            {/* Outer glow - large soft aura */}
            <View style={[styles.outerGlow, { backgroundColor: color }]} />

            {/* Inner glow - brighter core aura */}
            <View style={[styles.innerGlow, { backgroundColor: color }]} />

            {/* Frosted glass body */}
            <View style={styles.iconBody}>
                {/* Blur layer for frosted effect */}
                <View style={[styles.blurOverlay, { backgroundColor: 'rgba(255, 255, 255, 0.4)' }]} />

                {/* Location pin icon with color */}
                <Feather
                    name="map-pin"
                    size={25}
                    color={color}
                    style={styles.icon}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 63,
        height: 63,
    },
    outerGlow: {
        position: 'absolute',
        width: 54,
        height: 54,
        borderRadius: 27,
        opacity: 0.2,
    },
    innerGlow: {
        position: 'absolute',
        width: 45,
        height: 45,
        borderRadius: 22,
        opacity: 0.4,
    },
    iconBody: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        overflow: 'hidden',
    },
    blurOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 22,
    },
    icon: {
        // Icon sits on top of blur
    },
});
