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
import { getCurrentUser, onAuthStateChanged } from '../../src/services/authService';

import { PinDropDifficulty } from '../../src/services/PinDropService';
import { streakService } from '../../src/services/StreakService';
import { useMemoryStore } from '../../src/store/useMemoryStore';

const PinDropGame = React.lazy(async () => {
    const module = await import('../../src/components/PinDropGame');
    return { default: module.PinDropGame };
});

const FlagDashGame = React.lazy(async () => {
    const module = await import('../../src/components/FlagDashGame');
    return { default: module.FlagDashGame };
});

const TravelBattleGame = React.lazy(async () => {
    const module = await import('../../src/components/TravelBattleGame');
    return { default: module.TravelBattleGame };
});

/*
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

    // Auth Debug State
    const [authDebug, setAuthDebug] = useState<string>('Initializing...');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [selfUsername, setSelfUsername] = useState<string>('Loading...');

    const [errorInfo, setErrorInfo] = useState<string | null>(null);
    const [debugDirectCount, setDebugDirectCount] = useState<number | null>(null);

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

    const getStreakColor = () => {
        if (state.streak >= 10) return '#F59E0B'; // Amber for high streak
        if (state.streak >= 5) return '#10B981'; // Green for medium
        return '#4F46E5'; // Indigo for low
    };

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
        let unsubPending = () => { };
        let unsubAuth = () => { };

        const init = async () => {
            setAuthDebug('Waiting for auth...');
            try {
                // Use observer to handle async auth restoration
                unsubAuth = await onAuthStateChanged((uid) => {
                    if (uid) {
                        if (uid !== currentUserId) {
                            console.log('[GameSandbox] Auth State: User found:', uid);
                            setAuthDebug(`User: ${uid.slice(0, 5)}...`);
                            setCurrentUserId(uid);
                            setupUserSubscriptions(uid);
                        }
                    } else {
                        console.log('[GameSandbox] Auth State: No user');
                        setAuthDebug('User not logged in');
                        setCurrentUserId(null);
                    }
                });
            } catch (e: any) {
                console.error('[GameSandbox] Auth init failed:', e);
                setAuthDebug(`Auth init failed: ${e.message}`);
            }
        };

        function setupUserSubscriptions(uid: string) {
            console.log('[GameSandbox] Setting up subscriptions for user:', uid);
            setErrorInfo(null); // Clear previous errors

            // Fetch Username for verification
            getUserProfile(uid).then(p => {
                setSelfUsername(p?.username || 'Unknown User');
            }).catch(() => setSelfUsername('Fetch Error'));

            // Diagnostic: REST Fetch (Bypassing gRPC) & UI Wiring
            // Since native subscriptions are broken on iOS, we use this Polling Fallback
            if (uid) {
                const { RestService } = require('@/src/services/RestService');

                const pollGames = () => {
                    console.log('[GameSandbox] 🔄 Polling REST API...');
                    RestService.fetchActiveGames(uid).then((res: { active: any[], pending: any[] }) => {
                        console.log(`[GameSandbox] REST Success: ${res.active.length} active, ${res.pending.length} pending`);

                        // Update Debug Footer
                        setDebugDirectCount(res.active.length);

                        // HYDRATE UI STATE (Fixes missing tiles)
                        setActiveChallenges(res.active);
                        setPendingChallenges(res.pending);

                    }).catch((e: any) => {
                        console.error('[GameSandbox] REST fetch failed:', e);
                        setDebugDirectCount(-2);
                    });
                };

                // Initial Fetch
                pollGames();

                // Poll every 10 seconds to simulate real-time
                const intervalId = setInterval(pollGames, 10000);

                // Cleanup polling on unmount/auth change
                const originalUnsub = unsubChallenges; // Keep ref to any native unsub if it exists
                unsubChallenges = () => {
                    clearInterval(intervalId);
                    if (originalUnsub) originalUnsub();
                };
            }

            // A. Active Games
            unsubChallenges = challengeService.subscribeToActiveChallenges(uid, async (games) => {
                try {
                    console.log('[GameSandbox] Active games updated:', games.length);
                    setActiveGames(games);

                    // Fetch avatars/pins for opponents
                    const dataUpdates: Record<string, { avatarUrl: string | null; pinColor: string | null }> = {};
                    for (const game of games) {
                        const opponentId = game.challengerId === uid ? game.opponentId : game.challengerId;
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
            }, (error) => {
                console.error('[GameSandbox] Firestore Subscription Error:', error);
                setErrorInfo(`Firestore Error: ${error.code || error.message}`);
                // Could be 'permission-denied', 'unavailable', etc.
            });

            // B. Pending Challenges
            unsubPending = challengeService.subscribeToPendingChallenges(uid, (challenges) => {
                console.log('[GameSandbox] Received pending challenges update:', challenges.length);
                setPendingChallenges(challenges);
            });

            // C. Initial Leaderboard Fetch
            fetchLeaderboard();
        };

        // Initialize
        init();

        return () => {
            gameService.stopGame();
            if (unsubAuth) unsubAuth();
            if (unsubChallenges) unsubChallenges();
            if (unsubPending) unsubPending();
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
            <ScrollView
                style={{ flex: 1, backgroundColor: '#FAFAFA' }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Debug Footer for verification */}
                <View style={{ alignItems: 'center', marginVertical: 10, opacity: 0.7 }}>
                    <Text style={{ fontSize: 13, color: 'black', fontWeight: 'bold' }}>
                        User: "{selfUsername}"
                    </Text>
                    <Text style={{ fontSize: 13, color: 'black', fontWeight: 'bold' }}>
                        UID: "{currentUserId ? currentUserId.slice(-5) : 'None'}"
                    </Text>
                    <Text style={{ fontSize: 13, color: 'black', fontWeight: 'bold' }}>
                        Sub: {activeGames.length} | Get: {debugDirectCount === null ? '...' : debugDirectCount}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#333' }}>PID: {firestore().app.options.projectId}</Text>
                    {errorInfo && (
                        <Text style={{ fontSize: 10, color: 'red', fontWeight: 'bold' }}>{errorInfo}</Text>
                    )}
                </View>


                {/* Page Header with Back Button */}
                <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
                    {/* Back Button */}
                    < TouchableOpacity
                        onPress={() => router.back()}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 12,
                            alignSelf: 'flex-start',
                        }}
                    >
                        <Feather name="arrow-left" size={20} color="#3B82F6" />
                    </TouchableOpacity >

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
                </View >

                {/* SECTION 1: YOUR TURN */}
                < View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>⚡ Your Turn</Text>
                    {
                        yourTurn.length > 0 && (
                            <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>{yourTurn.length}</Text>
                            </View>
                        )
                    }
                </View >

                {
                    yourTurn.length === 0 ? (
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
                    )
                }


                {/* SECTION 2: WAITING */}
                {
                    theirTurn.length > 0 && (
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
                    )
                }


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
                        onPress={() => {
                            setState(prev => ({ ...prev, difficulty: 'medium' }));
                            setSelectedGameType('flagdash');
                        }}
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
                        onPress={() => {
                            setPinDropDifficulty('medium');
                            setSelectedGameType('pindrop');
                        }}
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
                        onPress={() => {
                            setSelectedDifficulty('medium');
                            setSelectedGameType('travelbattle');
                        }}
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

            </ScrollView >
        );
    };

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
                        <Text style={styles.emptyText}>Play a game to get on the leaderboard</Text>
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
                            <Text style={styles.primaryButtonText}>Quit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
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

            {/* Flag Dash Game (Refactored to Component) */}
            {selectedGameType === 'flagdash' && (
                <React.Suspense fallback={<View style={styles.centerContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>}>
                    <FlagDashGame
                        difficulty={selectedDifficulty}
                        onGameOver={async (score) => {
                            // Update local state for result display logic if needed, or rely on GameService state
                            setState(prev => ({ ...prev, score, gameOver: true }));
                            // Record streak
                            const result = await streakService.recordGamePlayed();
                            setDailyStreak(result.streak);
                        }}
                        onQuit={() => {
                            handleQuit();
                        }}
                    />
                </React.Suspense>
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

            {!selectedGameType && (
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
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 15,
        color: '#9CA3AF',
        textAlign: 'center',
        fontWeight: '500',
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
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        width: '85%',
        overflow: 'hidden',
    },
    modalTitle: {
        fontWeight: '900',
        color: '#111827',
        textAlign: 'center',
    },
    modalSubtitle: {
        color: '#6B7280',
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#F9FAFB',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
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
});
