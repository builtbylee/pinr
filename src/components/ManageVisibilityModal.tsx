import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { updatePinVisibility, getHidePinsFrom, getUserProfile } from '../services/userService';
import { useMemoryStore } from '../store/useMemoryStore';

const { width, height } = require('react-native').Dimensions.get('window');

interface ManageVisibilityModalProps {
    visible: boolean;
    onClose: () => void;
    friends: { uid: string; username: string; avatarUrl?: string; pinColor?: string }[];
}

export const ManageVisibilityModal: React.FC<ManageVisibilityModalProps> = ({ visible, onClose, friends }) => {
    const animation = useSharedValue(0);
    const { currentUserId } = useMemoryStore();
    const [hiddenFriendIds, setHiddenFriendIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Filtered friends based on search
    const filteredFriends = friends.filter(friend =>
        friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Fetch initial hidden list
    useEffect(() => {
        if (visible && currentUserId) {
            animation.value = 1;
            loadHiddenList();
        } else {
            animation.value = 0;
        }
    }, [visible, currentUserId]);

    const loadHiddenList = async () => {
        setIsLoading(true);
        if (currentUserId) {
            const hidden = await getHidePinsFrom(currentUserId);
            setHiddenFriendIds(hidden);
        }
        setIsLoading(false);
    };

    const handleToggleVisibility = async (friendUid: string, currentlyHidden: boolean) => {
        if (!currentUserId) return;

        // Optimistic update
        setHiddenFriendIds(prev =>
            currentlyHidden
                ? prev.filter(id => id !== friendUid)
                : [...prev, friendUid]
        );

        try {
            await updatePinVisibility(currentUserId, friendUid, !currentlyHidden);
        } catch (error: any) {
            if (__DEV__) console.error('Failed to toggle visibility:', error?.message || 'Unknown error');
            // Revert on error
            setHiddenFriendIds(prev =>
                currentlyHidden
                    ? [...prev, friendUid]
                    : prev.filter(id => id !== friendUid)
            );
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { scale: withSpring(0.9 + animation.value * 0.1, { damping: 15, stiffness: 200 }) },
            { translateY: withSpring((1 - animation.value) * 50, { damping: 18, stiffness: 180 }) }
        ]
    }));

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
                                <Text style={styles.title}>Manage Visibility</Text>
                                <Text style={styles.subtitle}>Who can see your pins & journeys</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={18} color="#6B7280" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search friends..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {/* List */}
                        <FlatList
                            data={filteredFriends}
                            keyExtractor={item => item.uid}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>
                                        {searchQuery ? 'No friends found matching search.' : 'No friends yet.'}
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const isHidden = hiddenFriendIds.includes(item.uid);
                                return (
                                    <TouchableOpacity
                                        style={styles.friendRow}
                                        onPress={() => handleToggleVisibility(item.uid, isHidden)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.friendInfo}>
                                            <View style={[styles.avatarContainer, { borderColor: item.pinColor || 'orange', borderWidth: 2 }]}>
                                                {item.avatarUrl ? (
                                                    <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                                                ) : (
                                                    <Feather name="user" size={20} color="#6B7280" />
                                                )}
                                            </View>
                                            <View style={styles.textContainer}>
                                                <Text style={styles.friendName}>{item.username}</Text>
                                                <Text style={[styles.statusText, isHidden && styles.statusTextHidden]}>
                                                    {isHidden ? 'Hidden' : 'Visible'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Toggle Switch Visual */}
                                        <View style={[styles.toggle, isHidden ? styles.toggleOff : styles.toggleOn]}>
                                            <View style={[styles.thumb, isHidden ? styles.thumbOff : styles.thumbOn]} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.bottomBackButton} onPress={onClose}>
                                <Text style={styles.bottomBackButtonText}>Back</Text>
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
        width: width * 0.9,
        height: height * 0.7,
        borderRadius: 24,
        overflow: 'hidden',
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    glassCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
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
        paddingBottom: 20,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
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
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        justifyContent: 'center',
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    statusText: {
        fontSize: 12,
        color: '#34C759', // Green for visible
        marginTop: 2,
    },
    statusTextHidden: {
        color: '#FF3B30', // Red for blocked
    },
    toggle: {
        width: 44,
        height: 24,
        borderRadius: 12,
        padding: 2,
    },
    toggleOn: {
        backgroundColor: '#34C759',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    toggleOff: {
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    thumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    thumbOn: {
        // marginRight: 2,
    },
    thumbOff: {
        // marginLeft: 2,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    footer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    bottomBackButton: {
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32, // Pill shape
    },
    bottomBackButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
});
