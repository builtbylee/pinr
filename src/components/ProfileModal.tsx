import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useMemoryStore } from '../store/useMemoryStore';
import { toggleHiddenFriend, getUserProfile, TripListItem, addToTriplist, removeFromTriplist, updateTriplistStatus } from '../services/userService';
import { CountryPickerModal } from './CountryPickerModal';
import { Country, COUNTRIES } from '../data/countries';

const { width, height } = Dimensions.get('window');

const PIN_COLOR_MAP: Record<string, string> = {
    magenta: '#FF00FF',
    orange: '#FF8C00',
    green: '#22CC66',
    blue: '#0066FF',
    cyan: '#00DDDD',
    red: '#FF3333',
};

interface ProfileModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string | null;
    onFilterMap?: (userId: string) => void;
    onPlayStory?: (userId: string, story?: Story) => void;
}

import { storyService, Story } from '../services/StoryService';
import { StoryEditorModal } from './StoryEditorModal';
import { ScrollView, Alert } from 'react-native';

export const ProfileModal: React.FC<ProfileModalProps> = ({
    visible,
    onClose,
    userId,
    onFilterMap,
    onPlayStory
}) => {
    // Animation state
    const animation = useSharedValue(0);

    // Get user data and pins from store
    const memories = useMemoryStore(state => state.memories);

    // If we are looking at OURSELVES:
    const currentUserId = useMemoryStore(state => state.currentUserId);
    const myUsername = useMemoryStore(state => state.username);
    const myAvatar = useMemoryStore(state => state.avatarUri);
    const myPinColor = useMemoryStore(state => state.pinColor);
    const { hiddenFriendIds, toggleHiddenFriend: toggleHiddenFriendLocal } = useMemoryStore();

    const isMe = userId === currentUserId;

    // State for fetched friend profile
    const [friendUsername, setFriendUsername] = useState<string | null>(null);
    const [friendAvatar, setFriendAvatar] = useState<string | null>(null);
    const [friendPinColor, setFriendPinColor] = useState<string>('magenta');

    // Triplist State
    const [triplist, setTriplist] = useState<TripListItem[]>([]);
    const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

    // Fetch profile data (including triplist)
    useEffect(() => {
        if (visible && userId) {
            getUserProfile(userId).then(profile => {
                if (profile) {
                    if (!isMe) {
                        setFriendUsername(profile.username);
                        setFriendAvatar(profile.avatarUrl || null);
                        setFriendPinColor(profile.pinColor || 'magenta');
                    }
                    // Set triplist for both me and friend
                    setTriplist(profile.triplist || []);
                }
            });
        }
    }, [visible, userId, isMe]);

    // Stories Logic
    const [stories, setStories] = useState<Story[]>([]);
    const [isStoryEditorVisible, setIsStoryEditorVisible] = useState(false);
    const [editingStory, setEditingStory] = useState<Story | null>(null);

    useEffect(() => {
        if (visible && userId) {
            const unsubscribe = storyService.subscribeToUserStories(userId, setStories);
            return () => unsubscribe();
        }
    }, [visible, userId]);

    const handleCreateStory = () => {
        setEditingStory(null);
        setIsStoryEditorVisible(true);
    };

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setIsStoryEditorVisible(true);
    };

    const handleDeleteStory = (storyId: string) => {
        Alert.alert('Delete Story', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => storyService.deleteStory(storyId)
            }
        ]);
    };

    // 1. Try to find user info from memories (most reliable for avatar/name of creator if not me)
    const userPins = useMemo(() =>
        userId ? memories.filter(m => m.creatorId === userId) : [],
        [userId, memories]);

    // Determine display values - use fetched friend profile for non-self users
    let displayUsername = isMe ? myUsername : (friendUsername || 'Loading...');
    let displayAvatar = isMe ? myAvatar : friendAvatar;
    let displayPinColorName = isMe ? myPinColor : friendPinColor;

    // Resolve hex color
    const themeColor = PIN_COLOR_MAP[displayPinColorName] || '#FF00FF';

    // STATS
    const pinCount = userPins.length;
    // Rough country count based on unique location text (imperfect but functional for now)
    const countryCount = useMemo(() => {
        const uniqueLocations = new Set();
        userPins.forEach(p => {
            if (p.locationName) {
                const parts = p.locationName.split(',');
                if (parts.length > 0) {
                    uniqueLocations.add(parts[parts.length - 1].trim());
                }
            }
        });
        return uniqueLocations.size;
    }, [userPins]);


    // Animation Logic
    useEffect(() => {
        if (visible) {
            animation.value = 1;
        } else {
            animation.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { scale: withSpring(0.9 + animation.value * 0.1, { damping: 15, stiffness: 200 }) },
            { translateY: withSpring((1 - animation.value) * 50, { damping: 18, stiffness: 180 }) }
        ]
    }));

    // Wire up buttons
    const handleFilter = () => {
        if (userId && onFilterMap) {
            onFilterMap(userId);
            onClose(); // Close modal so user can see the filtered map
        }
    };

    const handlePlay = (story?: Story) => {
        if (userId && onPlayStory) {
            onPlayStory(userId, story);
            onClose();
        }
    };

    const handleToggleHide = async () => {
        if (!userId || !currentUserId || isMe) return;

        const isHidden = hiddenFriendIds.includes(userId);
        toggleHiddenFriendLocal(userId); // Optimistic
        try {
            await toggleHiddenFriend(currentUserId, userId, !isHidden);
        } catch (error) {
            console.error('Failed to toggle hide pins:', error);
            toggleHiddenFriendLocal(userId); // Revert on error
        }
    };

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop tap to close */}
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
                <Animated.View style={[styles.backdrop, { opacity: animation }]} />
            </TouchableOpacity>

            {/* Glass Card */}
            <Animated.View style={[styles.cardContainer, animatedStyle]}>
                <View style={[styles.glassCard, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>

                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Feather name="x" size={24} color="rgba(0,0,0,0.5)" />
                    </TouchableOpacity>

                    {/* Avatar - Half in/out */}
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarRing, { borderColor: themeColor }]}>
                            {displayAvatar ? (
                                <Image source={{ uri: displayAvatar }} style={styles.avatar} contentFit="cover" />
                            ) : (
                                <View style={[styles.avatar, styles.placeholderAvatar]}>
                                    <Feather name="user" size={40} color="rgba(0,0,0,0.3)" />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* User Info */}
                    <View style={styles.infoContainer}>
                        <Text style={styles.username}>{displayUsername || 'Unknown'}</Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{isMe ? 'You' : 'Traveller'}</Text>
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{countryCount}</Text>
                            <Text style={styles.statLabel}>Countries</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{pinCount}</Text>
                            <Text style={styles.statLabel}>Pins</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{new Date().getFullYear()}</Text>
                            <Text style={styles.statLabel}>Active Since</Text>
                        </View>
                    </View>

                    {/* TRIPLIST SECTION */}
                    <View style={styles.storiesSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Triplist</Text>
                            {isMe && (
                                <TouchableOpacity onPress={() => setIsCountryPickerVisible(true)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="plus" size={14} color="#4F46E5" />
                                        <Text style={[styles.createStoryText, { marginLeft: 4 }]}>Add</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesList} contentContainerStyle={{ paddingRight: 16 }}>
                            {/* List Items - Filter out any corrupted entries (missing code/name) */}
                            {triplist
                                .filter(item => item.countryCode && item.countryName)
                                .map(item => (
                                    <TouchableOpacity
                                        key={item.countryCode}
                                        style={[styles.tripCard, item.status === 'booked' && styles.tripCardBooked]}
                                        onPress={() => {
                                            if (!isMe) return;
                                            Alert.alert(
                                                item.countryName,
                                                'Update status or remove?',
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: item.status === 'wishlist' ? 'Mark as Booked 🎟️' : 'Mark as Wishlist 💭',
                                                        onPress: () => {
                                                            const newStatus = item.status === 'wishlist' ? 'booked' : 'wishlist';
                                                            updateTriplistStatus(currentUserId!, item.countryCode, newStatus);
                                                            // Optimistic update
                                                            setTriplist(prev => prev.map(p => p.countryCode === item.countryCode ? { ...p, status: newStatus } : p));
                                                        }
                                                    },
                                                    {
                                                        text: 'Remove',
                                                        style: 'destructive',
                                                        onPress: () => {
                                                            removeFromTriplist(currentUserId!, item.countryCode);
                                                            setTriplist(prev => prev.filter(p => p.countryCode !== item.countryCode));
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.tripFlag}>{COUNTRIES.find(c => c.code === item.countryCode)?.flag || '🏳️'}</Text>
                                        <Text style={styles.tripName} numberOfLines={1}>{item.countryName}</Text>
                                        {item.status === 'booked' ? (
                                            <View style={styles.bookedBadge}>
                                                <Feather name="check" size={10} color="white" />
                                            </View>
                                        ) : (
                                            <View style={styles.wishlistBadge}>
                                                <Feather name="bookmark" size={10} color="white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}

                            {/* Empty State / Add Button for Me */}
                            {isMe && triplist.length === 0 && (
                                <TouchableOpacity
                                    style={styles.emptyTripCard}
                                    onPress={() => setIsCountryPickerVisible(true)}
                                >
                                    <Feather name="plus-circle" size={24} color="#ccc" />
                                    <Text style={styles.emptyStoryText}>Add Country</Text>
                                </TouchableOpacity>
                            )}
                            {!isMe && triplist.length === 0 && (
                                <View style={styles.emptyTripCard}>
                                    <Text style={styles.emptyStoryText}>No plans yet</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    {/* Stories Section */}
                    {(stories.length > 0 || isMe) && (
                        <View style={styles.storiesSection}>
                            <View style={styles.sectionHeader}>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesList}>
                                {stories.map(story => {
                                    const coverPin = userPins.find(p => p.id === story.coverPinId) || userPins.find(p => p.id === story.pinIds[0]);
                                    return (
                                        <TouchableOpacity
                                            key={story.id}
                                            style={styles.storyCard}
                                            onPress={() => handlePlay(story)}
                                            onLongPress={() => isMe && handleEditStory(story)}
                                        >
                                            <Image
                                                source={{ uri: coverPin?.imageUris?.[0] || 'https://via.placeholder.com/150' }}
                                                style={styles.storyCover}
                                            />
                                            <View style={styles.storyOverlay}>
                                                <Text style={styles.storyTitle} numberOfLines={1}>{story.title}</Text>
                                                <Text style={styles.storyCount}>{story.pinIds.length} Pins</Text>
                                            </View>
                                            {isMe && (
                                                <TouchableOpacity
                                                    style={styles.deleteStoryBtn}
                                                    onPress={() => handleDeleteStory(story.id)}
                                                >
                                                    <Feather name="x" size={12} color="white" />
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}

                            </ScrollView>
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actionsContainer}>


                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={handleFilter}
                        >
                            <Feather name="globe" size={20} color="#1a1a1a" />
                            <Text style={styles.secondaryButtonText} numberOfLines={1} adjustsFontSizeToFit>Map View</Text>
                        </TouchableOpacity>

                        {!isMe && userId && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.secondaryButton, styles.iconOnlyButton]}
                                onPress={handleToggleHide}
                            >
                                <Feather
                                    name={hiddenFriendIds.includes(userId) ? 'eye-off' : 'eye'}
                                    size={22}
                                    color={hiddenFriendIds.includes(userId) ? '#999' : '#1a1a1a'}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                </View>
            </Animated.View >

            {/* Story Editor (Nested Modal) */}
            {
                isStoryEditorVisible && isMe && currentUserId && (
                    <StoryEditorModal
                        visible={isStoryEditorVisible}
                        onClose={() => setIsStoryEditorVisible(false)}
                        currentUserId={currentUserId}
                        existingStory={editingStory}
                        userPins={userPins}
                    />
                )
            }

            {/* Country Picker Modal */}
            <CountryPickerModal
                visible={isCountryPickerVisible}
                onClose={() => setIsCountryPickerVisible(false)}
                onSelect={(countries) => {
                    if (currentUserId && countries.length > 0) {
                        const newItems: TripListItem[] = [];

                        countries.forEach(country => {
                            // Avoid adding duplicates on client side check (Service also checks)
                            if (!triplist.some(t => t.countryCode === country.countryCode)) {
                                const newItem: TripListItem = {
                                    countryCode: country.countryCode,
                                    countryName: country.countryName,
                                    status: country.status || 'wishlist',
                                    addedAt: Date.now(),
                                };
                                newItems.push(newItem);
                                addToTriplist(currentUserId, newItem); // Fire and forget (or could await all)
                            }
                        });

                        if (newItems.length > 0) {
                            // Optimistic update
                            setTriplist(prev => [...prev, ...newItems]);
                        }
                        setIsCountryPickerVisible(false);
                    }
                }}
            />
        </View >
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50, // Above map
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cardContainer: {
        width: width * 0.90,
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    glassCard: {
        width: '100%',
        paddingVertical: 30,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255, 0.95)', // Solid card
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
        zIndex: 10,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatarRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        padding: 4,
        borderColor: '#FF00FF', // Default, dynamic override inline
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 50, // Inner is fully rounded
        backgroundColor: '#e0e0e0', // Light placeholder
    },
    placeholderAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    infoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a', // Dark text
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)', // Light badge
    },
    statusText: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 32,
        paddingHorizontal: 12,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a', // Dark text
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)', // Darker muted
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(0,0,0,0.1)', // Light divider
    },
    actionsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 6,
    },
    primaryButton: {
        backgroundColor: '#00DDDD', // overridden inline
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    secondaryButtonText: {
        color: '#1a1a1a',
        fontWeight: '600',
        fontSize: 14,
    },
    iconOnlyButton: {
        flex: 0,
        width: 50,
        paddingHorizontal: 0,
    },
    // Stories Styles
    storiesSection: {
        width: '100%',
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    createStoryText: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    storiesList: {
        paddingHorizontal: 4,
    },
    storyCard: {
        width: 120,
        height: 160,
        borderRadius: 16,
        marginRight: 12,
        overflow: 'hidden',
        backgroundColor: '#eee',
        position: 'relative',
    },
    storyCover: {
        width: '100%',
        height: '100%',
    },
    storyOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    storyTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    storyCount: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
    },
    emptyStoryCard: {
        width: 120,
        height: 160,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#eee',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    emptyStoryText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginTop: 8,
    },
    deleteStoryBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Triplist Styles
    tripCard: {
        width: 100,
        height: 100,
        borderRadius: 16,
        backgroundColor: '#f8f8f8',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    tripCardBooked: {
        borderColor: '#22CC66', // Green border for booked
        borderWidth: 2,
        backgroundColor: '#f0fdf4',
    },
    tripFlag: {
        fontSize: 32,
        marginBottom: 8,
    },
    tripName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    bookedBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#22CC66',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'white',
    },
    wishlistBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#4F46E5', // Indigo
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'white',
    },
    emptyTripCard: {
        width: 100,
        height: 100,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#eee',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
});
