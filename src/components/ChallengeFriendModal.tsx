import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

type GameType = 'flagdash' | 'pindrop' | 'travelbattle';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Friend {
    uid: string;
    username: string;
    avatarUrl?: string;
    pinColor?: string;
}

interface ChallengeFriendModalProps {
    visible: boolean;
    onClose: () => void;
    friends: Friend[];
    difficulty: string;
    onSendChallenge: (friend: Friend, gameType: GameType, difficulty: Difficulty) => Promise<void>;
    loadingFriends?: boolean;
}

const GAME_OPTIONS: { id: GameType; name: string; icon: string; color: string }[] = [
    { id: 'flagdash', name: 'Flag Dash', icon: 'flag', color: '#3B82F6' },
    { id: 'pindrop', name: 'Pin Drop', icon: 'map-pin', color: '#EF4444' },
    { id: 'travelbattle', name: 'Travel Battle', icon: 'globe', color: '#F59E0B' },
];

const DIFFICULTY_OPTIONS: { id: Difficulty; name: string; color: string }[] = [
    { id: 'easy', name: 'Easy', color: '#10B981' },
    { id: 'medium', name: 'Medium', color: '#F59E0B' },
    { id: 'hard', name: 'Hard', color: '#EF4444' },
];

export const ChallengeFriendModal: React.FC<ChallengeFriendModalProps> = ({
    visible,
    onClose,
    friends,
    difficulty: initialDifficulty,
    onSendChallenge,
    loadingFriends = false,
}) => {
    const animation = useSharedValue(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
    const [sendingId, setSendingId] = useState<string | null>(null);

    // NEW: Game and difficulty selection state
    const [selectedGame, setSelectedGame] = useState<GameType>('flagdash');
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(
        (initialDifficulty as Difficulty) || 'medium'
    );

    // Filter friends based on search
    const filteredFriends = friends.filter(friend =>
        friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        if (visible) {
            animation.value = 1;
            // Reset state when opening
            setSearchQuery('');
            setInvitedIds(new Set());
            setSendingId(null);
            setSelectedGame('flagdash');
            setSelectedDifficulty((initialDifficulty as Difficulty) || 'medium');
        } else {
            animation.value = 0;
        }
    }, [visible]);

    const handleSendChallenge = async (friend: Friend) => {
        if (invitedIds.has(friend.uid) || sendingId) return;

        setSendingId(friend.uid);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await onSendChallenge(friend, selectedGame, selectedDifficulty);
            setInvitedIds(prev => new Set(prev).add(friend.uid));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Failed to send challenge:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSendingId(null);
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { scale: withSpring(0.9 + animation.value * 0.1, { damping: 15, stiffness: 200 }) },
            { translateY: withSpring((1 - animation.value) * 50, { damping: 18, stiffness: 180 }) }
        ]
    }));

    const getSelectedGameColor = () => {
        return GAME_OPTIONS.find(g => g.id === selectedGame)?.color || '#6366F1';
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* Backdrop */}
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
                    <Animated.View style={[styles.backdrop, { opacity: animation }]} />
                </TouchableOpacity>

                {/* Glass Card */}
                <Animated.View style={[styles.cardContainer, animatedStyle]}>
                    <View style={styles.glassCard}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 20 }}>⚔️</Text>
                                    <Text style={styles.title}>Challenge a Friend</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        {/* Game Type Selection */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionLabel}>GAME</Text>
                            <View style={styles.gameOptionsRow}>
                                {GAME_OPTIONS.map((game) => (
                                    <TouchableOpacity
                                        key={game.id}
                                        style={[
                                            styles.gameOption,
                                            selectedGame === game.id && {
                                                backgroundColor: game.color,
                                                borderColor: game.color,
                                            }
                                        ]}
                                        onPress={() => {
                                            setSelectedGame(game.id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <Feather
                                            name={game.icon as any}
                                            size={16}
                                            color={selectedGame === game.id ? 'white' : '#6B7280'}
                                        />
                                        <Text style={[
                                            styles.gameOptionText,
                                            selectedGame === game.id && styles.gameOptionTextActive
                                        ]}>
                                            {game.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Difficulty Selection */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionLabel}>DIFFICULTY</Text>
                            <View style={styles.difficultyRow}>
                                {DIFFICULTY_OPTIONS.map((diff) => (
                                    <TouchableOpacity
                                        key={diff.id}
                                        style={[
                                            styles.difficultyOption,
                                            selectedDifficulty === diff.id && {
                                                backgroundColor: diff.color,
                                                borderColor: diff.color,
                                            }
                                        ]}
                                        onPress={() => {
                                            setSelectedDifficulty(diff.id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <Text style={[
                                            styles.difficultyText,
                                            selectedDifficulty === diff.id && styles.difficultyTextActive
                                        ]}>
                                            {diff.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider} />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={18} color="#6B7280" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search friends..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Feather name="x-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* List */}
                        {loadingFriends ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#4F46E5" />
                                <Text style={styles.loadingText}>Loading friends...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredFriends}
                                keyExtractor={item => item.uid}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={() => (
                                    <View style={styles.emptyState}>
                                        <Feather name="users" size={48} color="#D1D5DB" />
                                        <Text style={styles.emptyText}>
                                            {searchQuery ? 'No friends match your search' : 'No friends yet'}
                                        </Text>
                                        {!searchQuery && (
                                            <Text style={styles.emptySubtext}>Add friends to challenge them!</Text>
                                        )}
                                    </View>
                                )}
                                renderItem={({ item }) => {
                                    const isInvited = invitedIds.has(item.uid);
                                    const isSending = sendingId === item.uid;

                                    return (
                                        <View style={styles.friendRow}>
                                            <View style={styles.friendInfo}>
                                                <View style={[styles.avatarContainer, { borderColor: item.pinColor || '#6366F1' }]}>
                                                    {item.avatarUrl ? (
                                                        <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                                                    ) : (
                                                        <Feather name="user" size={20} color="#6B7280" />
                                                    )}
                                                </View>
                                                <Text style={styles.friendName}>{item.username}</Text>
                                            </View>

                                            {/* Invite Button */}
                                            <TouchableOpacity
                                                style={[
                                                    styles.inviteButton,
                                                    isInvited && styles.inviteButtonSent,
                                                    !isInvited && { backgroundColor: getSelectedGameColor() }
                                                ]}
                                                onPress={() => handleSendChallenge(item)}
                                                disabled={isInvited || isSending}
                                            >
                                                {isSending ? (
                                                    <ActivityIndicator size="small" color="white" />
                                                ) : isInvited ? (
                                                    <>
                                                        <Feather name="check" size={16} color="white" />
                                                        <Text style={styles.inviteButtonText}>Sent</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Feather name="send" size={16} color="white" />
                                                        <Text style={styles.inviteButtonText}>Invite</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }}
                            />
                        )}

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.bottomBackButton} onPress={onClose}>
                                <Text style={styles.bottomBackButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cardContainer: {
        width: width * 0.92,
        height: height * 0.8,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    glassCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    closeButton: {
        padding: 4,
    },
    sectionContainer: {
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1,
        marginBottom: 8,
    },
    gameOptionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    gameOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: '#F3F4F6',
    },
    gameOptionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
    gameOptionTextActive: {
        color: 'white',
    },
    difficultyRow: {
        flexDirection: 'row',
        gap: 8,
    },
    difficultyOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: '#F3F4F6',
    },
    difficultyText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    difficultyTextActive: {
        color: 'white',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1a1a1a',
    },
    listContent: {
        paddingBottom: 10,
        flexGrow: 1,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
        borderWidth: 2,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    friendName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        flex: 1,
    },
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#6366F1',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        minWidth: 85,
        justifyContent: 'center',
    },
    inviteButtonSent: {
        backgroundColor: '#10B981',
    },
    inviteButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#6B7280',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '500',
    },
    emptySubtext: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    footer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    bottomBackButton: {
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    bottomBackButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4B5563',
    },
});
