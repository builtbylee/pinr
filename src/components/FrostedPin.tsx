import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface FrostedPinProps {
    color: string;
    selected?: boolean;
}

export const FrostedPin: React.FC<FrostedPinProps> = ({ color, selected = false }) => {
    return (
        <View style={styles.container}>
            {/* Ambient glow behind pin */}
            <View style={[styles.glow, { backgroundColor: color }]} />

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
