import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// NOTE: React Native Skia requires native builds and cannot be used in OTA updates
// For now, LiquidGlass uses BlurView only. Skia enhancements can be added
// after a native rebuild that includes the Skia native module.

interface LiquidGlassProps {
    /**
     * Blur intensity (0-100)
     * Passed to BlurView for true background blur
     */
    intensity?: number;
    
    /**
     * Tint color: "light", "dark", or "default"
     * "light" = white overlay, "dark" = black overlay, "default" = no overlay
     */
    tint?: 'light' | 'dark' | 'default';
    
    /**
     * Container style (typically StyleSheet.absoluteFill or custom styles)
     */
    style?: ViewStyle;
    
    /**
     * Children to render on top of the blur
     */
    children?: React.ReactNode;
}

/**
 * LiquidGlass - A liquid glass effect component
 * 
 * Currently uses BlurView for background blur. Skia enhancements will be added
 * after a native rebuild that includes the Skia native module.
 * 
 * NOTE: React Native Skia requires native builds and cannot be used in OTA updates.
 * This component is designed to work with OTA updates using BlurView only.
 */
export const LiquidGlass: React.FC<LiquidGlassProps> = ({
    intensity = 20,
    tint = 'default',
    style,
    children,
}) => {
    return (
        <View style={[styles.container, style]}>
            {/* BlurView provides true background blur of React Native views */}
            <BlurView 
                intensity={intensity} 
                tint={tint === 'default' ? 'light' : tint}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Children rendered on top */}
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
});
