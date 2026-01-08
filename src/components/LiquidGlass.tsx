import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// React Native Skia requires native builds - not available in OTA updates
// Make it optional to prevent crashes
let SkiaAvailable = false;
let Canvas: any;
let Rect: any;
let rrect: any;
let Skia: any;
let LinearGradient: any;
let vec: any;

try {
    const skiaModule = require('@shopify/react-native-skia');
    Canvas = skiaModule.Canvas;
    Rect = skiaModule.Rect;
    rrect = skiaModule.rrect;
    Skia = skiaModule.Skia;
    LinearGradient = skiaModule.LinearGradient;
    vec = skiaModule.vec;
    SkiaAvailable = true;
} catch (e) {
    // Skia not available (likely OTA update without native build)
    // Will fall back to BlurView only
    if (__DEV__) console.warn('[LiquidGlass] Skia not available, using BlurView only');
}

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
 * LiquidGlass - A true liquid glass effect component
 * 
 * Combines BlurView (for true background blur) with Skia enhancements
 * to create a complete liquid glass effect with:
 * 
 * 1. **Backdrop Blur** - BlurView handles blurring React Native views behind it
 * 2. **Light Diffusion** - Skia gradients create highlights and light refraction
 * 3. **Depth Layering** - Multiple translucent layers create depth perception
 * 4. **Edge Highlights** - Subtle edge lighting for 3D glass effect
 * 5. **Enhanced Translucency** - Layered transparency for realistic glass
 * 
 * This is the proper liquid glass effect, not just blur!
 */
export const LiquidGlass: React.FC<LiquidGlassProps> = ({
    intensity = 20,
    tint = 'default',
    style,
    children,
}) => {
    const { width, height } = useWindowDimensions();
    
    // Get container dimensions from style
    const containerStyle = StyleSheet.flatten(style);
    const containerWidth = typeof containerStyle?.width === 'number' 
        ? containerStyle.width 
        : width;
    const containerHeight = typeof containerStyle?.height === 'number'
        ? containerStyle.height
        : height;
    
    // Create rounded rect for glass bounds (only if Skia is available)
    const borderRadius = (typeof containerStyle?.borderRadius === 'number' 
        ? containerStyle.borderRadius 
        : 0) || 0;
    
    const rect = useMemo(() => {
        if (!SkiaAvailable || !rrect || !Skia) return null;
        return rrect(
            Skia.XYWHRect(0, 0, containerWidth, containerHeight),
            borderRadius,
            borderRadius
        );
    }, [containerWidth, containerHeight, borderRadius]);
    
    // Determine liquid glass appearance based on tint
    // These create the "liquid" effect with light diffusion and depth
    const glassConfig = useMemo(() => {
        switch (tint) {
            case 'light':
                return {
                    // Top highlight gradient - simulates light refraction through glass
                    highlightStart: 'rgba(255, 255, 255, 0.35)',
                    highlightEnd: 'rgba(255, 255, 255, 0.0)',
                    // Subtle mid-tone for depth
                    midTone: 'rgba(255, 255, 255, 0.08)',
                    // Edge highlight for 3D depth perception
                    edgeHighlight: 'rgba(255, 255, 255, 0.25)',
                };
            case 'dark':
                return {
                    highlightStart: 'rgba(255, 255, 255, 0.12)',
                    highlightEnd: 'rgba(255, 255, 255, 0.0)',
                    midTone: 'rgba(0, 0, 0, 0.05)',
                    edgeHighlight: 'rgba(255, 255, 255, 0.08)',
                };
            default:
                return {
                    highlightStart: 'rgba(255, 255, 255, 0.2)',
                    highlightEnd: 'rgba(255, 255, 255, 0.0)',
                    midTone: 'rgba(255, 255, 255, 0.05)',
                    edgeHighlight: 'rgba(255, 255, 255, 0.15)',
                };
        }
    }, [tint]);
    
    return (
        <View style={[styles.container, style]}>
            {/* BlurView provides true background blur of React Native views */}
            <BlurView 
                intensity={intensity} 
                tint={tint === 'default' ? 'light' : tint}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Skia Canvas adds liquid glass enhancements on top (only if Skia is available) */}
            {SkiaAvailable && Canvas && rect && (
                <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Light diffusion - top highlight gradient (simulates light refraction) */}
                    <Rect rect={rect}>
                        <LinearGradient
                            start={vec(0, 0)}
                            end={vec(0, Math.min(containerHeight * 0.5, 100))}
                            colors={[glassConfig.highlightStart, glassConfig.highlightEnd]}
                        />
                    </Rect>
                    
                    {/* Mid-tone layer for depth */}
                    <Rect
                        rect={rect}
                        color={glassConfig.midTone}
                    />
                    
                    {/* Edge highlight for 3D depth perception (top edge) */}
                    <Rect
                        rect={rrect(
                            Skia.XYWHRect(0, 0, containerWidth, Math.max(1, borderRadius * 0.3)),
                            0,
                            0
                        )}
                        color={glassConfig.edgeHighlight}
                    />
                </Canvas>
            )}
            
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
