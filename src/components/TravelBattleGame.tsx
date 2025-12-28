
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { gameService, GameState, Difficulty } from '@/src/services/GameService';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const isSmallScreen = height < 700;

interface TravelBattleGameProps {
    difficulty: Difficulty;
    gameMode: 'flagdash' | 'travelbattle';
    onQuit: () => void;
    onGameMenu: () => void;
    onExit: () => void;
    onGameOver?: (score: number) => void;
}

export const TravelBattleGame: React.FC<TravelBattleGameProps> = ({ difficulty, gameMode, onQuit, onGameMenu, onExit, onGameOver }) => {
    const [state, setState] = useState<GameState>(gameService.getState());
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);
    const hasTriggeredGameOver = useRef(false);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Subscribe to game state
        gameService.subscribe(setState);
        gameService.startGame(difficulty, gameMode);

        return () => {
            gameService.stopGame();
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        // Reset selection after delay
        setTimeout(() => {
            setSelectedOptionId(null);
        }, 300);
    };

    const handleQuit = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
            <View style={styles.centerContainer}>
                <View style={[styles.iconCircle, { backgroundColor: state.isNewHighScore ? '#FEF3C7' : '#FEE2E2' }]}>
                    <Feather
                        name={state.isNewHighScore ? "award" : "x-octagon"}
                        size={isSmallScreen ? 48 : 64}
                        color={state.isNewHighScore ? "#F59E0B" : "#EF4444"}
                    />
                </View>
                <Text style={styles.title}>{state.isNewHighScore ? '🏆 NEW HIGH SCORE!' : "Time's Up!"}</Text>

                <Text style={[styles.scoreResult, state.isNewHighScore && { color: '#F59E0B' }]}>
                    {state.score} PTS
                </Text>
                <Text style={styles.difficultyBadge}>{difficulty.toUpperCase()}</Text>

                {/* Play Again Button */}
                <TouchableOpacity style={styles.startButton} onPress={() => {
                    hasTriggeredGameOver.current = false;
                    gameService.startGame(difficulty, gameMode);
                }}>
                    <Text style={styles.startButtonText}>PLAY AGAIN</Text>
                    <Feather name="refresh-cw" size={24} color="white" />
                </TouchableOpacity>

                {/* Navigation Row */}
                <View style={styles.gameOverNavRow}>
                    <TouchableOpacity
                        style={styles.gameOverNavButton}
                        onPress={onGameMenu}
                    >
                        <Feather name="home" size={18} color="#6B7280" />
                        <Text style={styles.gameOverNavText}>Game Menu</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.gameOverNavButton}
                        onPress={onExit}
                    >
                        <Feather name="globe" size={18} color="#6B7280" />
                        <Text style={styles.gameOverNavText}>Exit</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!state.currentQuestion) return null;

    return (
        <View style={styles.container}>
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
            <View style={styles.hud}>
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

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(state.timeLeft / 30) * 100}%` }]} />
            </View>

            {/* Question Area */}
            <View style={styles.questionContainer}>
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
                <Text style={styles.questionText}>{state.currentQuestion.text}</Text>
            </View>

            {/* Options Grid - Vertical Stack */}
            <View style={styles.optionsGrid}>
                {state.currentQuestion.options.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isCorrect = state.lastAnswerCorrect !== null && option.id === state.currentQuestion?.correctOptionId;
                    const isWrong = state.lastAnswerCorrect === false && isSelected;
                    const showCorrect = state.lastAnswerCorrect !== null && option.id === state.currentQuestion?.correctOptionId;

                    let buttonStyle = styles.optionButton;
                    if (showCorrect) buttonStyle = styles.optionButtonCorrect;
                    else if (isWrong) buttonStyle = styles.optionButtonWrong;

                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={buttonStyle}
                            onPress={() => handleOptionPress(option)}
                            disabled={!!selectedOptionId || state.lastAnswerCorrect !== null}
                        >
                            <Text style={[
                                styles.optionText,
                                (showCorrect || isWrong) && styles.optionTextWhite
                            ]}>
                                {option.text}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        paddingTop: 20,
        paddingHorizontal: 20,
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
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: 16,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    flagImage: {
        width: '100%',
        height: '100%',
    },
    questionText: {
        fontSize: isSmallScreen ? 18 : 22,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
        lineHeight: 28,
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
        marginBottom: 32,
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
