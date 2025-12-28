import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, SafeAreaView, ScrollView, Animated, Modal, ActivityIndicator, FlatList, BackHandler, PanResponder } from 'react-native';
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
import { PinDropGame } from '../../src/components/PinDropGame';
import { TravelBattleGame } from '../../src/components/TravelBattleGame';
import { PinDropDifficulty } from '../../src/services/PinDropService';
import { streakService } from '../../src/services/StreakService';
import { ChallengeFriendModal } from '../../src/components/ChallengeFriendModal';

import { useMemoryStore } from '../../src/store/useMemoryStore';

const { width, height } = Dimensions.get('window');
const isSmallScreen = height < 700;

export default function GameSandbox() {
    const insets = useSafeAreaInsets();
    console.log('[GameSandbox] Rendering with insets:', insets);
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
        difficulty: 'medium'
    });

    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
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
    const [opponentAvatars, setOpponentAvatars] = useState<Record<string, string | null>>({}); // Cache opponent avatars
    const [dailyStreak, setDailyStreak] = useState<number>(0); // Daily play streak

    const router = useRouter();
    const params = useLocalSearchParams<{ challengeId: string }>();

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;

    // Tab swipe animation
    const tabTranslateX = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
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
                    }).start(() => {
                        setActiveTab('leaderboard');
                        fetchLeaderboard();
                    });
                } else if (activeTab === 'leaderboard' && gestureState.dx > swipeThreshold) {
                    // Swipe right to Home
                    Animated.spring(tabTranslateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 10,
                    }).start(() => {
                        setActiveTab('home');
                    });
                } else {
                    // Snap back
                    Animated.spring(tabTranslateX, {
                        toValue: activeTab === 'home' ? 0 : -width,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 10,
                    }).start();
                }
            },
        })
    ).current;

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

                    // Fetch avatars for opponents (batch fetch, cache in state)
                    const avatarUpdates: Record<string, string | null> = {};
                    for (const game of games) {
                        const opponentId = game.challengerId === user.uid ? game.opponentId : game.challengerId;
                        if (!opponentAvatars[opponentId]) {
                            try {
                                const profile = await getUserProfile(opponentId);
                                avatarUpdates[opponentId] = profile?.avatarUrl || null;
                            } catch (e) {
                                avatarUpdates[opponentId] = null;
                            }
                        }
                    }
                    if (Object.keys(avatarUpdates).length > 0) {
                        setOpponentAvatars(prev => ({ ...prev, ...avatarUpdates }));
                    }
                } catch (error) {
                    console.error('[GameSandbox] Error in challenge subscription:', error);
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
        // Haptic feedback based on result
        if (isCorrect) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedGameType('flagdash');
        gameService.startGame(selectedDifficulty, 'flagdash');
    };

    const handleAnswer = (code: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        gameService.submitAnswer(code);
    };

    const handleDifficultyChange = (difficulty: Difficulty) => {
        setSelectedDifficulty(difficulty);
        gameService.setDifficulty(difficulty);
    };

    const handleQuit = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

    const fetchLeaderboard = async () => {
        setLoadingLeaderboard(true);
        try {
            // Get best scores across all difficulties (limited to 50)
            const data = await leaderboardService.getFriendsLeaderboard();
            setLeaderboardData(data);
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
        } catch (error) {
            console.error('Failed to load pending challenges:', error);
        }
    };


    const sendChallenge = async (friendUid: string, gameType: 'flagdash' | 'pindrop' | 'travelbattle', difficulty: Difficulty) => {
        setShowChallengePicker(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

            // Start Game
            setSelectedGameType('flagdash');
            gameService.startGame(challenge.difficulty);  // Actually start the game!

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
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
                <Feather name="award" size={24} color={activeTab === 'leaderboard' ? '#4169E1' : '#9CA3AF'} />
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
            <View style={{ flex: 1, backgroundColor: 'white' }}>

                {/* Daily Streak Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: dailyStreak > 0 ? '#FEF3C7' : '#F3F4F6',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        gap: 6,
                    }}>
                        <Text style={{ fontSize: 16 }}>🔥</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: dailyStreak > 0 ? '#D97706' : '#9CA3AF' }}>
                            {dailyStreak} Day{dailyStreak !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                </View>

                {/* SECTION 1: YOUR TURN (Horizontal Scroll) */}
                <Text style={styles.hubSectionTitle}>Your Turn</Text>

                {yourTurn.length === 0 ? (
                    <View style={{ paddingHorizontal: 20 }}>
                        <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No active games. Start one below!</Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.activeGamesScroll}
                    >
                        {yourTurn.map((item: any) => {
                            const isInvite = item.type === 'invite';
                            const isResult = item.type === 'result';
                            const opponentId = item.challengerId === getCurrentUser()?.uid ? item.opponentId : item.challengerId;
                            const opponentName = item.challengerId === getCurrentUser()?.uid ? item.opponentUsername : item.challengerUsername;
                            const opponentAvatar = opponentAvatars[opponentId];
                            const statusText = isInvite ? 'Invited you' : isResult ? 'Game Over' : 'Ready to play';

                            // Determine ring colors (Using AvatarPin logic purely visually here)
                            const ringColor = isInvite ? '#A78BFA' : (isResult ? '#10B981' : '#EAB308');

                            return (
                                <TouchableOpacity
                                    key={item.id || Math.random()}
                                    style={[styles.activeGameCard, isInvite && styles.activeGameCardInvite]}
                                    onPress={() => {
                                        if (isInvite) acceptChallenge(item);
                                        else checkDeepLinkChallenge(item.id);
                                    }}
                                >
                                    <View style={[styles.cardAvatarContainer, { borderColor: ringColor }]}>
                                        {opponentAvatar ? (
                                            <Image source={{ uri: opponentAvatar }} style={styles.cardAvatarImage} contentFit="cover" />
                                        ) : (
                                            <Feather name="user" size={32} color="#4B5563" />
                                        )}
                                    </View>

                                    <View>
                                        <Text style={styles.cardName} numberOfLines={1}>{opponentName || 'Unknown'}</Text>
                                        <Text style={styles.cardStatus}>{statusText}</Text>
                                    </View>

                                    {/* Game Type & Difficulty Badges */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                                        <View style={{ backgroundColor: item.gameType === 'pindrop' ? '#EF4444' : item.gameType === 'travelbattle' ? '#F59E0B' : '#3B82F6', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                                                {item.gameType === 'pindrop' ? 'PIN DROP' : item.gameType === 'travelbattle' ? 'BATTLE' : 'FLAG DASH'}
                                            </Text>
                                        </View>
                                        <View style={{ backgroundColor: item.difficulty === 'easy' ? '#10B981' : item.difficulty === 'hard' ? '#EF4444' : '#F59E0B', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                                                {item.difficulty?.toUpperCase() || 'MEDIUM'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.playButtonSmall}>
                                        <Text style={styles.playButtonTextSmall}>
                                            {isInvite ? 'ACCEPT' : isResult ? 'VIEW' : 'PLAY'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}


                {/* SECTION 2: WAITING (Vertical List) */}
                {theirTurn.length > 0 && (
                    <>
                        <Text style={styles.hubSectionTitle}>Waiting</Text>
                        <View style={styles.watingListContainer}>
                            {theirTurn.map((item: any) => {
                                const opponentName = item.challengerId === getCurrentUser()?.uid ? item.opponentUsername : item.challengerUsername;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.waitingRowNew}
                                        onPress={() => checkDeepLinkChallenge(item.id)}
                                    >
                                        <View style={styles.waitingAvatar}>
                                            <Feather name="clock" size={20} color="#9CA3AF" />
                                        </View>
                                        <View style={styles.waitingContent}>
                                            <Text style={styles.waitingName}>vs {opponentName}</Text>
                                            <Text style={styles.waitingStatus}>Waiting for opponent...</Text>
                                        </View>
                                        <Feather name="chevron-right" size={20} color="#E5E7EB" />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}


                {/* SECTION 3: GAME SELECTION */}

                {/* Game Cards Row - Horizontal Square Tiles */}
                <View style={{ flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 16 }}>
                    {/* Flag Dash Card */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#3B82F6',
                            borderRadius: 16,
                            padding: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        onPress={() => setPreviewGame('flagdash')}
                    >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                            <Feather name="flag" size={18} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>Flag Dash</Text>
                    </TouchableOpacity>

                    {/* Pin Drop Card */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#EF4444',
                            borderRadius: 16,
                            padding: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        onPress={() => setPreviewGame('pindrop')}
                    >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                            <Feather name="map-pin" size={18} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>Pin Drop</Text>
                    </TouchableOpacity>

                    {/* Travel Battle Card */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            aspectRatio: 1,
                            backgroundColor: '#F59E0B',
                            borderRadius: 16,
                            padding: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        onPress={() => setPreviewGame('travelbattle')}
                    >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                            <Feather name="globe" size={18} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>Travel Battle</Text>
                    </TouchableOpacity>
                </View>

                {/* Friend Challenge Button (Prominent Green) */}
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 40,
                        backgroundColor: '#10B981',
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        borderRadius: 16,
                        marginHorizontal: 20,
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                    onPress={loadFriendsForChallenge}
                >
                    <Feather name="users" size={20} color="white" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Challenge a Friend</Text>
                </TouchableOpacity>

            </View>
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
        return (
            <View style={[styles.resultContainer, won ? styles.resultWon : styles.resultLost]}>
                <Text style={styles.resultTitle}>{won ? 'YOU WON! 🎉' : 'You Lost 😔'}</Text>
                <Text style={styles.resultSubtitle}>
                    {won ? 'Great job!' : 'Better luck next time!'}
                </Text>
            </View>
        );
    };

    const renderGameOver = () => (
        <View style={styles.centerContainer}>
            {/* Show standard Game Over OR Challenge Result */}
            {activeChallenge && challengeResult ? (
                renderChallengeResult()
            ) : (
                <>
                    <View style={[styles.iconCircle, { backgroundColor: state.isNewHighScore ? '#FEF3C7' : '#FEE2E2' }]}>
                        <Feather
                            name={state.isNewHighScore ? "award" : "x-octagon"}
                            size={isSmallScreen ? 48 : 64}
                            color={state.isNewHighScore ? "#F59E0B" : "#EF4444"}
                        />
                    </View>
                    <Text style={styles.title}>{state.isNewHighScore ? '🏆 NEW HIGH SCORE!' : "Time's Up!"}</Text>
                </>
            )}

            <Text style={[styles.scoreResult, state.isNewHighScore && { color: '#F59E0B' }]}>
                {state.score} PTS
            </Text>
            <Text style={styles.difficultyBadge}>{state.difficulty.toUpperCase()}</Text>

            {/* Primary Action */}
            <TouchableOpacity style={styles.startButton} onPress={() => {
                if (activeChallenge) {
                    handleRematch();
                } else {
                    handleStart();
                }
            }}>
                <Text style={styles.startButtonText}>{activeChallenge ? 'REMATCH' : 'PLAY AGAIN'}</Text>
                <Feather name={activeChallenge ? "play-circle" : "refresh-cw"} size={24} color="white" />
            </TouchableOpacity>

            {activeChallenge && (
                <TouchableOpacity
                    style={[styles.startButton, { marginTop: 16, backgroundColor: 'white', borderWidth: 2, borderColor: '#E5E7EB' }]}
                    onPress={() => {
                        setActiveChallenge(null);
                        setActiveGameId(null); // Clear persistence
                        setChallengeResult(null);
                        setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                        router.push('/sandbox/games/' as any); // Clear params
                    }}
                >
                    <Text style={[styles.startButtonText, { color: '#6B7280' }]}>EXIT TO MENU</Text>
                    <Feather name="menu" size={24} color="#6B7280" />
                </TouchableOpacity>
            )}

            {!activeChallenge && (
                renderGameOverNav()
            )}
        </View>
    );

    const renderGameOverNav = () => (
        <View style={styles.gameOverNavRow}>
            <TouchableOpacity
                style={styles.gameOverNavButton}
                onPress={() => {
                    gameService.stopGame();
                    // Reset to start screen (flag dash menu)
                    setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                    setSelectedGameType(null); // Return to game hub
                }}
            >
                <Feather name="home" size={18} color="#6B7280" />
                <Text style={styles.gameOverNavText}>Game Menu</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.gameOverNavButton}
                onPress={() => {
                    gameService.stopGame();
                    // Reset state first to prevent UI glitches
                    setState(prev => ({ ...prev, gameOver: false, isPlaying: false }));
                    setSelectedGameType(null);
                    // Navigate after state update
                    setTimeout(() => router.push('/' as any), 50);
                }}
            >
                <Feather name="globe" size={18} color="#6B7280" />
                <Text style={styles.gameOverNavText}>Exit</Text>
            </TouchableOpacity>
        </View>
    );

    const renderGame = () => {
        if (!state.currentQuestion) return null;

        return (
            <View style={styles.gameContainer}>
                {/* HUD */}
                <View style={styles.hud}>
                    <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
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
                <View style={styles.card}>
                    {state.currentQuestion.flagUrl ? (
                        <Image
                            source={{ uri: state.currentQuestion.flagUrl }}
                            style={styles.flagImage}
                            contentFit="contain"
                        />
                    ) : (
                        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                            <Feather name="help-circle" size={64} color="#E5E7EB" />
                        </View>
                    )}
                </View>

                <Text style={styles.promptText}>{state.currentQuestion.text || 'Which country is this?'}</Text>

                {/* Options Grid */}
                <View style={styles.optionsGrid}>
                    {state.currentQuestion.options.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={styles.optionButton}
                            onPress={() => handleAnswer(option.id)}
                        >
                            <Text style={styles.optionText}>{option.text}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
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

    // Full-screen Leaderboard Tab
    const renderLeaderboardTab = () => (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            {/* Header */}
            <View style={styles.leaderboardTabHeader}>
                <Text style={styles.leaderboardTabTitle}>🏆 Friend Leaderboard</Text>
                <Text style={styles.leaderboardTabSubtitle}>Best Scores</Text>
            </View>

            {/* Content */}
            {loadingLeaderboard ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>Loading scores...</Text>
                </View>
            ) : leaderboardData.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Feather name="users" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No scores yet!</Text>
                    <Text style={styles.emptySubtext}>Play a game to get on the leaderboard</Text>
                </View>
            ) : (
                <ScrollView style={styles.leaderboardTabList} contentContainerStyle={{ paddingBottom: 20 }}>
                    {leaderboardData.map((entry, index) => (
                        <View key={`${entry.odUid}_${entry.gameType || 'flagdash'}_${index}`} style={styles.leaderboardRow}>
                            <View style={styles.rankBadge}>
                                <Text style={[
                                    styles.rankText,
                                    index === 0 && { color: '#F59E0B' },
                                    index === 1 && { color: '#9CA3AF' },
                                    index === 2 && { color: '#B45309' },
                                ]}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </Text>
                            </View>
                            <Text style={styles.playerName} numberOfLines={1}>
                                {entry.username}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={styles.playerScore}>{entry.score}</Text>
                                <View style={{
                                    backgroundColor: entry.gameType === 'pindrop' ? '#10B981' : '#4F46E5',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '600' }}>
                                        {entry.gameType === 'pindrop' ? '📍' : '🏁'}
                                    </Text>
                                </View>
                                <View style={{
                                    backgroundColor: entry.difficulty === 'easy' ? '#10B981' : entry.difficulty === 'medium' ? '#F59E0B' : '#EF4444',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '600' }}>
                                        {entry.difficulty?.toUpperCase() || 'N/A'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );

    // DEBUG: Log render path
    console.log('[GameSandbox] Render state:', { selectedGameType, gameOver: state.gameOver, isPlaying: state.isPlaying });

    return (
        <SafeAreaView style={styles.container}>
            {/* Pin Drop Full Screen Game */}
            {selectedGameType === 'pindrop' && (
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
            )}

            {/* Hub (Start Screen) - Only show if NO game selected */}
            {!selectedGameType && (
                <>
                    <Stack.Screen options={{ title: '' }} />
                    {renderQuitConfirmationModal()}

                    {/* Animated Tab Container */}
                    <Animated.View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            width: width * 2,
                            transform: [{ translateX: tabTranslateX }],
                        }}
                        {...panResponder.panHandlers}
                    >
                        {/* Home Tab */}
                        <ScrollView
                            style={[styles.content, { width }]}
                            contentContainerStyle={styles.contentContainer}
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
        </SafeAreaView>
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
        padding: isSmallScreen ? 16 : 24,
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
    title: {
        fontSize: isSmallScreen ? 26 : 32,
        fontWeight: '900',
        color: '#111827',
        marginTop: isSmallScreen ? 16 : 24,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 40,
        maxWidth: 260,
    },
    iconCircle: {
        width: isSmallScreen ? 90 : 120,
        height: isSmallScreen ? 90 : 120,
        borderRadius: isSmallScreen ? 45 : 60,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
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



