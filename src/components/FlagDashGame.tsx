import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { gameService, GameState, Difficulty } from '@/src/services/GameService';

interface FlagDashGameProps {
    difficulty: Difficulty;
    onGameOver: (score: number) => void;
    onQuit: () => void;
}

export const FlagDashGame: React.FC<FlagDashGameProps> = ({ difficulty, onGameOver, onQuit }) => {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const insets = useSafeAreaInsets();

    // Local state to track game updates
    const [state, setState] = useState<GameState>(gameService.getState());
    const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Subscribe to game service
        const unsubscribe = gameService.subscribe((newState) => {
            setState(newState);
        });

        // Start the game
        gameService.startGame(difficulty, 'flagdash');

        return () => {
            // Cleanup on unmount
            gameService.stopGame();
            unsubscribe();
        };
    }, []);

    // Monitor Game Over
    useEffect(() => {
        if (state.gameOver) {
            onGameOver(state.score);
        }
    }, [state.gameOver]);

    // Streak Animation
    useEffect(() => {
        if (state.streak > 0) {
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(pulseAnim, {
                    toValue: 1,
                    friction: 4,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [state.streak]);

    const handleAnswer = (code: string) => {
        gameService.submitAnswer(code);
    };

    const handleQuit = () => {
        setShowQuitConfirmation(true);
    };

    const confirmQuit = () => {
        setShowQuitConfirmation(false);
        onQuit();
    };

    const cancelQuit = () => {
        setShowQuitConfirmation(false);
    };

    const getStreakColor = () => {
        if (state.lastAnswerCorrect === true) return '#22C55E';
        if (state.lastAnswerCorrect === false) return '#EF4444';
        return '#F59E0B';
    };

    if (!state.currentQuestion && !state.gameOver) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={{ marginTop: 16, color: '#6B7280', fontWeight: '600' }}>Preparing Flags...</Text>
            </View>
        );
    }

    // If Game Over, return null (parent handles Game Over UI based on onGameOver callback)
    // Or we could render it here. The architecture in games.tsx seems to expect the component to handle the game interaction
    // and the parent (Hub) to handle the Game Over screen? 
    // Actually, looking at PinDrop, it renders its own game over logic or calls back. 
    // In games.tsx backup, renderGameOver was shared. 
    // Let's render null on game over so parent can switch to Score view if needed, 
    // BUT current games.tsx layout expects the game component to stay mounted or unmount?
    // Let's look at games.tsx:
    // {selectedGameType === 'pindrop' && !(state.gameOver && ...) ... }
    // It unmounts PinDrop when game over & challenge result exist.
    // For local play, it likely switches to a Result view.
    // For simplicity: We will render the GAME logic here. If game is over, we return null so the parent can show result?
    // Parent games.tsx has: {selectedGameType === 'flagdash' && state.gameOver && renderGameOver()}
    // So YES, this component should strictly render the GAMEPLAY.

    if (state.gameOver) return null;

    return (
        <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
            {/* Quit Modal */}
            {showQuitConfirmation && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <Text style={styles.modalTitle}>Quit Game?</Text>
                            <Text style={styles.modalSubtitle}>Current progress will be lost.</Text>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={cancelQuit}>
                                <Text style={styles.secondaryButtonText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={confirmQuit}>
                                <Text style={styles.primaryButtonText}>Yes, Quit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Game Container */}
            <View style={styles.gameContainer}>
                {/* HUD */}
                <View style={[styles.hud, { paddingHorizontal: 16, paddingTop: insets.top + 8, alignItems: 'center' }]}>
                    <TouchableOpacity
                        style={styles.quitButtonRed}
                        onPress={handleQuit}
                    >
                        <Feather name="x" size={24} color="white" />
                    </TouchableOpacity>
                    <View style={styles.hudItem}>
                        <Feather name="clock" size={20} color="#666" />
                        <Text style={[styles.hudText, state.timeLeft < 10 && styles.urgentText]}>
                            {state.timeLeft}s
                        </Text>
                    </View>
                    <Animated.View style={[
                        styles.hudItem,
                        { transform: [{ scale: pulseAnim }] }
                    ]}>
                        <Feather name="zap" size={20} color={getStreakColor()} />
                        <Text style={[styles.hudText, { color: getStreakColor() }]}>x{state.streak}</Text>
                    </Animated.View>
                    <View style={styles.hudItem}>
                        <Feather name="award" size={20} color="#4F46E5" />
                        <Text style={styles.hudText}>{state.score}</Text>
                    </View>
                </View>

                {/* Main Card */}
                <View style={styles.cardContainer}>
                    {/* Flag */}
                    {state.currentQuestion?.flagUrl && (
                        <View style={styles.flagWrapper}>
                            <Image
                                source={{ uri: state.currentQuestion.flagUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </View>
                    )}

                    {/* Question Text */}
                    <Text style={styles.questionText}>
                        {state.currentQuestion?.text}
                    </Text>

                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                        <View style={{
                            height: '100%',
                            width: `${(state.timeLeft / 30) * 100}%`,
                            backgroundColor: state.timeLeft < 10 ? '#EF4444' : '#10B981',
                            borderRadius: 3,
                        }} />
                    </View>

                    {/* Options */}
                    <View style={{ gap: isSmallScreen ? 8 : 10 }}>
                        {state.currentQuestion?.options.map((option) => (
                            <FlagDashOptionButton
                                key={option.id}
                                option={option}
                                lastSelectedOptionId={state.lastSelectedOptionId}
                                lastAnswerCorrect={state.lastAnswerCorrect}
                                correctOptionId={state.currentQuestion?.correctOptionId}
                                onPress={handleAnswer}
                                isSmallScreen={isSmallScreen}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
};

// Option Button Component
const FlagDashOptionButton = ({ option, lastSelectedOptionId, lastAnswerCorrect, correctOptionId, onPress, isSmallScreen }: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const isSelected = lastSelectedOptionId === option.id;
    const isCorrectOption = option.id === correctOptionId;
    const showCorrect = lastAnswerCorrect !== null && isCorrectOption && isSelected;
    const showWrong = lastAnswerCorrect !== null && !isCorrectOption && isSelected;

    useEffect(() => {
        if (showCorrect || showWrong) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
                    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: false })
                ]),
                { iterations: 1 }
            ).start(() => {
                fadeAnim.setValue(1);
            });
        }
    }, [showCorrect, showWrong]);

    const backgroundColor = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['white', showCorrect ? '#22C55E' : '#EF4444']
    });

    const finalBgColor = (showCorrect || showWrong) ? backgroundColor : 'white';

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.optionButton, { paddingVertical: isSmallScreen ? 12 : 16 }]}
            onPress={() => onPress(option.id)}
            disabled={lastAnswerCorrect !== null}
        >
            <Animated.View style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: finalBgColor,
                opacity: (showCorrect || showWrong) ? 1 : 0
            }} />
            <Text style={[styles.optionText, (showCorrect || showWrong) && { color: 'white' }]}>
                {option.text}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    gameContainer: {
        width: '100%',
        alignItems: 'center',
    },
    hud: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    hudItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    hudText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    urgentText: {
        color: '#EF4444',
    },
    quitButtonRed: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 28,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    flagWrapper: {
        width: '100%',
        height: 180,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000000',
        overflow: 'hidden',
        marginBottom: 16,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#1F2937',
        marginBottom: 12,
        textAlign: 'center',
        lineHeight: 24,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        marginBottom: 16,
        overflow: 'hidden',
    },
    optionButton: {
        width: '100%',
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
        textAlign: 'center',
        zIndex: 1,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        width: '80%',
        maxWidth: 320,
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1F2937',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButton: {
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
    },
    primaryButton: {},
    secondaryButtonText: {
        color: '#6B7280',
        fontWeight: '600',
        fontSize: 16,
    },
    primaryButtonText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 16,
    },
});
