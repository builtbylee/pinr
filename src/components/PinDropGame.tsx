/**
 * Pin Drop Game Component
 * 
 * Full-screen Mapbox map where users tap to drop a pin
 * and guess the location of cities/countries.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Animated, BackHandler, Image, ScrollView, useWindowDimensions } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation, MarkerView } from '@rnmapbox/maps';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { pinDropService, PinDropState, PinDropDifficulty, RoundResult } from '../services/PinDropService';

// Globe style matching main app - 3D globe with labels hidden for game difficulty
const GLOBE_STYLE = {
    version: 8,
    name: 'PinDrop-Globe',
    sources: {},
    layers: [],
    imports: [
        {
            id: 'pindrop-globe',
            url: 'mapbox://styles/mapbox/standard',
            config: {
                lightPreset: 'day',
                showPlaceLabels: false,
                showRoadLabels: false,
                showPointOfInterestLabels: false,
            }
        }
    ]
};

interface PinDropGameProps {
    difficulty: PinDropDifficulty;
    challengeSeed?: string;
    onGameOver: (score: number) => void;
    onQuit: () => void;
}

export const PinDropGame: React.FC<PinDropGameProps> = ({
    difficulty,
    challengeSeed,
    onGameOver,
    onQuit,
}) => {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const [state, setState] = useState<PinDropState>(pinDropService.getState());
    const [droppedPin, setDroppedPin] = useState<[number, number] | null>(null);
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [showExplainer, setShowExplainer] = useState(true);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [showTargetPulse, setShowTargetPulse] = useState(false);
    const [pendingResult, setPendingResult] = useState<RoundResult | null>(null);

    const cameraRef = useRef<Camera>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const targetPulseAnim = useRef(new Animated.Value(0)).current;

    // Subscribe to game state
    useEffect(() => {
        const unsubscribe = pinDropService.subscribe(setState);

        // Clean up and reset on unmount
        return () => {
            unsubscribe();
            pinDropService.reset();
        };
    }, []);

    // Start game when explainer is dismissed
    const startGame = () => {
        setShowExplainer(false);
        pinDropService.startGame(difficulty, challengeSeed);
    };

    // Handle game over - DON'T immediately call onGameOver, show internal score screen first
    // The state.gameOver will trigger showing the score screen instead

    // Handle back button on explainer
    useEffect(() => {
        if (!showExplainer) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // Go back from explainer without starting game
            pinDropService.reset();
            onQuit();
            return true;
        });

        return () => backHandler.remove();
    }, [showExplainer]);

    // Handle timeout - when timer expires, show the result
    useEffect(() => {
        if (state.timeoutResult && !roundResult) {
            // Timer expired - show the timeout result
            setRoundResult(state.timeoutResult);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Show actual location on map
            const currentIndex = state.currentRound - 1; // currentRound already incremented
            const location = state.roundLocations[currentIndex];
            if (cameraRef.current && location) {
                cameraRef.current.setCamera({
                    centerCoordinate: [location.lon, location.lat],
                    zoomLevel: 4,
                    animationDuration: 1000,
                });
            }
        }
    }, [state.timeoutResult]);

    // Camera reset to center at start of each round (neutral position)
    useEffect(() => {
        if (state.isPlaying && !roundResult && cameraRef.current) {
            // Reset to show globe centered slightly above equator
            cameraRef.current.setCamera({
                centerCoordinate: [0, 20],
                zoomLevel: 1,
                animationDuration: 300,
            });
        }
    }, [state.currentRound]);

    // Handle map tap
    const handleMapPress = (event: any) => {
        if (!state.isPlaying || roundResult || showTargetPulse) return;

        const { geometry } = event;
        const coords = geometry.coordinates as [number, number];

        setDroppedPin(coords);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Submit guess and store result for later
        const result = pinDropService.submitGuess(coords[1], coords[0]);
        setPendingResult(result);

        // Spin globe to correct location (no zoom change)
        if (cameraRef.current && state.currentLocation) {
            cameraRef.current.setCamera({
                centerCoordinate: [state.currentLocation.lon, state.currentLocation.lat],
                animationDuration: 800,
            });
        }

        // Show target pulse animation after globe spins
        setTimeout(() => {
            setShowTargetPulse(true);

            // Pulse animation
            targetPulseAnim.setValue(0);
            Animated.sequence([
                Animated.timing(targetPulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(targetPulseAnim, { toValue: 0.6, duration: 200, useNativeDriver: true }),
                Animated.timing(targetPulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start(() => {
                // After pulse completes, show result
                setTimeout(() => {
                    setShowTargetPulse(false);
                    setRoundResult(result);
                }, 300);
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 900); // Wait for globe spin to complete
    };

    // Next round
    const handleNextRound = () => {
        setDroppedPin(null);
        setRoundResult(null);
        setPendingResult(null);
        setShowTargetPulse(false);

        // Reset camera to world view
        if (cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [0, 20],
                zoomLevel: 1,
                animationDuration: 500,
            });
        }

        pinDropService.nextRound();
    };

    // Quit handling
    const handleQuitPress = () => {
        pinDropService.pause();
        setShowQuitConfirm(true);
    };

    const handleCancelQuit = () => {
        setShowQuitConfirm(false);
        pinDropService.resume();
    };

    const handleConfirmQuit = () => {
        setShowQuitConfirm(false);
        pinDropService.reset();
        onQuit();
    };

    // Explainer Modal
    if (showExplainer) {
        return (
            <View style={styles.container}>
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        pinDropService.reset();
                        onQuit();
                    }}
                >
                    <View style={styles.explainerOverlay}>
                        <View style={{
                            backgroundColor: 'white',
                            borderRadius: 24,
                            padding: 24, // Reduced from 32
                            width: '90%',
                            maxWidth: 340,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.12,
                            shadowRadius: 20,
                            elevation: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.04)',
                        }}>
                            {/* Icon Circle */}
                            <View style={{
                                width: 64, // Reduced from 80
                                height: 64, // Reduced from 80
                                borderRadius: 32,
                                backgroundColor: '#EFF6FF',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 12, // Reduced from 20
                                borderWidth: 3,
                                borderColor: 'white',
                                shadowColor: '#3B82F6',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 4,
                            }}>
                                <Feather name="map-pin" size={28} color="#3B82F6" />
                            </View>

                            <Text style={{
                                fontSize: 24, // Reduced from 28
                                fontWeight: '800',
                                color: '#1F2937',
                                marginBottom: 2, // Reduced from 4
                                textAlign: 'center',
                            }}>
                                Pin Drop
                            </Text>
                            <Text style={{
                                fontSize: 14, // Reduced from 16
                                color: '#6B7280',
                                fontWeight: '500',
                                marginBottom: 16, // Reduced from 24
                                textAlign: 'center',
                            }}>
                                How to Play
                            </Text>

                            <Text style={{
                                fontSize: 14, // Reduced from 15
                                color: '#4B5563',
                                textAlign: 'center',
                                lineHeight: 20,
                                marginBottom: 16, // Reduced from 24
                            }}>
                                You'll see a location name. Tap on the globe to drop your pin as close as possible to that location!
                            </Text>

                            {/* Scoring Table - Compact & Clean */}
                            <View style={{
                                width: '100%',
                                backgroundColor: '#F9FAFB',
                                borderRadius: 16,
                                padding: 12, // Reduced from 16
                                marginBottom: 16, // Reduced from 24
                                borderWidth: 1,
                                borderColor: '#F3F4F6',
                            }}>
                                <Text style={{
                                    fontSize: 11, // Reduced from 12
                                    fontWeight: '700',
                                    color: '#9CA3AF',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    marginBottom: 8, // Reduced from 12
                                    textAlign: 'center',
                                }}>Scoring</Text>

                                {[
                                    { emoji: '🎯', distance: '< 50 km', points: 1000, color: '#059669' },
                                    { emoji: '🔥', distance: '< 150 km', points: 750, color: '#10B981' },
                                    { emoji: '✨', distance: '< 500 km', points: 500, color: '#34D399' },
                                    { emoji: '👍', distance: '< 1000 km', points: 250, color: '#FBBF24' },
                                    { emoji: '🤔', distance: '< 2000 km', points: 100, color: '#9CA3AF' },
                                ].map((tier, i) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 14, width: 24 }}>{tier.emoji}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' }}>{tier.distance}</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: tier.color }}>{tier.points}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#EFF6FF',
                                paddingHorizontal: 12, // Reduced from 16
                                paddingVertical: 10, // Reduced from 12
                                borderRadius: 12,
                                marginBottom: 16, // Reduced from 24
                                gap: 8,
                                width: '100%',
                            }}>
                                <Feather name="info" size={14} color="#3B82F6" />
                                <Text style={{ flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 16 }}>
                                    <Text style={{ fontWeight: '700' }}>Tip:</Text> Zoom in for extra accuracy and earn more points!
                                </Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#3B82F6',
                                    paddingVertical: 14, // Reduced from 16
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#3B82F6',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 4,
                                    flexDirection: 'row',
                                    gap: 8,
                                }}
                                onPress={startGame}
                            >
                                <Feather name="play" size={18} color="white" />
                                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Start Game</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Show game over screen */}
            {/* Show game over screen - Clean & Flat UI */}
            {state.gameOver && (
                <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#FAFAFA', zIndex: 100, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    {/* Result Icon - Compact */}
                    <View style={{
                        width: isSmallScreen ? 60 : 110,
                        height: isSmallScreen ? 60 : 110,
                        borderRadius: isSmallScreen ? 30 : 55,
                        backgroundColor: '#F59E0B',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: isSmallScreen ? 8 : 28,
                        shadowColor: '#F59E0B',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.4,
                        shadowRadius: 20,
                        elevation: 12,
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.3)',
                    }}>
                        <View style={{
                            width: isSmallScreen ? 40 : 60,
                            height: isSmallScreen ? 40 : 60,
                            borderRadius: isSmallScreen ? 20 : 30,
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Feather name="award" size={isSmallScreen ? 24 : 36} color="white" />
                        </View>
                    </View>

                    {/* Result Title */}
                    <Text style={{
                        fontSize: isSmallScreen ? 24 : 36,
                        fontWeight: '800',
                        color: '#1F2937',
                        marginBottom: isSmallScreen ? 2 : 4,
                        textAlign: 'center',
                    }}>
                        Game Complete!
                    </Text>
                    <Text style={{
                        fontSize: isSmallScreen ? 13 : 16,
                        color: '#D97706',
                        marginBottom: isSmallScreen ? 16 : 32,
                    }}>
                        Great accuracy on those pins!
                    </Text>

                    {/* Points Card with Difficulty Badge */}
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: isSmallScreen ? 20 : 24,
                        padding: isSmallScreen ? 20 : 32,
                        width: '100%',
                        maxWidth: 280,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.12,
                        shadowRadius: 20,
                        elevation: 8,
                        marginBottom: isSmallScreen ? 16 : 28,
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.04)',
                    }}>
                        <Text style={{ fontSize: isSmallScreen ? 48 : 56, fontWeight: '800', color: '#1F2937', marginBottom: 4 }}>
                            {state.score}
                        </Text>
                        <Text style={{ fontSize: isSmallScreen ? 12 : 14, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                            Points
                        </Text>

                        {/* Difficulty Badge */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: difficulty === 'easy' ? '#D1FAE5' : difficulty === 'hard' ? '#FEE2E2' : '#FEF3C7',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 12,
                            gap: 6,
                        }}>
                            <View style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                backgroundColor: difficulty === 'easy' ? '#10B981' : difficulty === 'hard' ? '#EF4444' : '#F59E0B',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Feather name="zap" size={10} color="white" />
                            </View>
                            <Text style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: difficulty === 'easy' ? '#065F46' : difficulty === 'hard' ? '#991B1B' : '#92400E',
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                            }}>
                                {difficulty}
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ width: '100%', gap: isSmallScreen ? 8 : 12 }}>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#10B981',
                                paddingVertical: isSmallScreen ? 10 : 14,
                                borderRadius: 20,
                                gap: 10,
                                shadowColor: '#10B981',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.35,
                                shadowRadius: 12,
                                elevation: 6,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)',
                            }}
                            onPress={() => {
                                pinDropService.reset();
                                setDroppedPin(null);
                                setRoundResult(null);
                                setShowExplainer(true);
                            }}
                        >
                            <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Feather name="refresh-cw" size={16} color="white" />
                            </View>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>PLAY AGAIN</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'white',
                                    paddingVertical: 12,
                                    borderRadius: 16,
                                    gap: 8,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 6,
                                    elevation: 2,
                                    borderWidth: 1,
                                    borderColor: 'rgba(0,0,0,0.05)',
                                }}
                                onPress={() => {
                                    onGameOver(state.score);
                                }}
                            >
                                <View style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: '#F3F4F6',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                    <Feather name="home" size={14} color="#6B7280" />
                                </View>
                                <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Menu</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Map - 3D globe with labels hidden */}
            <MapView
                style={styles.map}
                projection="globe"
                styleJSON={JSON.stringify(GLOBE_STYLE)}
                onPress={handleMapPress}
                logoEnabled={false}
                attributionEnabled={false}
                scaleBarEnabled={false}
            >
                <Camera
                    ref={cameraRef}
                    defaultSettings={{
                        centerCoordinate: [0, 20],
                        zoomLevel: 1,
                    }}
                />

                {/* User's dropped pin */}
                {droppedPin && (
                    <PointAnnotation
                        id="user-pin"
                        coordinate={droppedPin}
                    >
                        <View style={styles.userPin}>
                            <View style={styles.pinMarker}>
                                <View style={styles.pinHead} />
                                <View style={styles.pinPoint} />
                            </View>
                        </View>
                    </PointAnnotation>
                )}

                {/* Actual location pin (shown after guess) */}
                {roundResult && state.lastGuess && (
                    <PointAnnotation
                        id="actual-pin"
                        coordinate={[
                            state.roundLocations[state.currentRound - 1]?.lon || 0,
                            state.roundLocations[state.currentRound - 1]?.lat || 0,
                        ]}
                    >
                        <View style={styles.actualPin}>
                            <View style={styles.correctPinMarker}>
                                <View style={styles.correctPinHead} />
                                <View style={styles.correctPinPoint} />
                            </View>
                        </View>
                    </PointAnnotation>
                )}
            </MapView>

            {/* Pulsing target on correct location during reveal */}
            {showTargetPulse && state.roundLocations[state.currentRound - 1] && (
                <View style={styles.crosshairContainer} pointerEvents="none">
                    <Animated.View style={[
                        styles.pulsingTarget,
                        {
                            opacity: targetPulseAnim,
                            transform: [{
                                scale: targetPulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.5, 1.2],
                                }),
                            }],
                        },
                    ]}>
                        <View style={styles.targetOuter} />
                        <View style={styles.targetInner} />
                        <View style={styles.targetCenter} />
                    </Animated.View>
                </View>
            )}

            {/* Golden pin target overlay - shows where pin will drop */}
            {state.isPlaying && !roundResult && !showTargetPulse && !droppedPin && (
                <View style={styles.crosshairContainer} pointerEvents="none">
                    <View style={styles.goldenPinMarker}>
                        <View style={styles.goldenPinBody}>
                            <View style={styles.goldenPinCircle}>
                                <Text style={styles.goldenPinStar}>★</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.crosshairHint}>Tap to drop pin here</Text>
                </View>
            )}

            {/* HUD Overlay */}
            <View style={styles.hud}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={handleQuitPress}>
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>

                {/* Center Info */}
                <View style={styles.hudCenter}>
                    <Text style={styles.hudTitle}>Round {state.currentRound + 1}/{state.totalRounds}</Text>
                    {state.score > 0 && <Text style={styles.hudSubtitle}>{state.score} pts</Text>}
                </View>

                {/* Timer */}
                <View style={styles.timerPill}>
                    <Feather name="clock" size={14} color={state.timeLeft <= 5 ? '#EF4444' : 'rgba(255,255,255,0.7)'} />
                    <Text style={[styles.timerText, state.timeLeft <= 5 && { color: '#EF4444' }]}>
                        {state.timeLeft}s
                    </Text>
                </View>
            </View>

            {/* Location Prompt */}
            {state.currentLocation && !roundResult && (
                <View style={styles.promptContainer}>
                    <Text style={styles.promptLabel}>Find this location:</Text>
                    <Text style={styles.promptText}>{state.currentLocation.displayName}</Text>
                    <Text style={styles.promptHint}>Tap anywhere on the map</Text>
                </View>
            )}

            {/* Round Result Overlay */}
            {roundResult && (
                <View style={styles.resultOverlay}>
                    <Animated.View style={[styles.resultCard, { transform: [{ scale: pulseAnim }] }]}>
                        <Text style={styles.resultEmoji}>{roundResult.emoji}</Text>
                        <Text style={styles.resultFeedback}>{roundResult.feedback}</Text>
                        <Text style={styles.resultDistance}>
                            {roundResult.distance.toLocaleString()} km away
                        </Text>
                        <View style={styles.resultPoints}>
                            <Text style={styles.resultPointsBase}>+{roundResult.points}</Text>
                            {roundResult.timeBonus > 0 && (
                                <Text style={styles.resultPointsBonus}>+{roundResult.timeBonus} time bonus</Text>
                            )}
                        </View>
                        <Text style={styles.resultTotal}>
                            Total: {roundResult.totalPoints} pts
                        </Text>

                        <TouchableOpacity
                            style={styles.nextButton}
                            onPress={handleNextRound}
                        >
                            <Text style={styles.nextButtonText}>
                                {state.currentRound >= state.totalRounds ? 'See Results' : 'Next Location'}
                            </Text>
                            <Feather name="arrow-right" size={18} color="white" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            {/* Quit Confirmation Modal */}
            <Modal
                visible={showQuitConfirm}
                transparent
                animationType="fade"
                onRequestClose={handleCancelQuit}
            >
                <View style={styles.quitOverlay}>
                    <View style={styles.quitCard}>
                        <Text style={styles.quitTitle}>Quit Game?</Text>
                        <Text style={styles.quitText}>
                            Your progress will be lost.
                        </Text>
                        <View style={styles.quitButtons}>
                            <TouchableOpacity
                                style={styles.quitCancelButton}
                                onPress={handleCancelQuit}
                            >
                                <Text style={styles.quitCancelText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.quitConfirmButton}
                                onPress={handleConfirmQuit}
                            >
                                <Text style={styles.quitConfirmText}>Yes, Quit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    hud: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(23, 23, 23, 0.85)',
        borderRadius: 28,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    hudCenter: {
        alignItems: 'center',
    },
    hudTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: 'white',
        letterSpacing: 0.5,
    },
    hudSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FBBF24', // Amber 400
        marginTop: 2,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    timerText: {
        fontSize: 14,
        fontWeight: '700',
        color: 'white',
        fontVariant: ['tabular-nums'],
    },
    promptContainer: {
        position: 'absolute',
        bottom: 34,
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 24,
        paddingVertical: 20,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    promptLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    promptText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'center',
    },
    promptHint: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 8,
    },
    userPin: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    actualPin: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    resultCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    resultEmoji: {
        fontSize: 64,
        marginBottom: 8,
    },
    resultFeedback: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    resultDistance: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 16,
    },
    resultPoints: {
        alignItems: 'center',
        marginBottom: 8,
    },
    resultPointsBase: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#10B981',
    },
    resultPointsBonus: {
        fontSize: 14,
        color: '#3B82F6',
        marginTop: 4,
    },
    resultTotal: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 24,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    // Explainer styles
    explainerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    explainerCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        maxWidth: 360,
    },
    explainerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    explainerSubtitle: {
        fontSize: 18,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    explainerSection: {
        marginBottom: 20,
    },
    explainerText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
        textAlign: 'center',
    },
    scoringTable: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    scoringTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 12,
        textAlign: 'center',
    },
    scoringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    scoringEmoji: {
        fontSize: 18,
        width: 30,
    },
    scoringDistance: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    scoringPoints: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    tipBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 8,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
    },
    startButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    startButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    // Quit confirmation styles
    quitOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    quitCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 300,
        alignItems: 'center',
    },
    quitTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    quitText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    quitButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    quitCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    quitCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    quitConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    quitConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    // Crosshair styles
    crosshairContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Golden pin marker (teardrop with star) - matches reference image
    goldenPinMarker: {
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    goldenPinBody: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderBottomRightRadius: 0,
        backgroundColor: '#F4B942',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '45deg' }],
    },
    goldenPinCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '-45deg' }],
    },
    goldenPinStar: {
        fontSize: 20,
        color: '#F4B942',
        marginTop: -1,
    },
    // Pulsing target for revealing correct location
    pulsingTarget: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    targetOuter: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#22C55E',
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    targetInner: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#22C55E',
        backgroundColor: 'rgba(34, 197, 94, 0.25)',
    },
    targetCenter: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#22C55E',
    },
    crosshairHint: {
        marginTop: 12,
        fontSize: 12,
        color: '#B45309',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        fontWeight: '600',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    // Custom pin markers
    pinMarker: {
        alignItems: 'center',
    },
    pinHead: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    pinPoint: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#EF4444',
        marginTop: -2,
    },
    correctPinMarker: {
        alignItems: 'center',
    },
    correctPinHead: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#22C55E',
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    correctPinPoint: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#22C55E',
        marginTop: -2,
    },
    // Game Over Screen styles
    gameOverOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        padding: 24,
    },
    gameOverCard: {
        backgroundColor: 'white',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    gameOverEmoji: {
        fontSize: 64,
        marginBottom: 8,
    },
    gameOverTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    gameOverScore: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#10B981',
    },
    gameOverScoreLabel: {
        fontSize: 16,
        color: '#6B7280',
        letterSpacing: 2,
        marginBottom: 8,
    },
    gameOverDifficulty: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 16,
    },
    shareRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
        width: '100%',
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#4F46E5',
        paddingVertical: 14,
        borderRadius: 14,
    },
    challengeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        paddingVertical: 14,
        borderRadius: 14,
    },
    shareButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    playAgainButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 14,
        gap: 10,
        width: '100%',
        marginBottom: 12,
    },
    playAgainText: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 10,
        width: '100%',
    },
    exitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
});
