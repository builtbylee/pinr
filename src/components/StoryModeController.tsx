import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { Memory } from '../store/useMemoryStore';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { DestinationCard } from './DestinationCard';

const { width, height } = Dimensions.get('window');

interface StoryModeControllerProps {
    pins: Memory[];
    cameraRef: React.RefObject<Mapbox.Camera>;
    onExit: () => void;
    userColor?: string;
    onPulsingPinChange?: (pinId: string | null) => void;
}

const FLY_DURATION = 2500;
const READ_DURATION = 4000; // Reduced from 5000
const PULSE_DURATION = 800; // Single pulse before showing card

export const StoryModeController: React.FC<StoryModeControllerProps> = ({
    pins,
    cameraRef,
    onExit,
    userColor = '#FF00FF',
    onPulsingPinChange, // Callback to notify parent of pulsing pin
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showCard, setShowCard] = useState(false);

    // Timer refs to clear on unmount/change
    const flyTimer = useRef<NodeJS.Timeout | null>(null);
    const pulseTimer = useRef<NodeJS.Timeout | null>(null);
    const readTimer = useRef<NodeJS.Timeout | null>(null);

    const currentPin = pins[currentIndex];

    // Main Sequence Logic
    useEffect(() => {
        if (!currentPin || !cameraRef.current) return;
        if (!isPlaying) return; // Don't start sequence while paused

        // Reset state for new pin
        setShowCard(false);

        // Clear previous timers
        if (flyTimer.current) clearTimeout(flyTimer.current);
        if (pulseTimer.current) clearTimeout(pulseTimer.current);
        if (readTimer.current) clearTimeout(readTimer.current);

        console.log('[StoryMode] Starting sequence for:', currentPin.title);

        // 1. Fly to location
        cameraRef.current.setCamera({
            centerCoordinate: currentPin.location,
            zoomLevel: 3, // Reduced from 14 to 3 (globe view)
            pitch: 60,
            animationDuration: FLY_DURATION,
            animationMode: 'flyTo',
        });

        // 2. Wait for arrival, then Start Pulse
        flyTimer.current = setTimeout(() => {
            // Notify parent to start pulsing this pin
            onPulsingPinChange?.(currentPin.id);

            // 3. Wait for pulse animation, then Show Card
            pulseTimer.current = setTimeout(() => {
                // Stop pulsing
                onPulsingPinChange?.(null);
                setShowCard(true);

                // 4. Wait for read time, then Next (only if playing)
                readTimer.current = setTimeout(() => {
                    if (isPlaying) {
                        handleNext();
                    }
                }, READ_DURATION);
            }, PULSE_DURATION);
        }, FLY_DURATION);

        return () => {
            if (flyTimer.current) clearTimeout(flyTimer.current);
            if (pulseTimer.current) clearTimeout(pulseTimer.current);
            if (readTimer.current) clearTimeout(readTimer.current);
            onPulsingPinChange?.(null); // Clean up pulsing state
        };
    }, [currentIndex, currentPin, isPlaying]);

    // Resume/Pause effect - clears timers immediately on pause, resumes on play
    useEffect(() => {
        if (!isPlaying) {
            // Immediately clear ALL timers when paused
            if (flyTimer.current) clearTimeout(flyTimer.current);
            if (pulseTimer.current) clearTimeout(pulseTimer.current);
            if (readTimer.current) clearTimeout(readTimer.current);
            onPulsingPinChange?.(null); // Stop any pulsing
        } else if (showCard) {
            // Resume: if card is showing and we press play, restart read timer
            readTimer.current = setTimeout(() => {
                handleNext();
            }, READ_DURATION);
        }
        // If playing but card not showing yet, trigger re-run of main effect
        // This is handled by adding isPlaying to main effect dependencies
    }, [isPlaying]);


    const handleNext = () => {
        setShowCard(false); // Close card immediately
        if (currentIndex < pins.length - 1) {
            // Small delay to allow card close animation if we had one, 
            // but pure state switch relies on new useEffect trigger
            setCurrentIndex(prev => prev + 1);
        } else {
            console.log('[StoryMode] End of story reached, exiting...');
            setIsPlaying(false);
            // Ensure all state is reset before exiting
            onPulsingPinChange?.(null);
            // Small delay to ensure card is fully closed before unmounting
            setTimeout(() => {
                onExit();
            }, 100);
        }
    };

    const handlePrev = () => {
        setShowCard(false);
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleTogglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    if (!currentPin) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Render Full Destination Card if state is true */}
            {showCard && (
                <Animated.View
                    style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
                    entering={ZoomIn.springify().damping(12)}
                    pointerEvents="box-none"
                >
                    <DestinationCard
                        memory={currentPin}
                        onClose={() => {
                            // Manual close -> pause story? or just next? 
                            // Let's just hide card and pause for user to explore?
                            setShowCard(false);
                            setIsPlaying(false);
                        }}
                        onSelectUser={() => { }} // No-op in story mode
                    />
                </Animated.View>
            )}

            {/* Top Bar - Progress */}
            <Animated.View entering={FadeIn.delay(500)} style={[styles.topBar, { zIndex: 2001 }]} pointerEvents="box-none">
                <View style={styles.progressBar}>
                    {pins.map((_, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.progressDot,
                                idx <= currentIndex ? { backgroundColor: userColor } : { backgroundColor: 'rgba(255,255,255,0.3)' }
                            ]}
                        />
                    ))}
                </View>
                <View style={[styles.exitButtonBlur, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                    <TouchableOpacity onPress={onExit} style={styles.exitButton}>
                        <Feather name="x" size={24} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* Controls */}
            <View style={[styles.controls, { zIndex: 2001 }]} pointerEvents="box-none">
                <View style={[styles.controlBlur, { backgroundColor: 'rgba(255, 255, 255, 0.6)' }]}>
                    <TouchableOpacity onPress={handlePrev} disabled={currentIndex === 0} style={[styles.controlButton, currentIndex === 0 && styles.disabledButton]}>
                        <Feather name="skip-back" size={20} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>

                {/* Primary Action - Black button for solid emphasis */}
                <TouchableOpacity onPress={handleTogglePlay} style={[styles.playButton, { backgroundColor: '#000000' }]}>
                    <Feather name={isPlaying ? "pause" : "play"} size={24} color="white" />
                </TouchableOpacity>

                <View style={[styles.controlBlur, { backgroundColor: 'rgba(255, 255, 255, 0.6)' }]}>
                    <TouchableOpacity onPress={handleNext} disabled={currentIndex === pins.length - 1} style={[styles.controlButton, currentIndex === pins.length - 1 && styles.disabledButton]}>
                        <Feather name="skip-forward" size={20} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        zIndex: 2000,
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingBottom: 12,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    progressBar: {
        flex: 1,
        flexDirection: 'row',
        gap: 4,
        marginRight: 20,
    },
    progressDot: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    exitButtonBlur: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    exitButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 0,
    },
    controlBlur: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    controlButton: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        opacity: 0.3,
    },
    playButton: {
        padding: 20,
        borderRadius: 35,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
});
