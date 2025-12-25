import React from 'react';
import { StyleSheet, View } from 'react-native';

interface GradientPinProps {
    color: string;
    selected?: boolean;
}

/**
 * Option 4: Gradient Pin - Creates a glass-like gradient effect using layered views
 * Simulates a gradient/glass look without requiring external SVG or gradient libraries
 */
export const GradientPin: React.FC<GradientPinProps> = ({ color, selected = false }) => {
    // Lighten color for gradient top
    const lightenColor = (hex: string, percent: number) => {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    };

    const lightColor = lightenColor(color, 40);

    return (
        <View style={styles.container}>
            {/* Outer glow */}
            <View style={[styles.outerGlow, { backgroundColor: color }]} />

            {/* Pin body - teardrop shape simulation using overlapping circles */}
            <View style={styles.pinBody}>
                {/* Simulated Geometric Shadow */}
                <View style={styles.shadowLayer} />

                {/* Top highlight (lighter) */}
                <View style={[styles.topHighlight, { backgroundColor: lightColor }]} />

                {/* Main body */}
                <View style={[styles.mainBody, { backgroundColor: color }]} />

                {/* Glass overlay - white with transparency */}
                <View style={styles.glassOverlay} />

                {/* Inner white dot */}
                <View style={styles.innerDot} />
            </View>

            {/* Shadow/anchor point */}
            <View style={[styles.shadowDot, { backgroundColor: color }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        width: 50,
        height: 65,
    },
    outerGlow: {
        position: 'absolute',
        top: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        opacity: 0.25,
        transform: [{ scaleX: 1.2 }],
    },
    shadowLayer: {
        position: 'absolute',
        top: 10,
        width: 24,
        height: 32,
        borderRadius: 8,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    pinBody: {
        width: 32,
        height: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
        // overflow: 'hidden', // Removed to allow shadow to show
    },
    topHighlight: {
        position: 'absolute',
        top: 2,
        width: 28,
        height: 28,
        borderRadius: 14,
        opacity: 0.8,
    },
    mainBody: {
        position: 'absolute',
        top: 8,
        width: 24,
        height: 32,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        opacity: 0.9,
    },
    glassOverlay: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    innerDot: {
        position: 'absolute',
        top: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    shadowDot: {
        position: 'absolute',
        bottom: 0,
        width: 8,
        height: 4,
        borderRadius: 4,
        opacity: 0.4,
    },
});
