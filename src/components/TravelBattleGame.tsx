
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, useWindowDimensions, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { gameService, GameState, Difficulty } from '@/src/services/GameService';
import { getTriviaImage } from '@/src/data/triviaImages';
import * as Haptics from 'expo-haptics';

interface TravelBattleGameProps {
    difficulty: Difficulty;
    gameMode: 'flagdash' | 'travelbattle';
    onQuit: () => void;
    onGameMenu: () => void;
    onExit: () => void;
    onGameOver?: (score: number) => void;
}

export const TravelBattleGame: React.FC<TravelBattleGameProps> = ({ difficulty, gameMode, onQuit, onGameMenu, onExit, onGameOver }) => {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const styles = React.useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);

    const insets = useSafeAreaInsets();
    const [state, setState] = useState<GameState>(gameService.getState());
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);
    const hasTriggeredGameOver = useRef(false);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Subscribe to game state
        const unsubscribe = gameService.subscribe(setState);
        gameService.startGame(difficulty, gameMode);

        // Battery optimization: Pause game timer when app is backgrounded
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Pause timer when backgrounded
                if (gameService.getState().isPlaying) {
                    gameService.pauseTimer?.();
                }
            } else if (nextAppState === 'active') {
                // Resume timer when app becomes active (if game is still playing)
                if (gameService.getState().isPlaying) {
                    gameService.resumeTimer?.();
                }
            }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            gameService.stopGame();
            unsubscribe();
            appStateSubscription.remove();
        };
    }, []);

    // Pulse animation for streak
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

    const getStreakColor = () => {
        if (state.streak >= 5) return '#F59E0B';
        if (state.streak >= 3) return '#10B981';
        return '#6B7280';
    };

    const handleOptionPress = (option: { id: string, text: string }) => {
        if (selectedOptionId || state.gameOver) return;

        setSelectedOptionId(option.id);
        const isCorrect = gameService.submitAnswer(option.id);

        if (isCorrect) {
            // Success
        } else {
            // Error
        }

        // Reset selection after delay
        setTimeout(() => {
            setSelectedOptionId(null);
        }, 200);
    };

    const handleQuit = () => {
        setShowQuitConfirmation(true);
    };

    const confirmQuit = () => {
        setShowQuitConfirmation(false);
        gameService.stopGame();
        onGameMenu(); // Return to game hub, not trigger quit modal again
    };

    const cancelQuit = () => {
        setShowQuitConfirmation(false);
    };

    // Game Over Screen
    if (state.gameOver) {
        if (!hasTriggeredGameOver.current && onGameOver) {
            hasTriggeredGameOver.current = true;
            onGameOver(state.score);
        }
        return (
            <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                {/* Result Icon - Compact */}
                <View style={{
                    width: isSmallScreen ? 60 : 110,
                    height: isSmallScreen ? 60 : 110,
                    borderRadius: isSmallScreen ? 30 : 55,
                    backgroundColor: state.isNewHighScore ? '#F59E0B' : '#EF4444',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: isSmallScreen ? 8 : 28,
                    shadowColor: state.isNewHighScore ? '#F59E0B' : '#EF4444',
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
                        <Feather
                            name={state.isNewHighScore ? 'award' : 'clock'}
                            size={isSmallScreen ? 24 : 36}
                            color="white"
                        />
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
                    {state.isNewHighScore ? 'NEW HIGH SCORE!' : "Time's Up!"}
                </Text>
                <Text style={{
                    fontSize: isSmallScreen ? 13 : 16,
                    color: state.isNewHighScore ? '#D97706' : '#6B7280',
                    marginBottom: isSmallScreen ? 16 : 32,
                }}>
                    {state.isNewHighScore ? 'Amazing performance!' : 'Great effort!'}
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
                    <Text style={{ fontSize: isSmallScreen ? 48 : 56, fontWeight: '800', color: state.isNewHighScore ? '#D97706' : '#1F2937', marginBottom: 4 }}>
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
                            hasTriggeredGameOver.current = false;
                            gameService.startGame(difficulty, gameMode);
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
                            onPress={onGameMenu}
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
                            onPress={onExit}
                        >
                            <View style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: '#F3F4F6',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Feather name="x" size={14} color="#6B7280" />
                            </View>
                            <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Exit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    if (!state.currentQuestion) {
        return (
            <View style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={{ marginTop: 16, color: '#6B7280', fontWeight: '600' }}>Starting Game...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 20) }]}>
            {/* Quit Confirmation Modal */}
            {showQuitConfirmation && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Quit Game?</Text>
                        <Text style={styles.modalSubtitle}>Your progress will be lost.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={cancelQuit}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmQuit}>
                                <Text style={styles.modalConfirmText}>Quit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* HUD - Matching Flag Dash */}
            <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.quitButtonRed} onPress={handleQuit}>
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

            {/* Question Area */}
            <View style={styles.questionContainer}>
                {/* Show flag image for flag questions */}
                {state.currentQuestion.type === 'flag' && state.currentQuestion.flagUrl && (
                    <View style={styles.flagCard}>
                        <Image
                            source={{ uri: state.currentQuestion.flagUrl }}
                            style={styles.flagImage}
                            contentFit="contain"
                            transition={200}
                        />
                    </View>
                )}
                {/* Show trivia illustration for trivia questions with imageKey */}
                {state.currentQuestion.type === 'trivia' && state.currentQuestion.imageKey && getTriviaImage(state.currentQuestion.imageKey) && (
                    <View style={styles.flagCard}>
                        <Image
                            source={getTriviaImage(state.currentQuestion.imageKey)}
                            style={styles.flagImage}
                            contentFit="contain"
                            transition={200}
                        />
                    </View>
                )}
                <Text style={styles.questionText}>{state.currentQuestion.text}</Text>

                {/* Progress Bar - matching Flag Dash */}
                <View style={{
                    height: 6,
                    backgroundColor: '#E5E7EB',
                    borderRadius: 3,
                    marginTop: 12,
                    overflow: 'hidden',
                    width: '100%',
                }}>
                    <View style={{
                        height: '100%',
                        width: `${(state.timeLeft / 30) * 100}%`,
                        backgroundColor: state.timeLeft < 10 ? '#EF4444' : '#10B981',
                        borderRadius: 3,
                    }} />
                </View>
            </View>

            {/* Options Grid - Vertical Stack */}
            <View style={styles.optionsGrid}>
                {state.currentQuestion.options.map((option, index) => (
                    <OptionButton
                        key={option.id}
                        testID={`game-option-${index}`} // 0, 1, 2, 3
                        option={option}
                        selectedOptionId={selectedOptionId}
                        lastAnswerCorrect={state.lastAnswerCorrect}
                        correctOptionId={state.currentQuestion?.correctOptionId}
                        onPress={handleOptionPress}
                    />
                ))}
            </View>
        </View>
    );
};

