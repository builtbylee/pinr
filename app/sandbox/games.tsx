import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Modal, ActivityIndicator, FlatList, BackHandler, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { gameService, GameState, Difficulty } from '../../src/services/GameService';
import { leaderboardService, LeaderboardEntry } from '../../src/services/LeaderboardService';
import { challengeService, GameChallenge } from '../../src/services/ChallengeService';
import { getUserProfile, getFriends } from '../../src/services/userService';
import { getCurrentUser } from '../../src/services/authService';

import { PinDropDifficulty } from '../../src/services/PinDropService';
import { streakService } from '../../src/services/StreakService';
import { useMemoryStore } from '../../src/store/useMemoryStore';

// PHASE 2: Stubbed Imports (Commented out to prevent loading)
/*
const PinDropGame = React.lazy(async () => {
    const module = await import('../../src/components/PinDropGame');
    return { default: module.PinDropGame };
});

const TravelBattleGame = React.lazy(async () => {
    const module = await import('../../src/components/TravelBattleGame');
    return { default: module.TravelBattleGame };
});

const ChallengeFriendModal = React.lazy(async () => {
    const module = await import('../../src/components/ChallengeFriendModal');
    return { default: module.ChallengeFriendModal };
});
*/

export default function GameSandbox() {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isSmallScreen = height < 700;


    // Debug: Log all relevant state at render time
    // Persistence
    const activeGameId = useMemoryStore(state => state.activeGameId);
    const setActiveGameId = useMemoryStore(state => state.setActiveGameId);

    const [state, setState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        streak: 0,
        timeLeft: 30,
        currentQuestion: null,
        gameOver: false,
        highScore: 0,
        isNewHighScore: false,
        lastAnswerCorrect: null,
        lastSelectedOptionId: null, // Track which option was selected
        difficulty: 'medium'
    });

    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [leaderboardTab, setLeaderboardTab] = useState<'flagdash' | 'pindrop' | 'travelbattle' | 'total'>('total');
    const [leaderboardAvatars, setLeaderboardAvatars] = useState<Record<string, { avatarUrl: string | null; pinColor: string | null }>>({});
    const [activeTab, setActiveTab] = useState<'home' | 'leaderboard' | 'newgame'>('home');
    const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);

    // Game Type Selection (Flag Dash, Pin Drop, or Travel Battle)
    const [selectedGameType, setSelectedGameType] = useState<'flagdash' | 'pindrop' | 'travelbattle' | null>(null);
    const [previewGame, setPreviewGame] = useState<'flagdash' | 'pindrop' | 'travelbattle' | null>(null); // For bottom sheet
    const [pinDropDifficulty, setPinDropDifficulty] = useState<PinDropDifficulty>('medium');
    const [errorInfo, setErrorInfo] = useState<string | null>(null);

    // Challenge state
    const [showChallengePicker, setShowChallengePicker] = useState(false);
    const [friends, setFriends] = useState<{ uid: string; username: string; avatarUrl?: string; pinColor?: string }[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [pendingChallenges, setPendingChallenges] = useState<GameChallenge[]>([]);
    const [activeChallenge, setActiveChallenge] = useState<GameChallenge | null>(null);
    const [activeGames, setActiveGames] = useState<GameChallenge[]>([]); // Active/Completed games
    const [opponentData, setOpponentData] = useState<Record<string, { avatarUrl: string | null; pinColor: string | null }>>({}); // Cache opponent avatars and pinColors
    const [dailyStreak, setDailyStreak] = useState<number>(0); // Daily play streak
    // Challenge Results state
    const [challengeResult, setChallengeResult] = useState<{ completed: boolean; won?: boolean } | null>(null);


    const router = useRouter();
    const params = useLocalSearchParams<{ challengeId: string }>();

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;

    // PanResponder and tab swipe animations removed for crash resilience
    const panResponder = { panHandlers: {} };
    const tabTranslateX = useRef(new Animated.Value(0)).current;

    // Deep Link Logic & Persistence Hydration
    useEffect(() => {
        if (params.challengeId) {
            // checkDeepLinkChallenge(params.challengeId);
        } else if (activeGameId && !activeChallenge) {
            console.log('[GameSandbox] Hydrating persisted game:', activeGameId);
            // checkDeepLinkChallenge(activeGameId);
        }
    }, [params.challengeId]); // Run on mount (activeGameId is stable-ish, avoiding loop)

    // Load daily streak on mount
    useEffect(() => {
        const loadStreak = async () => {
            const streak = await streakService.getCurrentStreak();
            setDailyStreak(streak);
        };
        loadStreak();
    }, []);


    // Stubbed checkDeepLinkChallenge
    const checkDeepLinkChallenge = async (id: string) => {
        console.log('checkDeepLinkChallenge stubbed for Phase 2');
    };

    const handleRematch = () => {
        console.log('handleRematch stubbed');
    };

    useEffect(() => {
        // 1. Subscribe to Game State
        gameService.subscribe((newState) => {
            setState(newState);
            if (newState.lastAnswerCorrect !== null) {
                triggerPulseAnimation(newState.lastAnswerCorrect);
            }
        });

        // 2. Subscribe to Active Challenges (Real-time updates)
        let unsubChallenges = () => { };
        const user = getCurrentUser();
        if (user) {
            console.log('[GameSandbox] Subscribing to active games...');
            unsubChallenges = challengeService.subscribeToActiveChallenges(user.uid, async (games) => {
                try {
                    console.log('[GameSandbox] Active games updated:', games.length);
                    setActiveGames(games);

                    // Fetch avatars and pinColors for opponents (batch fetch, cache in state)
                    const dataUpdates: Record<string, { avatarUrl: string | null; pinColor: string | null }> = {};
                    for (const game of games) {
                        const opponentId = game.challengerId === user.uid ? game.opponentId : game.challengerId;
                        if (!opponentData[opponentId]) {
                            try {
                                const profile = await getUserProfile(opponentId);
                                dataUpdates[opponentId] = {
                                    avatarUrl: profile?.avatarUrl || null,
                                    pinColor: profile?.pinColor || null
                                };
                            } catch (e) {
                                dataUpdates[opponentId] = { avatarUrl: null, pinColor: null };
                            }
                        }
                    }
                    if (Object.keys(dataUpdates).length > 0) {
                        setOpponentData(prev => ({ ...prev, ...dataUpdates }));
                    }
                } catch (error: any) {
                    console.error('[GameSandbox] Error in challenge subscription:', error);
                    setErrorInfo('Failed to load games: ' + (error.message || 'Unknown error'));
                }
            });
        }

        return () => {
            gameService.stopGame();
            unsubChallenges();
        };
    }, []);

    // Handle Hardware Back Button
    useEffect(() => {
        const onBackPress = () => {
            if (showQuitConfirmation) {
                cancelQuit();
                return true;
            }
            if (activeTab === 'leaderboard') {
                // Navigate back to Home tab with animation
                Animated.spring(tabTranslateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 10,
                }).start();
                setActiveTab('home');
                return true;
            }
            if (showChallengePicker) {
                setShowChallengePicker(false);
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [showQuitConfirmation, activeTab, showChallengePicker, state.isPlaying]);

    const triggerPulseAnimation = (isCorrect: boolean) => {
        // Color flash
        colorAnim.setValue(isCorrect ? 1 : -1);

        // Pulse animation
        Animated.sequence([
            Animated.timing(pulseAnim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Reset color after animation
        setTimeout(() => {
            colorAnim.setValue(0);
        }, 300);
    };

    const handleStart = () => {
        // setSelectedGameType('flagdash');
        // gameService.startGame(selectedDifficulty, 'flagdash');
        console.log('handleStart stubbed for Phase 2');
    };


    const handleDifficultyChange = (difficulty: Difficulty) => {
        setSelectedDifficulty(difficulty);
        gameService.setDifficulty(difficulty);
    };

    const handleQuit = () => {
        setShowQuitConfirmation(true);
    };

    const confirmQuit = () => {
        setShowQuitConfirmation(false);
        gameService.stopGame();
        setSelectedGameType(null);
    };

    const cancelQuit = () => {
        setShowQuitConfirmation(false);
        gameService.resumeGame();
    };

    const fetchLeaderboard = async (gameType?: 'flagdash' | 'pindrop' | 'travelbattle' | 'total') => {
        setLoadingLeaderboard(true);
        try {
            const tab = gameType || leaderboardTab;
            let data: LeaderboardEntry[];

            if (tab === 'total') {
                data = await leaderboardService.getTotalLeaderboard();
            } else {
                data = await leaderboardService.getFriendsLeaderboard(tab);
            }

            setLeaderboardData(data);

            // Fetch avatars and pinColors for leaderboard entries
            const avatarUpdates: Record<string, { avatarUrl: string | null; pinColor: string | null }> = {};
            for (const entry of data) {
                if (!leaderboardAvatars[entry.odUid]) {
                    try {
                        const profile = await getUserProfile(entry.odUid);
                        avatarUpdates[entry.odUid] = {
                            avatarUrl: profile?.avatarUrl || null,
                            pinColor: profile?.pinColor || null
                        };
                    } catch (e) {
                        avatarUpdates[entry.odUid] = { avatarUrl: null, pinColor: null };
                    }
                }
            }
            if (Object.keys(avatarUpdates).length > 0) {
                setLeaderboardAvatars(prev => ({ ...prev, ...avatarUpdates }));
            }
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    // Stubbed
    const loadFriendsForChallenge = async () => {
        console.log('loadFriendsForChallenge stubbed');
    };

    // Stubbed
    const loadPendingChallenges = async () => {
        console.log('loadPendingChallenges stubbed');
    };


    const sendChallenge = async (friendUid: string, gameType: 'flagdash' | 'pindrop' | 'travelbattle', difficulty: Difficulty) => {
        console.log('sendChallenge stubbed');
    };

    const acceptChallenge = async (challenge: GameChallenge) => {
        console.log('acceptChallenge stubbed');
    };

    // Load pending challenges (Real-time)
    useEffect(() => {
        const user = getCurrentUser();
        if (!user) return;

        const unsubscribe = challengeService.subscribeToPendingChallenges(user.uid, (challenges) => {
            console.log('[GameSandbox] Received pending challenges update:', challenges.length);
            setPendingChallenges(challenges);
        });

        return () => unsubscribe();
    }, []);

    // Auto-refresh Waiting Screen (Immediate Result Logic)
    useEffect(() => {
        // Stubbed
    }, [activeChallenge?.id, state.isPlaying]);


    const renderDifficultySelector = () => (
        <View style={styles.difficultyContainer}>
            <Text style={styles.difficultyLabel}>DIFFICULTY</Text>
            <View style={styles.difficultyButtons}>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
                    <TouchableOpacity
                        key={diff}
                        style={[
                            styles.difficultyButton,
                            selectedDifficulty === diff && styles.difficultyButtonActive
                        ]}
                        onPress={() => handleDifficultyChange(diff)}
                    >
                        <Text style={[
                            styles.difficultyButtonText,
                            selectedDifficulty === diff && styles.difficultyButtonTextActive
                        ]}>
                            {diff.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    // Bottom Navigation Bar (2 tabs: Scores, Home)
    const renderBottomNav = () => (
        <View style={[styles.bottomNav, { paddingBottom: 20 + Math.max(0, insets.bottom - 10) }]}>
            <TouchableOpacity
                style={[styles.navButton, activeTab === 'leaderboard' && styles.navButtonActive]}
                onPress={() => {
                    if (activeTab !== 'leaderboard') {
                        // Animation simplified to basic view transition logic (logic in render)
                        setActiveTab('leaderboard');
                        fetchLeaderboard();
                    }
                }}
            >
                <View style={[styles.navCenterCircle, activeTab === 'leaderboard' && { backgroundColor: '#4169E1' }]}>
                    <Feather name="bar-chart-2" size={24} color="white" />
                </View>
                <Text style={[styles.navLabel, activeTab === 'leaderboard' && styles.navLabelActive]}>Scores</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.navButton, activeTab === 'home' && styles.navButtonActive]}
                onPress={() => {
                    if (activeTab !== 'home') {
                        setActiveTab('home');
                    }
                }}
            >
                <View style={[styles.navCenterCircle, activeTab === 'home' && { backgroundColor: '#4169E1' }]}>
                    <Feather name="home" size={24} color="white" />
                </View>
            </TouchableOpacity>
        </View>
    );


    const renderStartScreen = () => {
        // Categorize Games
        const yourTurn: any[] = [];
        const theirTurn: any[] = [];

        // 1. Pending Invites (Incoming) -> Your Turn
        pendingChallenges.forEach(c => yourTurn.push({ type: 'invite', ...c }));

        // 2. Active Games (Including Completed)
        activeGames.forEach(c => {
            const isChallenger = c.challengerId === getCurrentUser()?.uid;
            const myScore = isChallenger ? c.challengerScore : c.opponentScore;

            if (c.status === 'completed') {
                yourTurn.push({ type: 'result', ...c });
            } else if (myScore === undefined) {
                yourTurn.push({ type: 'play', ...c });
            } else {
                theirTurn.push({ type: 'waiting', ...c });
            }
        });

        // Mock Data for Visualization if Empty (Optional for dev)
        // if (yourTurn.length === 0) yourTurn.push({ id: 'mock1', type: 'play', opponentUsername: 'Sarah' });

        return (
            <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>

                {/* Page Header */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#1F2937' }}>🎮 Games</Text>
                            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>Challenge friends & climb the ranks</Text>
                        </View>
                        {/* Daily Streak Badge */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: dailyStreak > 0 ? '#FEF3C7' : '#F3F4F6',
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            gap: 6,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 2,
                        }}>
                            <Text style={{ fontSize: 18 }}>🔥</Text>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: dailyStreak > 0 ? '#D97706' : '#9CA3AF' }}>
                                {dailyStreak}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* SECTION 1: YOUR TURN */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>⚡ Your Turn</Text>
                    {yourTurn.length > 0 && (
                        <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>{yourTurn.length}</Text>
                        </View>
                    )}
                </View>

                {yourTurn.length === 0 ? (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                        <View style={{
                            backgroundColor: 'white',
                            borderRadius: 16,
                            padding: 20,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 8,
                            elevation: 2,
                        }}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>🎯</Text>
                            <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>No active games</Text>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 4 }}>Start a game below!</Text>
                        </View>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}
                    >
                        {yourTurn.map((item: any) => {
                            // Simplified map logic for safe mode
                            return null;
                        })}
                    </ScrollView>
                )}


                {/* SECTION 2: WAITING */}
                {/* Simplified logic for safe mode - commented out complex map */}


                {/* SECTION 3: NEW GAMES */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>🎲 New Game</Text>
                </View>

                {/* Game Cards (Reduced spacing) */}
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}>

                    {/* PIN DROP (Primary) */}
                    <TouchableOpacity
                        style={[styles.gameCard, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}
                        activeOpacity={0.9}
                        onPress={() => {
                            // setPreviewGame('pindrop');
                            // setPinDropDifficulty('medium'); // Default
                            console.log('Pin Drop pressed (disabled in Phase 2)');
                        }}
                    >
                        <View style={[styles.gameIconContainer, { backgroundColor: '#EF4444' }]}>
                            <Feather name="map-pin" size={28} color="white" />
                        </View>
                        <View style={styles.gameInfo}>
                            <Text style={[styles.gameTitle, { color: '#991B1B' }]}>Pin Drop</Text>
                            <Text style={styles.gameDescription}>Explore the world and drop pins.</Text>
                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                                    <Text style={[styles.badgeText, { color: '#B91C1C' }]}>Single Player</Text>
                                </View>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={24} color="#F87171" />
                    </TouchableOpacity>

                    {/* FLAG DASH */}
                    <TouchableOpacity
                        style={[styles.gameCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                        activeOpacity={0.9}
                        onPress={() => {
                            // setState(prev => ({ ...prev, difficulty: 'medium' })); // Default
                            // handleStart();
                            console.log('Flag Dash pressed (disabled in Phase 2)');
                        }}
                    >
                        <View style={[styles.gameIconContainer, { backgroundColor: '#3B82F6' }]}>
                            <Feather name="flag" size={28} color="white" />
                        </View>
                        <View style={styles.gameInfo}>
                            <Text style={[styles.gameTitle, { color: '#1E40AF' }]}>Flag Dash</Text>
                            <Text style={styles.gameDescription}>Race against time to identify flags.</Text>
                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                                    <Text style={[styles.badgeText, { color: '#1D4ED8' }]}>Fast Paced</Text>
                                </View>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={24} color="#60A5FA" />
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    };

    const renderLeaderboardTab = () => {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Leaderboard Tab (Stubbed)</Text>
            </View>
        )
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="black" />
            </TouchableOpacity>
        </View>
    );

    const renderQuitConfirmationModal = () => {
        // Stubbed
        return null;
    };


    // Main Render
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {renderHeader()}
            <View style={{ flex: 1 }}>

                {/* Simplified Tab Render - No Animations */}
                <View
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        width: width * 2,
                        transform: [{ translateX: activeTab === 'leaderboard' ? -width : 0 }],
                    }}
                >
                    <View style={{ width }}>
                        {renderStartScreen()}
                    </View>
                    <View style={{ width }}>
                        {renderLeaderboardTab()}
                    </View>
                </View>

                {renderBottomNav()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    difficultyContainer: {
        marginTop: 20,
        width: '100%',
    },
    difficultyLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 8,
        letterSpacing: 1,
    },
    difficultyButtons: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
    },
    difficultyButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    difficultyButtonActive: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    difficultyButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    difficultyButtonTextActive: {
        color: '#1F2937',
        fontWeight: '700',
    },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    navButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    navButtonActive: {
        transform: [{ translateY: -4 }],
    },
    navCenterCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    navLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    navLabelActive: {
        color: '#4169E1',
        fontWeight: '700',
    },
    gameCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    gameIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    gameInfo: {
        flex: 1,
    },
    gameTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    gameDescription: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
});
