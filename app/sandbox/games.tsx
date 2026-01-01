import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Animated, Modal, ActivityIndicator, FlatList, BackHandler, PanResponder, useWindowDimensions } from 'react-native';
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

// Lazy load games to isolate crashes (e.g. Mapbox native issues)
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

import { useMemoryStore } from '../../src/store/useMemoryStore';



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

    const router = useRouter();
    const params = useLocalSearchParams<{ challengeId: string }>();

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;

    // Tab swipe animation
    const tabTranslateX = useRef(new Animated.Value(0)).current;

    const panResponder = useMemo(() =>
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to horizontal swipes > 10px
                return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;
            },
            onPanResponderMove: (_, gestureState) => {
                // Constrain movement based on current tab
                if (activeTab === 'home') {
                    // On home tab, only allow left swipe (negative dx)
                    tabTranslateX.setValue(Math.min(0, gestureState.dx));
                } else {
                    // On leaderboard tab, only allow right swipe (positive dx) from -width
                    tabTranslateX.setValue(Math.max(-width, -width + gestureState.dx));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const swipeThreshold = width * 0.25;

                if (activeTab === 'home' && gestureState.dx < -swipeThreshold) {
                    // Swipe left to Scores
                    Animated.spring(tabTranslateX, {
                        toValue: -width,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 10,
                    }).start();
                    setActiveTab('leaderboard');
                } else if (activeTab === 'leaderboard' && gestureState.dx > swipeThreshold) {
                    // Swipe right to Home
                    Animated.spring(tabTranslateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 10,
                    }).start();
                    setActiveTab('home');
                } else {
                    // Reset to current tab
                    Animated.spring(tabTranslateX, {
                        toValue: activeTab === 'home' ? 0 : -width,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 10,
                    }).start();
                }
            },
        }),
        [activeTab, width]);

    // Deep Link Logic & Persistence Hydration
    useEffect(() => {
        if (params.challengeId) {
            checkDeepLinkChallenge(params.challengeId);
        } else if (activeGameId && !activeChallenge) {
            console.log('[GameSandbox] Hydrating persisted game:', activeGameId);
            checkDeepLinkChallenge(activeGameId);
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


    const checkDeepLinkChallenge = async (id: string) => {
        const challenge = await challengeService.getChallenge(id);
        if (challenge) {
            // Set the game type so the correct game component renders the result
            const gameType = challenge.gameType || 'flagdash';
            setSelectedGameType(gameType);
            setSelectedDifficulty(challenge.difficulty);

            if (challenge.status === 'completed') {
                setActiveChallenge(challenge);
                setActiveGameId(challenge.id); // Persist
                setChallengeResult({
                    completed: true,
                    won: challenge.winnerId === getCurrentUser()?.uid
                });
                // Mock game over state to show result
                setState(prev => ({
                    ...prev,
                    gameOver: true,
                    isPlaying: false,
                    score: challenge.challengerId === getCurrentUser()?.uid ? challenge.challengerScore || 0 : challenge.opponentScore || 0
                }));
            } else if (challenge.status === 'accepted') {
                const myId = getCurrentUser()?.uid;
                const isChallenger = challenge.challengerId === myId;
                const myScore = isChallenger ? challenge.challengerScore : challenge.opponentScore;

                if (myScore === undefined) {
                    acceptChallenge(challenge);
                } else {
                    // Waiting for opponent
                    setActiveChallenge(challenge);
                    setActiveGameId(challenge.id); // Persist
                    setChallengeResult({ completed: false });
                    setState(prev => ({ ...prev, gameOver: true, isPlaying: false, score: myScore }));
                }
            } else if (challenge.status === 'pending') {
                // If I am opponent, accept it? Or just show it?
                // Let's just create a quick "accept" flow if I am opponent
                if (challenge.opponentId === getCurrentUser()?.uid) {
                    acceptChallenge(challenge);
                }
            }
        }
    };

    const handleRematch = () => {
        if (!activeChallenge) return;
        const opponentId = activeChallenge.challengerId === getCurrentUser()?.uid
            ? activeChallenge.opponentId
            : activeChallenge.challengerId;

        // Store current game type before resetting
        const currentGameType = selectedGameType || 'flagdash';
        const currentDifficulty = selectedDifficulty;

        setActiveChallenge(null);
        setChallengeResult(null);
        setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));

        setTimeout(() => sendChallenge(opponentId, currentGameType, currentDifficulty), 100);
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
            if (selectedGameType === 'flagdash' || selectedGameType === 'pindrop') {
                // Game handles its own back press or we handle it here by clearing type
                if (showQuitConfirmation) {
                    cancelQuit();
                } else {
                    handleQuit();
                }
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
        setSelectedGameType('flagdash');
        gameService.startGame(selectedDifficulty, 'flagdash');
    };

    const handleAnswer = (code: string) => {
        gameService.submitAnswer(code);
    };

    const handleDifficultyChange = (difficulty: Difficulty) => {
        setSelectedDifficulty(difficulty);
        gameService.setDifficulty(difficulty);
    };

    const handleQuit = () => {
        // Don't stop the game here - just show the confirmation modal
        // stopGame() was causing the game to unmount before the modal could show
        setShowQuitConfirmation(true);
    };

    const confirmQuit = () => {
        setShowQuitConfirmation(false);
        gameService.stopGame(); // Now stop the game after confirmation
        // Reset state
        setSelectedGameType(null);

        // Clear any active challenge (user is abandoning it)
        if (activeChallenge) {
            setActiveChallenge(null);
            setChallengeResult(null);
            setActiveGameId(null);
        }
    };

    const cancelQuit = () => {
        setShowQuitConfirmation(false);
        // Resume game is handled by component prop if needed, or service
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

    const loadFriendsForChallenge = async () => {
        setLoadingFriends(true);
        setShowChallengePicker(true);
        try {
            const user = getCurrentUser();
            if (!user) return;

            // SECURE: Use getFriends() instead of profile.friends
            const friendIds = await getFriends(user.uid);

            if (friendIds.length === 0) {
                setFriends([]);
                return;
            }

            const friendList: { uid: string; username: string; avatarUrl?: string; pinColor?: string }[] = [];
            for (const friendUid of friendIds) {
                const friendProfile = await getUserProfile(friendUid);
                if (friendProfile) {
                    friendList.push({
                        uid: friendUid,
                        username: friendProfile.username,
                        avatarUrl: friendProfile.avatarUrl,
                        pinColor: friendProfile.pinColor,
                    });
                }
            }
            setFriends(friendList);
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            setLoadingFriends(false);
        }
    };

    const loadPendingChallenges = async () => {
        try {
            const challenges = await challengeService.getPendingChallenges();
            setPendingChallenges(challenges);
        } catch (error: any) {
            console.error('Failed to load pending challenges:', error);
            setErrorInfo('Pending challenges error: ' + error.message);
        }
    };


    const sendChallenge = async (friendUid: string, gameType: 'flagdash' | 'pindrop' | 'travelbattle', difficulty: Difficulty) => {
        setShowChallengePicker(false);
        try {
            const challenge = await challengeService.createChallenge(friendUid, difficulty, gameType);
            if (challenge) {
                // Start the game immediately for the challenger
                setActiveChallenge(challenge);
                setActiveGameId(challenge.id); // Persist
                await challengeService.startChallengeAttempt(challenge.id); // Anti-Cheat Start

                // Use the selected game type from the modal
                setSelectedDifficulty(difficulty);
                setSelectedGameType(gameType);

                // Actually start the game - this was missing!
                if (gameType === 'flagdash' || gameType === 'travelbattle') {
                    gameService.startGame(difficulty, gameType);
                }
                // Note: PinDrop has its own service and starts automatically via props
            }
        } catch (error) {
            console.error('Failed to send challenge:', error);
        }
    };

    const acceptChallenge = async (challenge: GameChallenge) => {
        try {
            await challengeService.acceptChallenge(challenge.id);
            setActiveChallenge(challenge);
            setActiveGameId(challenge.id); // Persist
            await challengeService.startChallengeAttempt(challenge.id); // Anti-Cheat Start
            setSelectedDifficulty(challenge.difficulty);

            // Start Game with the correct game type from the challenge
            const gameType = challenge.gameType || 'flagdash';
            setSelectedGameType(gameType);

            // Only start gameService for flag dash and travel battle
            // PinDrop has its own service and starts via component props
            if (gameType === 'flagdash' || gameType === 'travelbattle') {
                gameService.startGame(challenge.difficulty, gameType);
            }

            // Refresh pending list
            loadPendingChallenges();
        } catch (error) {
            console.error('Failed to accept challenge:', error);
        }
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
        if (activeChallenge && !state.isPlaying && challengeResult && !challengeResult.completed) {
            console.log('[GameSandbox] Watching active challenge for completion:', activeChallenge.id);
            const unsub = firestore().collection('game_challenges').doc(activeChallenge.id)
                .onSnapshot(doc => {
                    const data = doc.data() as GameChallenge;
                    if (data && data.status === 'completed') {
                        setActiveChallenge({ ...data, id: doc.id });
                        setChallengeResult({
                            completed: true,
                            won: data.winnerId === getCurrentUser()?.uid
                        });
                        const myScore = data.challengerId === getCurrentUser()?.uid ? data.challengerScore : data.opponentScore;
                        setState(prev => ({ ...prev, score: myScore || 0 }));
                    }
                });
            return () => unsub();
        }
    }, [activeChallenge?.id, state.isPlaying]);

    // Get streak icon color based on animation state
    const getStreakColor = () => {
        if (state.lastAnswerCorrect === true) return '#22C55E'; // Green
        if (state.lastAnswerCorrect === false) return '#EF4444'; // Red
        return '#F59E0B'; // Default amber
    };

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
                        Animated.spring(tabTranslateX, {
                            toValue: -width,
                            useNativeDriver: true,
                            tension: 50,
                            friction: 10,
                        }).start();
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
                        Animated.spring(tabTranslateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 50,
                            friction: 10,
                        }).start();
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
                            const isInvite = item.type === 'invite';
                            const isResult = item.type === 'result';
                            const opponentId = item.challengerId === getCurrentUser()?.uid ? item.opponentId : item.challengerId;
                            const opponentName = item.challengerId === getCurrentUser()?.uid ? item.opponentUsername : item.challengerUsername;
                            const opponentAvatar = opponentData[opponentId]?.avatarUrl;
                            const opponentPinColor = opponentData[opponentId]?.pinColor || '#E5E7EB';

                            // Card styling based on type
                            const cardBgColor = isInvite ? '#FEF3C7' : 'white';
                            const actionColor = isInvite ? '#F59E0B' : isResult ? '#10B981' : '#3B82F6';
                            const actionText = isInvite ? 'ACCEPT' : isResult ? 'VIEW' : 'PLAY';
                            const statusText = isInvite ? '🎫 New Invite!' : isResult ? '🏁 Game Over' : '🎮 Ready';

                            return (
                                <TouchableOpacity
                                    key={item.id || Math.random()}
                                    style={{
                                        backgroundColor: cardBgColor,
                                        borderRadius: 12, // Slightly smaller radius
                                        padding: 12, // Reduced padding (was 18)
                                        width: 130, // Reduced width (was 160)
                                        alignItems: 'center',
                                        shadowColor: isInvite ? '#F59E0B' : '#000',
                                        shadowOffset: { width: 0, height: 4 }, // Smaller shadow
                                        shadowOpacity: isInvite ? 0.25 : 0.08,
                                        shadowRadius: 8,
                                        elevation: 4,
                                        borderWidth: 1,
                                        borderColor: isInvite ? 'rgba(245,158,11,0.3)' : 'rgba(0,0,0,0.05)',
                                    }}
                                    onPress={() => {
                                        if (isInvite) acceptChallenge(item);
                                        else checkDeepLinkChallenge(item.id);
                                    }}
                                >
                                    {/* Avatar with pinColor ring */}
                                    <View style={{
                                        width: 48, // Reduced (was 68)
                                        height: 48,
                                        borderRadius: 24,
                                        borderWidth: 2, // Thinner border
                                        borderColor: opponentPinColor,
                                        backgroundColor: '#F9FAFB',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        overflow: 'hidden',
                                        marginBottom: 8, // Reduced margin
                                    }}>
                                        {opponentAvatar ? (
                                            <Image source={{ uri: opponentAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                        ) : (
                                            <Feather name="user" size={24} color="#9CA3AF" />
                                        )}
                                    </View>

                                    {/* Opponent Name */}
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 2 }} numberOfLines={1}>
                                        {opponentName || 'Unknown'}
                                    </Text>

                                    {/* Status */}
                                    <Text style={{ fontSize: 10, color: '#6B7280', marginBottom: 8 }} numberOfLines={1}>{statusText}</Text>

                                    {/* Game Type Badge - Frosted Circle (Small) */}
                                    <View style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        backgroundColor: item.gameType === 'pindrop' ? '#EF4444' : item.gameType === 'travelbattle' ? '#F59E0B' : '#3B82F6',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        shadowColor: '#000',
                                        shadowOpacity: 0.1,
                                        shadowRadius: 2,
                                        elevation: 1,
                                    }}>
                                        <Feather
                                            name={item.gameType === 'pindrop' ? 'map-pin' : item.gameType === 'travelbattle' ? 'globe' : 'flag'}
                                            size={12}
                                            color="white"
                                        />
                                    </View>

                                    {/* Action Button */}
                                    {/* Removed 'Game Type Badge' from flow to save space, moved to top-right corner */}

                                    <View style={{
                                        backgroundColor: actionColor,
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        width: '100%',
                                        alignItems: 'center',
                                        marginTop: 'auto'
                                    }}>
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{actionText}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}


                {/* SECTION 2: WAITING */}
                {theirTurn.length > 0 && (
                    <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>⏳ Waiting</Text>
                        </View>
                        <View style={{
                            backgroundColor: 'white',
                            borderRadius: 16,
                            marginHorizontal: 20,
                            marginBottom: 16,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 8,
                            elevation: 2,
                        }}>
                            {theirTurn.map((item: any, index: number) => {
                                const opponentId = item.challengerId === getCurrentUser()?.uid ? item.opponentId : item.challengerId;
                                const opponentName = item.challengerId === getCurrentUser()?.uid ? item.opponentUsername : item.challengerUsername;
                                const opponentAvatar = opponentData[opponentId]?.avatarUrl;
                                const opponentPinColor = opponentData[opponentId]?.pinColor || '#E5E7EB';
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 14,
                                            borderBottomWidth: index < theirTurn.length - 1 ? 1 : 0,
                                            borderBottomColor: '#F3F4F6',
                                        }}
                                        onPress={() => checkDeepLinkChallenge(item.id)}
                                    >
                                        {/* Avatar with pinColor ring */}
                                        <View style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            borderWidth: 2,
                                            borderColor: opponentPinColor,
                                            backgroundColor: '#F9FAFB',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                            marginRight: 12,
                                        }}>
                                            {opponentAvatar ? (
                                                <Image source={{ uri: opponentAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                            ) : (
                                                <Feather name="user" size={20} color="#9CA3AF" />
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>vs {opponentName}</Text>
                                            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Waiting for opponent...</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color="#9CA3AF" />
                                            <Feather name="chevron-right" size={18} color="#D1D5DB" />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}


                {/* SECTION 3: PLAY A GAME */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
                    <Feather name="play-circle" size={16} color="#6B7280" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Play a Game</Text>
                </View>

                {/* Game Cards Row - Premium Tiles */}
                <View style={{ flexDirection: 'row', marginHorizontal: 20, gap: 8, marginBottom: 20 }}>
                    {/* Flag Dash Card - Blue */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#3B82F6',
                            borderRadius: 12,
                            padding: isSmallScreen ? 8 : 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#3B82F6',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.2)',
                        }}
                        onPress={() => setPreviewGame('flagdash')}
                    >
                        {/* Icon Circle */}
                        <View style={{
                            width: isSmallScreen ? 36 : 42,
                            height: isSmallScreen ? 36 : 42,
                            borderRadius: isSmallScreen ? 18 : 21,
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <Feather name="flag" size={isSmallScreen ? 18 : 22} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: isSmallScreen ? 10 : 11, fontWeight: '700', textAlign: 'center' }}>Flag Dash</Text>
                    </TouchableOpacity>

                    {/* Pin Drop Card - Red */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#EF4444',
                            borderRadius: 12,
                            padding: isSmallScreen ? 8 : 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#EF4444',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.2)',
                        }}
                        onPress={() => setPreviewGame('pindrop')}
                    >
                        {/* Icon Circle */}
                        <View style={{
                            width: isSmallScreen ? 36 : 42,
                            height: isSmallScreen ? 36 : 42,
                            borderRadius: isSmallScreen ? 18 : 21,
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <Feather name="map-pin" size={isSmallScreen ? 18 : 22} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: isSmallScreen ? 10 : 11, fontWeight: '700', textAlign: 'center' }}>Pin Drop</Text>
                    </TouchableOpacity>

                    {/* Travel Battle Card - Amber */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#F59E0B',
                            borderRadius: 12,
                            padding: isSmallScreen ? 8 : 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#F59E0B',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.2)',
                        }}
                        onPress={() => setPreviewGame('travelbattle')}
                    >
                        {/* Icon Circle */}
                        <View style={{
                            width: isSmallScreen ? 36 : 42,
                            height: isSmallScreen ? 36 : 42,
                            borderRadius: isSmallScreen ? 18 : 21,
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <Feather name="globe" size={isSmallScreen ? 18 : 22} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: isSmallScreen ? 10 : 11, fontWeight: '700', textAlign: 'center' }}>Travel Battle</Text>
                    </TouchableOpacity>
                </View>

                {/* Friend Challenge Button - Premium */}
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 40,
                        backgroundColor: '#10B981',
                        paddingVertical: 10,
                        paddingHorizontal: 32,
                        borderRadius: 12,
                        marginHorizontal: 20,
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)',
                    }}
                    onPress={loadFriendsForChallenge}
                >
                    <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <Feather name="users" size={18} color="white" />
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Challenge a Friend</Text>
                </TouchableOpacity>

            </View >
        );
    };

    // Challenge Result Logic
    const [challengeResult, setChallengeResult] = useState<{ completed: boolean; won?: boolean } | null>(null);
    const [submittingScore, setSubmittingScore] = useState(false);

    // Monitor Game Over to submit score
    useEffect(() => {
        if (state.gameOver && !submittingScore) {
            handleGameOver();
        }
    }, [state.gameOver]);

    const handleGameOver = async () => {
        setSubmittingScore(true);
        const finalScore = state.score;

        // Note: Regular game scores are submitted via GameService.submitScoreToServer()
        // which calls the submitGameScore Cloud Function.
        // Here we only handle challenge score submission.

        // If Challenge, submit to service
        if (activeChallenge) {
            try {
                // Challenge submitScore now requires answers and gameTimeMs
                // For sandbox testing, we pass minimal data
                const result = await challengeService.submitScore(
                    activeChallenge.id,
                    finalScore,
                    [], // answers - empty for sandbox testing
                    30000 // gameTimeMs - simulate 30 seconds
                );
                setChallengeResult(result);
            } catch (e) {
                console.error('Challenge submit failed:', e);
            }
        }

        // Record daily game streak
        const streakResult = await streakService.recordGamePlayed();
        setDailyStreak(streakResult.streak);

        setSubmittingScore(false);
    };

    const renderChallengeResult = () => {
        if (!activeChallenge || !challengeResult) return null;

        // Custom Error Handling (e.g. Anti-Cheat)
        if ((challengeResult as any).error) {
            return (
                <View style={[styles.resultContainer, styles.resultLost]}>
                    <Text style={styles.resultTitle}>⚠️ Submission Failed</Text>
                    <Text style={styles.resultSubtitle}>
                        {(challengeResult as any).error}
                    </Text>
                </View>
            );
        }

        if (!challengeResult.completed) {
            return (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>Score Submitted!</Text>
                    <Text style={styles.resultSubtitle}>Waiting for opponent...</Text>
                    <ActivityIndicator size="small" color="#4F46E5" style={{ marginTop: 12 }} />
                </View>
            );
        }

        const won = challengeResult.won;
        const myId = getCurrentUser()?.uid;
        const isChallenger = activeChallenge.challengerId === myId;

        // Use state.score for current user's score (set by checkDeepLinkChallenge)
        const myScore = state.score;
        const opponentScore = isChallenger ? activeChallenge.opponentScore : activeChallenge.challengerScore;
        const opponentName = isChallenger ? activeChallenge.opponentUsername : activeChallenge.challengerUsername;
        const opponentId = isChallenger ? activeChallenge.opponentId : activeChallenge.challengerId;
        const opponentAvatar = opponentData[opponentId]?.avatarUrl;
        const opponentPinColor = opponentData[opponentId]?.pinColor || '#E5E7EB';

        // Get current user's avatar and pinColor from store
        const myAvatar = useMemoryStore.getState().avatarUri;
        const myPinColor = useMemoryStore.getState().pinColor || '#10B981';

        const winnerColor = won ? myPinColor : opponentPinColor;

        return (
            <View style={{
                flex: 1,
                backgroundColor: '#FAFAFA',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                {/* Trophy/Medal Icon - Frosted */}
                <View style={{
                    width: isSmallScreen ? 90 : 110,
                    height: isSmallScreen ? 90 : 110,
                    borderRadius: 55,
                    backgroundColor: won ? '#10B981' : '#F59E0B',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: isSmallScreen ? 16 : 24,
                    shadowColor: won ? '#10B981' : '#F59E0B',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 12,
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.3)',
                }}>
                    <View style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <Feather name={won ? 'award' : 'star'} size={isSmallScreen ? 32 : 36} color="white" />
                    </View>
                </View>

                {/* Result Title */}
                <Text style={{
                    fontSize: isSmallScreen ? 28 : 36,
                    fontWeight: '800',
                    color: '#1F2937',
                    marginBottom: 4,
                    textAlign: 'center',
                }}>
                    {won ? 'YOU WON!' : `${opponentName} won`}
                </Text>
                <Text style={{
                    fontSize: isSmallScreen ? 14 : 16,
                    color: won ? '#10B981' : '#D97706',
                    marginBottom: isSmallScreen ? 24 : 32,
                }}>
                    {won ? 'Great job, champion!' : 'Better luck next time!'}
                </Text>

                {/* Score Comparison Card - Premium */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 24,
                    padding: isSmallScreen ? 24 : 32,
                    width: '100%',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                    elevation: 8,
                    marginBottom: isSmallScreen ? 24 : 32,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.04)',
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-evenly',
                        width: '100%',
                    }}>
                        {/* My Score */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <View style={{
                                width: isSmallScreen ? 60 : 72,
                                height: isSmallScreen ? 60 : 72,
                                borderRadius: 36,
                                backgroundColor: '#F3F4F6',
                                borderWidth: 3,
                                borderColor: myPinColor,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 8,
                                overflow: 'hidden',
                            }}>
                                {myAvatar ? (
                                    <Image source={{ uri: myAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                ) : (
                                    <Feather name="user" size={isSmallScreen ? 28 : 32} color={won ? 'white' : '#9CA3AF'} />
                                )}
                            </View>
                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>You</Text>
                            <Text style={{
                                fontSize: isSmallScreen ? 28 : 36,
                                fontWeight: '800',
                                color: won ? '#059669' : '#374151',
                            }}>
                                {myScore}
                            </Text>
                        </View>

                        {/* VS Divider */}
                        <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: '#F3F4F6',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF' }}>VS</Text>
                            </View>
                        </View>

                        {/* Opponent Score */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <View style={{
                                width: isSmallScreen ? 60 : 72,
                                height: isSmallScreen ? 60 : 72,
                                borderRadius: 36,
                                backgroundColor: '#F3F4F6',
                                borderWidth: 3,
                                borderColor: opponentPinColor,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 8,
                                overflow: 'hidden',
                            }}>
                                {opponentAvatar ? (
                                    <Image source={{ uri: opponentAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                ) : (
                                    <Feather name="user" size={isSmallScreen ? 28 : 32} color={!won ? 'white' : '#9CA3AF'} />
                                )}
                            </View>
                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }} numberOfLines={1}>
                                {opponentName}
                            </Text>
                            <Text style={{
                                fontSize: isSmallScreen ? 28 : 36,
                                fontWeight: '800',
                                color: !won ? '#D97706' : '#374151',
                            }}>
                                {opponentScore || 0}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Game Type Badge - Frosted */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginBottom: isSmallScreen ? 20 : 28,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 6,
                    elevation: 2,
                    gap: 10,
                }}>
                    <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: activeChallenge.gameType === 'pindrop' ? '#EF4444' : activeChallenge.gameType === 'travelbattle' ? '#F59E0B' : '#3B82F6',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <Feather
                            name={activeChallenge.gameType === 'pindrop' ? 'map-pin' : activeChallenge.gameType === 'travelbattle' ? 'globe' : 'flag'}
                            size={14}
                            color="white"
                        />
                    </View>
                    <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                    }}>
                        {activeChallenge.gameType === 'pindrop' ? 'Pin Drop' :
                            activeChallenge.gameType === 'travelbattle' ? 'Travel Battle' : 'Flag Dash'} • {activeChallenge.difficulty || 'Medium'}
                    </Text>
                </View>

                {/* Side-by-side Buttons - Premium */}
                <View style={{
                    flexDirection: 'row',
                    gap: 14,
                    width: '100%',
                }}>
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#10B981',
                            paddingVertical: isSmallScreen ? 16 : 18,
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
                        onPress={handleRematch}
                    >
                        <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Feather name="repeat" size={16} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>REMATCH</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'white',
                            paddingVertical: isSmallScreen ? 16 : 18,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: '#E5E7EB',
                            gap: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 6,
                            elevation: 2,
                        }}
                        onPress={() => {
                            setActiveChallenge(null);
                            setActiveGameId(null);
                            setChallengeResult(null);
                            setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                            setSelectedGameType(null);
                        }}
                    >
                        <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: '#F3F4F6',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Feather name="x" size={16} color="#6B7280" />
                        </View>
                        <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '700' }}>EXIT</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderGameOver = () => {
        // For challenges, use the full-screen challenge result (includes everything)
        if (activeChallenge && challengeResult) {
            return renderChallengeResult();
        }

        // Standard game over for non-challenge games
        return (
            <View style={{
                flex: 1,
                backgroundColor: '#FAFAFA',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
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
                        backgroundColor: state.difficulty === 'easy' ? '#D1FAE5' : state.difficulty === 'hard' ? '#FEE2E2' : '#FEF3C7',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        gap: 6,
                    }}>
                        <View style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: state.difficulty === 'easy' ? '#10B981' : state.difficulty === 'hard' ? '#EF4444' : '#F59E0B',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Feather name="zap" size={10} color="white" />
                        </View>
                        <Text style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: state.difficulty === 'easy' ? '#065F46' : state.difficulty === 'hard' ? '#991B1B' : '#92400E',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}>
                            {state.difficulty}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons - Compact */}
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
                        onPress={handleStart}
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
                    {renderGameOverNav()}
                </View>
            </View>
        );
    };

    const renderGameOverNav = () => (
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
                    gameService.stopGame();
                    setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                    setSelectedGameType(null);
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
                    gameService.stopGame();
                    setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                    setSelectedGameType(null);
                    setTimeout(() => router.push('/' as any), 50);
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
                    <Feather name="x" size={14} color="#6B7280" />
                </View>
                <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Exit</Text>
            </TouchableOpacity>
        </View>
    );

    const renderGame = () => {
        if (!state.currentQuestion) return null;

        return (
            <View style={styles.gameContainer}>
                {/* HUD - Matching Travel Battle layout */}
                <View style={[styles.hud, { paddingHorizontal: 16, alignItems: 'center' }]}>
                    <TouchableOpacity
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#EF4444',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
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

                {/* Main Container Card */}
                <View style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: 28,
                    marginHorizontal: 16,
                    marginBottom: 20,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                }}>
                    {/* Flag - full size with border */}
                    {state.currentQuestion.type === 'flag' && state.currentQuestion.flagUrl && (
                        <View style={{
                            width: '100%',
                            height: isSmallScreen ? 140 : 180,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#000000',
                            overflow: 'hidden',
                            marginBottom: 16,
                        }}>
                            <Image
                                source={{ uri: state.currentQuestion.flagUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </View>
                    )}

                    {/* Question Text */}
                    <Text style={{
                        fontSize: isSmallScreen ? 14 : 16,
                        fontWeight: '400',
                        color: '#1F2937',
                        marginBottom: 12,
                        textAlign: 'center',
                        lineHeight: isSmallScreen ? 20 : 24,
                    }}>
                        {state.currentQuestion.text}
                    </Text>

                    {/* Progress Bar inside container */}
                    <View style={{
                        height: 6,
                        backgroundColor: '#E5E7EB',
                        borderRadius: 3,
                        marginBottom: 16,
                        overflow: 'hidden',
                    }}>
                        <View style={{
                            height: '100%',
                            width: `${(state.timeLeft / 30) * 100}%`,
                            backgroundColor: state.timeLeft < 10 ? '#EF4444' : '#10B981',
                            borderRadius: 3,
                        }} />
                    </View>

                    {/* Answer Options */}
                    <View style={{ gap: isSmallScreen ? 8 : 10 }}>
                        {state.currentQuestion.options.map((option) => (
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
            </View >
        );
    };

    const renderQuitConfirmationModal = () => (
        <Modal
            visible={showQuitConfirmation}
            transparent={true}
            animationType="fade"
            onRequestClose={cancelQuit}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={[styles.modalTitle, { fontSize: 24, marginBottom: 8 }]}>Quit Game?</Text>
                        <Text style={[styles.modalSubtitle, { fontSize: 16 }]}>Current progress will be lost.</Text>
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.secondaryButton]}
                            onPress={cancelQuit}
                        >
                            <Text style={styles.secondaryButtonText}>Back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.primaryButton]}
                            onPress={confirmQuit}
                        >
                            <Text style={styles.primaryButtonText}>Yes, Quit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // Full-screen Leaderboard Tab with Game Tabs and Top 3 Podium
    const renderLeaderboardTab = () => {
        const top3 = leaderboardData.slice(0, 3);
        const rest = leaderboardData.slice(3);

        const tabs = [
            { key: 'total' as const, label: 'Total' },
            { key: 'flagdash' as const, label: 'Flag Dash' },
            { key: 'pindrop' as const, label: 'Pin Drop' },
            { key: 'travelbattle' as const, label: 'Travel Battle' },
        ];

        // Proper metallic colors
        const GOLD = '#FFD700';
        const GOLD_DARK = '#DAA520';
        const SILVER = '#C0C0C0';
        const SILVER_DARK = '#A8A8A8';
        const BRONZE = '#CD7F32';
        const BRONZE_DARK = '#8B4513';

        const handleTabChange = (tab: typeof leaderboardTab) => {
            setLeaderboardTab(tab);
            fetchLeaderboard(tab);
        };

        return (
            <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#1F2937' }}>🏆 Leaderboard</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 0 }}>Compete with friends</Text>
                </View>

                {/* Game Type Tabs - Pill in Container Style */}
                <View style={{
                    backgroundColor: '#E5E7EB',
                    marginHorizontal: 20,
                    borderRadius: 20,
                    padding: 4,
                    flexDirection: 'row',
                    marginBottom: 12,
                }}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => handleTabChange(tab.key)}
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                paddingVertical: 8,
                                borderRadius: 16,
                                backgroundColor: leaderboardTab === tab.key ? '#10B981' : 'transparent',
                            }}
                        >
                            <Text style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: leaderboardTab === tab.key ? 'white' : '#6B7280'
                            }}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                {loadingLeaderboard ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={styles.loadingText}>Loading scores...</Text>
                    </View>
                ) : leaderboardData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="users" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>No scores yet!</Text>
                        <Text style={styles.emptySubtext}>Play a game to get on the leaderboard</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Top 3 Podium (Fixed) */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            marginBottom: 8,
                            flexShrink: 0, // Ensure it doesn't shrink
                        }}>
                            {/* #2 - Left (Silver) */}
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                {top3[1] ? (
                                    <>
                                        <View style={{
                                            width: isSmallScreen ? 44 : 56,
                                            height: isSmallScreen ? 44 : 56,
                                            borderRadius: isSmallScreen ? 22 : 28,
                                            borderWidth: 3,
                                            borderColor: SILVER,
                                            backgroundColor: '#F8F9FA',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                        }}>
                                            {leaderboardAvatars[top3[1].odUid]?.avatarUrl ? (
                                                <Image
                                                    source={{ uri: leaderboardAvatars[top3[1].odUid].avatarUrl! }}
                                                    style={{ width: '100%', height: '100%' }}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <Feather name="user" size={24} color={SILVER_DARK} />
                                            )}
                                        </View>
                                        <View style={{
                                            backgroundColor: SILVER,
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: -11,
                                            zIndex: 10,
                                        }}>
                                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>2</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 6 }} numberOfLines={1}>
                                            {top3[1].username}
                                        </Text>
                                        <Text style={{ fontSize: 15, fontWeight: '800', color: SILVER_DARK }}>
                                            {top3[1].score}
                                        </Text>
                                    </>
                                ) : <View style={{ width: isSmallScreen ? 44 : 56 }} />}
                            </View>

                            {/* #1 - Center (Gold, Elevated) */}
                            <View style={{ alignItems: 'center', flex: 1, marginBottom: 8 }}>
                                {top3[0] && (
                                    <>
                                        {/* Crown */}
                                        <Text style={{ fontSize: 24, marginBottom: 2 }}>👑</Text>
                                        <View style={{
                                            width: isSmallScreen ? 60 : 72,
                                            height: isSmallScreen ? 60 : 72,
                                            borderRadius: isSmallScreen ? 30 : 36,
                                            borderWidth: 4,
                                            borderColor: GOLD,
                                            backgroundColor: '#FFFBEB',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                            shadowColor: GOLD,
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.4,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}>
                                            {leaderboardAvatars[top3[0].odUid]?.avatarUrl ? (
                                                <Image
                                                    source={{ uri: leaderboardAvatars[top3[0].odUid].avatarUrl! }}
                                                    style={{ width: '100%', height: '100%' }}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <Feather name="user" size={32} color={GOLD_DARK} />
                                            )}
                                        </View>
                                        <View style={{
                                            backgroundColor: GOLD,
                                            width: 26,
                                            height: 26,
                                            borderRadius: 13,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: -13,
                                            zIndex: 10,
                                        }}>
                                            <Text style={{ color: '#1F2937', fontSize: 13, fontWeight: '700' }}>1</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1F2937', marginTop: 6 }} numberOfLines={1}>
                                            {top3[0].username}
                                        </Text>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: GOLD_DARK }}>
                                            {top3[0].score}
                                        </Text>
                                    </>
                                )}
                            </View>

                            {/* #3 - Right (Bronze) */}
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                {top3[2] ? (
                                    <>
                                        <View style={{
                                            width: isSmallScreen ? 44 : 56,
                                            height: isSmallScreen ? 44 : 56,
                                            borderRadius: isSmallScreen ? 22 : 28,
                                            borderWidth: 3,
                                            borderColor: BRONZE,
                                            backgroundColor: '#FEF7ED',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                        }}>
                                            {leaderboardAvatars[top3[2].odUid]?.avatarUrl ? (
                                                <Image
                                                    source={{ uri: leaderboardAvatars[top3[2].odUid].avatarUrl! }}
                                                    style={{ width: '100%', height: '100%' }}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <Feather name="user" size={24} color={BRONZE} />
                                            )}
                                        </View>
                                        <View style={{
                                            backgroundColor: BRONZE,
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: -11,
                                            zIndex: 10,
                                        }}>
                                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>3</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 6 }} numberOfLines={1}>
                                            {top3[2].username}
                                        </Text>
                                        <Text style={{ fontSize: 15, fontWeight: '800', color: BRONZE_DARK }}>
                                            {top3[2].score}
                                        </Text>
                                    </>
                                ) : <View style={{ width: isSmallScreen ? 44 : 56 }} />}
                            </View>
                        </View>

                        {/* Ranks 4+ List (Scrollable) */}
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
                            {rest.length > 0 && (
                                <View style={{
                                    backgroundColor: 'white',
                                    borderRadius: 20,
                                    marginHorizontal: 16,
                                    padding: 16,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 8,
                                    elevation: 2,
                                    minHeight: 200, // Ensure minimum height to prevent collapse
                                }}>
                                    {rest.map((entry, index) => {
                                        const avatarData = leaderboardAvatars[entry.odUid];
                                        const ringColor = avatarData?.pinColor || '#E5E7EB';
                                        return (
                                            <View
                                                key={`${entry.odUid}_${index}`}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 12,
                                                    borderBottomWidth: index < rest.length - 1 ? 1 : 0,
                                                    borderBottomColor: '#F3F4F6',
                                                }}
                                            >
                                                {/* Rank */}
                                                <View style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 16,
                                                    backgroundColor: '#F3F4F6',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 12,
                                                }}>
                                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B7280' }}>
                                                        {index + 4}
                                                    </Text>
                                                </View>

                                                {/* Avatar */}
                                                <View style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    borderWidth: 2,
                                                    borderColor: ringColor,
                                                    backgroundColor: '#F9FAFB',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    overflow: 'hidden',
                                                    marginRight: 12,
                                                }}>
                                                    {avatarData?.avatarUrl ? (
                                                        <Image
                                                            source={{ uri: avatarData.avatarUrl }}
                                                            style={{ width: '100%', height: '100%' }}
                                                            contentFit="cover"
                                                        />
                                                    ) : (
                                                        <Feather name="user" size={22} color="#9CA3AF" />
                                                    )}
                                                </View>

                                                {/* Name */}
                                                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
                                                    {entry.username}
                                                </Text>

                                                {/* Score */}
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>
                                                        {entry.score}
                                                    </Text>
                                                    {leaderboardTab !== 'total' && entry.difficulty && (
                                                        <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                                                            {entry.difficulty}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
        );
    };

    // DEBUG: Log render path
    console.log('[GameSandbox] Render state:', { selectedGameType, gameOver: state.gameOver, isPlaying: state.isPlaying });

    if (errorInfo) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: 'white' }}>
                <Feather name="alert-triangle" size={48} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginVertical: 10 }}>Something went wrong</Text>
                <Text style={{ color: '#374151', textAlign: 'center' }}>{errorInfo}</Text>
                <TouchableOpacity
                    onPress={() => setErrorInfo(null)}
                    style={{ marginTop: 20, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8 }}
                >
                    <Text style={{ color: '#3B82F6' }}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!width || !height) {
        return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Pin Drop Challenge Result - show when viewing completed challenge */}
            {selectedGameType === 'pindrop' && state.gameOver && activeChallenge && challengeResult && (
                <>
                    {renderQuitConfirmationModal()}
                    {renderGameOver()}
                </>
            )}

            {/* Pin Drop Full Screen Game - only when NOT viewing completed result */}
            {selectedGameType === 'pindrop' && !(state.gameOver && activeChallenge && challengeResult) && (
                <React.Suspense fallback={<View style={styles.centerContainer}><ActivityIndicator size="large" color="#10B981" /></View>}>
                    <PinDropGame
                        difficulty={pinDropDifficulty}
                        onGameOver={async (score) => {
                            // Note: PinDrop scores are now submitted via Cloud Functions
                            // The PinDropGame component handles score submission internally
                            // Record streak
                            const result = await streakService.recordGamePlayed();
                            setDailyStreak(result.streak);
                            setSelectedGameType(null);
                        }}
                        onQuit={() => {
                            setSelectedGameType(null);
                        }}
                    />
                </React.Suspense>
            )}

            {/* Flag Dash Game - Original inline implementation */}
            {selectedGameType === 'flagdash' && state.isPlaying && !state.gameOver && (
                <>
                    {renderQuitConfirmationModal()}
                    {renderGame()}
                </>
            )}

            {/* Flag Dash Game Over */}
            {selectedGameType === 'flagdash' && state.gameOver && (
                <>
                    {renderGameOver()}
                </>
            )}

            {/* Travel Battle Game (NEW - with Trivia) */}
            {selectedGameType === 'travelbattle' && (
                <React.Suspense fallback={<View style={styles.centerContainer}><ActivityIndicator size="large" color="#F59E0B" /></View>}>
                    <TravelBattleGame
                        difficulty={selectedDifficulty}
                        gameMode="travelbattle"
                        onGameOver={async (score) => {
                            setState(prev => ({ ...prev, score, gameOver: true }));
                            // Record streak
                            const result = await streakService.recordGamePlayed();
                            setDailyStreak(result.streak);
                        }}
                        onQuit={() => {
                            handleQuit();
                        }}
                        onGameMenu={() => {
                            gameService.stopGame();
                            setSelectedGameType(null);
                        }}
                        onExit={() => {
                            gameService.stopGame();
                            setSelectedGameType(null);
                            router.push('/' as any);
                        }}
                    />
                </React.Suspense>
            )}

            {/* Hub (Start Screen) - Only show if NO game selected */}
            {!selectedGameType && (
                <>
                    <Stack.Screen options={{ title: '' }} />
                    {renderQuitConfirmationModal()}

                    {/* Animated Tab Container */}
                    <Animated.View
                        // {...panResponder.panHandlers}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            width: width * 2,
                            transform: [{ translateX: tabTranslateX }],
                        }}
                    >
                        {/* Home Tab */}
                        <ScrollView
                            style={[styles.content, { width }]}
                            contentContainerStyle={[styles.contentContainer, { padding: isSmallScreen ? 16 : 24 }]}
                            showsVerticalScrollIndicator={false}
                        >
                            {renderStartScreen()}
                        </ScrollView>

                        {/* Leaderboard Tab */}
                        <View style={{ width }}>
                            {renderLeaderboardTab()}
                        </View>
                    </Animated.View>

                    {/* Bottom Navigation */}
                    {renderBottomNav()}
                </>
            )}
            {/* Pre-Game Bottom Sheet Modal */}
            <Modal
                visible={!!previewGame}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setPreviewGame(null)}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{
                        backgroundColor: 'white',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        padding: 24,
                        paddingBottom: 40,
                    }}>
                        {/* Handle Bar */}
                        <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        {/* Game Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                            <View style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                backgroundColor: previewGame === 'flagdash' ? '#4F46E5' : previewGame === 'pindrop' ? '#10B981' : '#F59E0B',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 16,
                            }}>
                                <Feather
                                    name={previewGame === 'flagdash' ? 'flag' : previewGame === 'pindrop' ? 'map-pin' : 'globe'}
                                    size={28}
                                    color="white"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 22, fontWeight: '800', color: '#1F2937' }}>
                                    {previewGame === 'flagdash' ? 'Flag Dash' : previewGame === 'pindrop' ? 'Pin Drop' : 'Travel Battle'}
                                </Text>
                                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
                                    {previewGame === 'flagdash' ? 'Guess flags & capitals' : previewGame === 'pindrop' ? 'Find locations on the map' : 'Trivia, flags & more!'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setPreviewGame(null)}>
                                <Feather name="x" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* High Score */}
                        <View style={{
                            backgroundColor: '#F9FAFB',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}>
                            <Feather name="award" size={20} color="#F59E0B" />
                            <Text style={{ marginLeft: 10, fontSize: 14, color: '#6B7280' }}>High Score:</Text>
                            <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '700', color: '#1F2937' }}>{state.highScore}</Text>
                        </View>

                        {/* Difficulty Selector */}
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#9CA3AF', letterSpacing: 1, marginBottom: 12 }}>DIFFICULTY</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
                                <TouchableOpacity
                                    key={diff}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        backgroundColor: selectedDifficulty === diff ? '#4F46E5' : '#F3F4F6',
                                        alignItems: 'center',
                                    }}
                                    onPress={() => {
                                        setSelectedDifficulty(diff);
                                        setPinDropDifficulty(diff as PinDropDifficulty);
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: '700',
                                        color: selectedDifficulty === diff ? 'white' : '#6B7280'
                                    }}>
                                        {diff.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Start Game Button */}
                        <TouchableOpacity
                            style={{
                                backgroundColor: previewGame === 'flagdash' ? '#4F46E5' : previewGame === 'pindrop' ? '#10B981' : '#F59E0B',
                                paddingVertical: 16,
                                borderRadius: 16,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 10,
                            }}
                            onPress={() => {
                                const gameToStart = previewGame;
                                setPreviewGame(null);
                                if (gameToStart) {
                                    // Start the gameService for flagdash and travelbattle
                                    if (gameToStart === 'flagdash' || gameToStart === 'travelbattle') {
                                        gameService.startGame(selectedDifficulty, gameToStart);
                                    }
                                    setSelectedGameType(gameToStart);
                                }
                            }}
                        >
                            <Feather name="play" size={20} color="white" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Start Game</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Challenge Friend Modal (Scalable with Search) */}
            {showChallengePicker && (
                <React.Suspense fallback={null}>
                    <ChallengeFriendModal
                        visible={showChallengePicker}
                        onClose={() => setShowChallengePicker(false)}
                        friends={friends}
                        difficulty={selectedDifficulty}
                        loadingFriends={loadingFriends}
                        onSendChallenge={async (friend, gameType, difficulty) => {
                            await sendChallenge(friend.uid, gameType, difficulty);
                        }}
                    />
                </React.Suspense>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },

    content: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gameContainer: {
        flex: 1,
        width: '100%',
    },
    startButton: {
        flexDirection: 'row',
        backgroundColor: '#4F46E5',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        gap: 12,
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    startButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 1,
    },
    highScoreBox: {
        marginTop: 40,
        alignItems: 'center',
    },
    highScoreLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#9CA3AF',
        letterSpacing: 1.5,
    },
    highScoreValue: {
        fontSize: 36,
        fontWeight: '900',
        color: '#374151',
    },
    scoreResult: {
        fontSize: 48,
        fontWeight: '900',
        color: '#4F46E5',
        marginVertical: 24,
    },
    // HUD
    hud: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 16,
    },
    hudItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    quitButton: {
        backgroundColor: '#EF4444',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    hudText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
    },
    urgentText: {
        color: '#EF4444',
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        marginBottom: 32,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4F46E5',
    },
    // Game Card
    card: {
        height: isSmallScreen ? 150 : 200,
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: isSmallScreen ? 16 : 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        overflow: 'hidden',
        padding: isSmallScreen ? 16 : 24,
    },
    flagImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    promptText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 16,
        textAlign: 'center',
    },
    optionsGrid: {
        flexDirection: 'column',
        gap: isSmallScreen ? 8 : 10,
        paddingHorizontal: isSmallScreen ? 0 : 8,
    },
    optionButton: {
        width: '100%',
        backgroundColor: 'white',
        paddingVertical: isSmallScreen ? 12 : 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    // Difficulty Selector
    difficultyContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    difficultyLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#9CA3AF',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    difficultyButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    difficultyButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
    },
    difficultyButtonActive: {
        backgroundColor: '#4F46E5',
    },
    difficultyButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
    },
    difficultyButtonTextActive: {
        color: 'white',
    },
    difficultyBadge: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9CA3AF',
        marginTop: -16,
        marginBottom: 24,
    },
    // Leaderboard Button
    leaderboardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    leaderboardButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4F46E5',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: height * 0.7,
    },
    modalHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
        letterSpacing: 1,
    },
    modalActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    primaryButton: {
        backgroundColor: '#EF4444',
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    // Challenge Result
    resultContainer: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginVertical: 20,
        width: '100%',
    },
    resultWon: {
        backgroundColor: '#D1FAE5', // Light Green
    },
    resultLost: {
        backgroundColor: '#FEE2E2', // Light Red
    },
    resultTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 8,
    },
    resultSubtitle: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        top: 20,
    },
    loadingContainer: {
        padding: 60,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6B7280',
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#374151',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    leaderboardList: {
        padding: 16,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 8,
    },
    rankBadge: {
        width: 40,
    },
    rankText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#374151',
    },
    playerName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    playerScore: {
        fontSize: 18,
        fontWeight: '800',
        color: '#4F46E5',
    },
    // Game Over Navigation
    gameOverNavRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 24,
    },
    gameOverNavButton: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        minWidth: 80,
    },
    gameOverNavText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 4,
    },
    // Challenge styles
    challengeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#10B981',
        marginTop: 8,
        gap: 8,
    },
    challengeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    pendingSection: {
        marginTop: 24,
        width: '100%',
        paddingHorizontal: 16,
    },
    pendingSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    pendingChallengeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    pendingChallengeInfo: {
        flex: 1,
    },
    pendingChallengeName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    pendingChallengeDifficulty: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    acceptButton: {
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    acceptButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'white',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    friendAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
    },
    challengeSendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Dashboard Styles
    dashboardContainer: {
        width: '100%',
        marginBottom: 24,
        gap: 16,
    },
    section: {
        gap: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        width: '100%',
        marginBottom: 24,
    },
    gameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    gameRowInvite: {
        borderColor: '#C7D2FE',
        backgroundColor: '#F5F3FF',
    },
    gameRowResult: {
        borderColor: '#E5E7EB',
    },
    gameRowWaiting: {
        opacity: 0.8,
        backgroundColor: '#F9FAFB',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    rowSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    actionBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '700',
        color: 'white',
    },
    waitingText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    // GAMES HUB REDESIGN STYLES
    hubHeaderTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111827',
        alignSelf: 'flex-start',
        marginLeft: 20,
        marginBottom: 20,
        marginTop: 10,
    },
    hubSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 20,
        marginBottom: 12,
        marginTop: 24,
    },
    activeGamesScroll: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    activeGameCard: {
        width: 165,
        height: 230,
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    activeGameCardInvite: {
        backgroundColor: '#F5F5F5',
        borderColor: '#E5E7EB',
    },
    cardAvatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginBottom: 8,
        borderWidth: 3,
        borderColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    cardAvatarImage: {
        width: 58,
        height: 58,
        borderRadius: 29,
    },
    cardName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
    },
    cardStatus: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 12,
    },
    playButtonSmall: {
        width: '100%',
        backgroundColor: '#111827', // Black branding
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonTextSmall: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    watingListContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    waitingRowNew: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    waitingAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    waitingContent: {
        flex: 1,
    },
    waitingName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    waitingStatus: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    // New Game FAB replacement (Bottom Card)
    newGameCard: {
        marginHorizontal: 20,
        marginTop: 32,
        marginBottom: 40,
        backgroundColor: '#4169E1',
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#4169E1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    newGameTextContent: {
        flex: 1,
    },
    newGameTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: 'white',
        marginBottom: 4,
    },
    newGameSubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    newGameIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Bottom Navigation Bar
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingVertical: 12,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
    },
    navButton: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    navButtonActive: {},
    navButtonCenter: {
        alignItems: 'center',
        marginTop: -30,
    },
    navButtonCenterActive: {},
    navCenterCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#9CA3AF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4169E1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    navLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 4,
    },
    navLabelActive: {
        color: '#4169E1',
    },
    // Game Selection Cards
    gameCard: {
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    gameCardIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    gameCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
        marginBottom: 4,
    },
    gameCardSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    // Leaderboard Tab Styles
    leaderboardTabHeader: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    leaderboardTabTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    leaderboardTabSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    leaderboardTabList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
});

// Flag Dash Animated Option Button
const FlagDashOptionButton = ({ option, lastSelectedOptionId, lastAnswerCorrect, correctOptionId, onPress, isSmallScreen }: any) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const isSelected = lastSelectedOptionId === option.id;
    const isCorrectOption = option.id === correctOptionId;

    const showCorrect = lastAnswerCorrect !== null && isCorrectOption && isSelected;
    const showWrong = lastAnswerCorrect !== null && !isCorrectOption && isSelected;

    React.useEffect(() => {
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
            style={{
                width: '100%',
                paddingVertical: isSmallScreen ? 12 : 16,
                paddingHorizontal: 20,
                borderRadius: 12,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                // Flat & Clean: No shadows, light bg, visible border
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                position: 'relative',
                overflow: 'hidden',
            }}
            onPress={() => onPress(option.id)}
            disabled={lastAnswerCorrect !== null}
        >
            <Animated.View style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: finalBgColor,
                opacity: (showCorrect || showWrong) ? 1 : 0
            }} />

            <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: (showCorrect || showWrong) ? 'white' : '#4B5563',
                textAlign: 'center',
                zIndex: 1,
            }}>
                {option.text}
            </Text>
        </TouchableOpacity>
    );
};