// Animated Option Button Component
const OptionButton = ({ testID, option, selectedOptionId, lastAnswerCorrect, correctOptionId, onPress }: any) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const isSelected = selectedOptionId === option.id;
    const isCorrectOption = option.id === correctOptionId;

    // Logic Update: Only show feedback if this specific button was selected
    const showCorrect = lastAnswerCorrect !== null && isCorrectOption && isSelected;
    const showWrong = lastAnswerCorrect !== null && !isCorrectOption && isSelected;

    React.useEffect(() => {
        if (showCorrect || showWrong) {
            // Flash Logic: Blink 3 times
            Animated.loop(
                Animated.sequence([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
                    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: false })
                ]),
                { iterations: 1 }
            ).start(() => {
                // End state: Solid color
                fadeAnim.setValue(1);
            });
        }
    }, [showCorrect, showWrong]);

    const backgroundColor = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['white', showCorrect ? '#22C55E' : '#EF4444']
    });

    // If strictly idle (no answer yet), bg is white. 
    // If answered but not this button (and not correct), it stays white.
    // So activeBackgroundColor only applies if showCorrect or showWrong.
    const finalBgColor = (showCorrect || showWrong) ? backgroundColor : 'white';

    return (
        <TouchableOpacity
            testID={testID}
            activeOpacity={0.9}
            style={{
                width: '100%',
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 12,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                // Flat & Clean: No shadows, visible border
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                position: 'relative',
                overflow: 'hidden',
            }}
            onPress={() => onPress(option)}
            disabled={!!selectedOptionId || lastAnswerCorrect !== null}
        >
            {/* Animated Background Overlay */}
            <Animated.View style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: finalBgColor,
                opacity: (showCorrect || showWrong) ? 1 : 0 // Hide if inactive
            }} />

            <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: (showCorrect || showWrong) ? 'white' : '#4B5563',
                textAlign: 'center',
                zIndex: 1, // Ensure text is on top
            }}>
                {option.text}
            </Text>
        </TouchableOpacity>
    );
};

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        paddingTop: 20,
        paddingHorizontal: 20,
        // Padding bottom will be added via inline style with insets
    },
    centerContainer: {
        flex: 1,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    hud: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    quitButtonRed: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
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
    progressContainer: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4F46E5',
        borderRadius: 3,
    },
    questionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
    },
    flagCard: {
        width: '100%',
        height: isSmallScreen ? 150 : 200,
        backgroundColor: '#F3F4F6',
        borderRadius: 24,
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        padding: 4,
        borderWidth: 1,
        borderColor: '#000000',
    },
    flagImage: {
        width: '100%',
        height: '100%',
    },
    questionText: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '400',
        color: '#1F2937',
        textAlign: 'center',
        lineHeight: isSmallScreen ? 20 : 24,
    },
    optionsGrid: {
        flexDirection: 'column',
        gap: 10,
        paddingBottom: 40,
        paddingHorizontal: 8,
    },
    optionButton: {
        width: '100%',
        backgroundColor: 'white',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    optionButtonCorrect: {
        width: '100%',
        backgroundColor: '#34C759',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionButtonWrong: {
        width: '100%',
        backgroundColor: '#FF3B30',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    optionTextWhite: {
        color: 'white',
    },
    // Game Over Styles
    iconCircle: {
        width: isSmallScreen ? 100 : 120,
        height: isSmallScreen ? 100 : 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: isSmallScreen ? 24 : 28,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    scoreResult: {
        fontSize: isSmallScreen ? 48 : 56,
        fontWeight: '800',
        color: '#4F46E5',
    },
    difficultyBadge: {
        fontSize: 14,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 20,
    },
    shareRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
        width: '100%',
        paddingHorizontal: 20,
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
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#4F46E5',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    startButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    gameOverNavRow: {
        flexDirection: 'row',
        gap: 32,
    },
    gameOverNavButton: {
        alignItems: 'center',
        gap: 4,
    },
    gameOverNavText: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Modal Styles
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '80%',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    modalConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#EF4444',
        borderRadius: 12,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
});
