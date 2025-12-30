import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useMemoryStore } from '../store/useMemoryStore';
import { toggleHiddenFriend, getUserProfile, BucketListItem, addToBucketList, removeFromBucketList, updateBucketListStatus } from '../services/userService';
import { CountryPickerModal } from './CountryPickerModal';
import { EditProfileModal } from './EditProfileModal';
import { Country, COUNTRIES } from '../data/countries';
import { BucketListActionModal } from './BucketListActionModal';

const { width, height } = Dimensions.get('window');

const PIN_COLOR_MAP: Record<string, string> = {
    magenta: '#FF00FF',
    orange: '#FF8C00',
    green: '#22CC66',
    blue: '#0066FF',
    cyan: '#00DDDD',
    red: '#FF3333',
    black: '#1A1A1A',
    purple: '#8B5CF6',
    silver: '#C0C0C0',
    white: '#FFFFFF',
};

interface ProfileModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string | null;
    onFilterMap?: (userId: string) => void;
    onPlayStory?: (userId: string, story?: Story) => void;
    // Settings callbacks (for own profile)
    onEditUsername?: () => void;
    onEditAvatar?: () => void;
    onPinColorChange?: (color: string) => void;
    onOpenSettings?: () => void;
    onViewBucketListItem?: (location: any) => void;
}

import { storyService, Story } from '../services/StoryService';
import { StoryEditorModal } from './StoryEditorModal';
import { ScrollView, Alert } from 'react-native';

export const ProfileModal: React.FC<ProfileModalProps> = ({
    visible,
    onClose,
    userId,
    onFilterMap,
    onPlayStory,
    onEditUsername,
    onEditAvatar,
    onPinColorChange,
    onOpenSettings,
    onViewBucketListItem
}) => {
    // Animation state
    const animation = useSharedValue(0);
    const insets = useSafeAreaInsets();

    // Get user data and pins from store
    const memories = useMemoryStore(state => state.memories);

    // If we are looking at OURSELVES:
    const currentUserId = useMemoryStore(state => state.currentUserId);
    const myUsername = useMemoryStore(state => state.username);
    const myAvatar = useMemoryStore(state => state.avatarUri);
    const myBio = useMemoryStore(state => state.bio);
    const myPinColor = useMemoryStore(state => state.pinColor);
    const hiddenFriendIds = useMemoryStore(state => state.hiddenFriendIds);
    const toggleHiddenFriendLocal = useMemoryStore(state => state.toggleHiddenFriend);

    const isMe = userId === currentUserId;

    // State for fetched friend profile
    const [friendUsername, setFriendUsername] = useState<string | null>(null);
    const [friendAvatar, setFriendAvatar] = useState<string | null>(null);
    const [friendPinColor, setFriendPinColor] = useState<string>('orange');
    const [myFetchedPinColor, setMyFetchedPinColor] = useState<string | null>(null); // Fetched from Firestore for own profile
    const [friendBio, setFriendBio] = useState<string | null>(null);
    const [friendHidePinsFrom, setFriendHidePinsFrom] = useState<string[]>([]);

    // Bucket List State (was Triplist)
    const [bucketList, setBucketList] = useState<BucketListItem[]>([]);
    const [selectedBucketItem, setSelectedBucketItem] = useState<BucketListItem | null>(null);

    // Refresh key to force re-fetch when profile is edited
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch profile data
    useEffect(() => {
        if (visible && userId) {
            getUserProfile(userId).then(profile => {
                if (profile) {
                    if (!isMe) {
                        setFriendUsername(profile.username);
                        setFriendAvatar(profile.avatarUrl || null);
                        // Normalize pinColor to lowercase for consistent lookup
                        setFriendPinColor((profile.pinColor || 'orange').toLowerCase().trim());
                        setFriendBio(profile.bio || null);
                        setFriendHidePinsFrom(profile.hidePinsFrom || []);
                    } else {
                        // For own profile, fetch pinColor from Firestore to ensure consistency
                        if (profile.pinColor) {
                            // Normalize pinColor to lowercase for consistent lookup
                            const normalizedColor = profile.pinColor.toLowerCase().trim();
                            setMyFetchedPinColor(normalizedColor);
                            useMemoryStore.getState().setPinColor(normalizedColor);
                        }
                    }
                    // Load Bucket List (fallback to triplist if migration needed, but for now just bucketList)
                    setBucketList(profile.bucketList || []);

                    // Streak (Only relevant to display? Maybe add to stats)
                }
            });
        }
    }, [visible, userId, isMe, refreshKey]);

    // Stories Logic
    const [stories, setStories] = useState<Story[]>([]);
    const [isStoryEditorVisible, setIsStoryEditorVisible] = useState(false);
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
    const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

    useEffect(() => {
        if (visible && userId) {
            const unsubscribe = storyService.subscribeToUserStories(userId, setStories);
            return () => unsubscribe();
        }
    }, [visible, userId]);

    // Button Handlers
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
    const userPins = useMemo(() => {
        if (!userId) return [];
        // Privacy Check: If this is a friend's profile, and they hide pins from me, show nothing.
        if (!isMe && currentUserId && friendHidePinsFrom.includes(currentUserId)) {
            return [];
        }
        return memories.filter(m => m.creatorId === userId);
    }, [userId, memories, isMe, currentUserId, friendHidePinsFrom]);

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


    // ... Stats Calculation ...
    // Determine display values
    let displayUsername = isMe ? myUsername : (friendUsername || 'Loading...');
    let displayAvatar = isMe ? myAvatar : friendAvatar;
    // Default to white ring if no avatar is set (placeholder look), otherwise use selected color
    // For own profile, prefer Firestore-fetched value over Zustand for consistency
    const effectivePinColor = isMe ? (myFetchedPinColor || myPinColor || 'orange') : (friendPinColor || 'orange');
    const colorKey = (effectivePinColor || 'orange').toLowerCase().trim();
    const mappedColor = PIN_COLOR_MAP[colorKey];
    console.log('[DEBUG] ProfileModal themeColor lookup:', { isMe, myPinColor, myFetchedPinColor, effectivePinColor, colorKey, mappedColor, hasMappedColor: !!mappedColor });
    let themeColor = displayAvatar
        ? (mappedColor || '#FF8C00')
        : '#FFFFFF';

    // Stats
    const pinCount = userPins.length;
    // Visited Countries: Pins + BucketList visited
    const countryCount = useMemo(() => {
        const unique = new Set<string>();
        // From Pins
        userPins.forEach(p => {
            if (p.locationName) {
                const parts = p.locationName.split(',');
                if (parts.length > 0) unique.add(parts[parts.length - 1].trim());
            }
        });
        // From Bucket List (Visited)
        bucketList.filter(b => b.status === 'visited' && b.countryName).forEach(b => unique.add(b.countryName!));
        return unique.size;
    }, [userPins, bucketList]);

    // Streak Stat (Need to fetch from profile or store?)
    // Basic approach: we fetched profile above. But we didn't store streak in state.
    // Let's add streak state.
    const [streak, setStreak] = useState(0);
    useEffect(() => {
        if (userId) getUserProfile(userId).then(p => setStreak(p?.streak?.current || 0));
    }, [userId, visible]);


    // Animation Logic
    useEffect(() => {
        if (visible) animation.value = 1;
        else animation.value = 0;
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20 }),
        transform: [{ scale: withSpring(0.9 + animation.value * 0.1) }, { translateY: withSpring((1 - animation.value) * 50) }]
    }));


    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
                <Animated.View style={[styles.backdrop, { opacity: animation }]} />
            </TouchableOpacity>

            <Animated.View style={[styles.cardContainer, animatedStyle, { marginTop: insets.top + 10, maxHeight: height - insets.top - insets.bottom - 40 }]}>
                {/* Fixed Header Buttons - Outside ScrollView */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 }}>
                    {isMe ? (
                        <TouchableOpacity onPress={onOpenSettings}>
                            <Feather name="settings" size={22} color="rgba(0,0,0,0.5)" />
                        </TouchableOpacity>
                    ) : <View style={{ width: 22 }} />}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {isMe && (
                            <TouchableOpacity onPress={() => setIsEditProfileVisible(true)}>
                                <Feather name="edit-2" size={22} color="rgba(0,0,0,0.5)" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} testID="profile-close-button">
                            <Feather name="x" size={24} color="rgba(0,0,0,0.5)" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View
                    style={[styles.glassCard, { backgroundColor: 'rgba(255,255,255,0.95)', paddingTop: 50, alignItems: 'center', paddingBottom: 16 }]}
                >

                    {/* ===== FIXED TOP SECTION ===== */}

                    {/* Avatar */}
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
                        {/* Streak Badge */}
                        {streak > 0 && (
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF4500', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: 'white' }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>🔥 {streak}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={styles.username}>{displayUsername || 'Unknown'}</Text>
                        {(isMe ? myBio : friendBio) && <Text style={styles.bio}>{isMe ? myBio : friendBio}</Text>}
                    </View>

                    {/* Stats */}
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
                            <Text style={styles.statValue}>{streak}</Text>
                            <Text style={styles.statLabel}>Explore Streak</Text>
                        </View>
                    </View>

                    {/* View Pins Button - Moved to fixed section */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 16, paddingHorizontal: 16 }}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton, { flex: 1 }]}
                            onPress={handleFilter}
                        >
                            <Feather name="globe" size={20} color="#1a1a1a" />
                            <Text style={styles.secondaryButtonText}>View Pins</Text>
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

                    {/* ===== SCROLLABLE TILES SECTION ===== */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 0, marginBottom: 16 }}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    >
                        {/* Bucket List Items */}
                        {bucketList.map((item, index) => (
                            <TouchableOpacity
                                key={`bucket-${index}`}
                                style={styles.storyCard}
                                onPress={() => setSelectedBucketItem(item)}
                            >
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.storyCover} contentFit="cover" />
                                ) : (
                                    <View style={[styles.storyCover, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Feather name="map-pin" size={24} color="#ccc" />
                                    </View>
                                )}
                                <View style={[
                                    styles.statusPill,
                                    item.status === 'booked' ? styles.pillBooked :
                                        item.status === 'visited' ? styles.pillVisited : styles.pillWishlist
                                ]}>
                                    <Text style={[
                                        styles.statusPillText,
                                        (item.status === 'booked' || item.status === 'visited') ? { color: 'white' } : { color: '#1F2937' }
                                    ]}>
                                        {item.status === 'visited' ? 'Visited' : item.status === 'booked' ? 'Booked' : 'Wishlist'}
                                    </Text>
                                </View>
                                <View style={styles.storyOverlay}>
                                    <Text style={styles.storyTitle} numberOfLines={2}>{item.locationName}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {/* Journey Stories */}
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

                        {/* Empty State if no items */}
                        {bucketList.length === 0 && stories.length === 0 && (
                            <View style={[styles.emptyStoryCard, { width: 120, height: 160 }]}>
                                <Feather name="map" size={24} color="#ccc" />
                                <Text style={styles.emptyStoryText}>Explore to add</Text>
                            </View>
                        )}
                    </ScrollView>

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
                        const newItems: BucketListItem[] = [];

                        countries.forEach(country => {
                            // Avoid adding duplicates on client side check
                            // Note: bucketList check might fail if locationName doesn't exactly match countryName, 
                            // but for CountryPicker, locationName IS countryName.
                            if (!bucketList.some(b => b.locationName === country.countryName)) {
                                const newItem: BucketListItem = {
                                    locationName: country.countryName,
                                    countryName: country.countryName,
                                    countryCode: country.countryCode,
                                    location: [0, 0], // Placeholder, or we could look up country coords from COUNTRIES if added
                                    status: country.status, // Directly use status from picker ('wishlist' | 'visited')
                                    addedAt: Date.now(),
                                    // imageUrl: NO image for simple country add, unless we fetch it.
                                };
                                newItems.push(newItem);
                                addToBucketList(currentUserId, newItem);
                            }
                        });

                        if (newItems.length > 0) {
                            // Optimistic update
                            setBucketList(prev => [...prev, ...newItems]);
                        }
                        setIsCountryPickerVisible(false);
                    }
                }}
            />



            {/* Edit Profile Modal - only for own profile */}
            <EditProfileModal
                visible={isEditProfileVisible}
                onClose={() => {
                    setIsEditProfileVisible(false);
                    // Force re-fetch profile to get updated pinColor
                    setRefreshKey(prev => prev + 1);
                }}
                username={myUsername}
                avatarUri={myAvatar}
                bio={myBio}
                pinColor={myPinColor}
                onEditUsername={() => {
                    setIsEditProfileVisible(false);
                    onEditUsername?.();
                }}
                onEditAvatar={() => {
                    setIsEditProfileVisible(false);
                    onEditAvatar?.();
                }}
            />
            {/* Bucket List Action Modal */}
            <BucketListActionModal
                visible={!!selectedBucketItem}
                onClose={() => setSelectedBucketItem(null)}
                item={selectedBucketItem}
                isOwner={userId === currentUserId}
                onView={(item) => {
                    setSelectedBucketItem(null);
                    onClose(); // Close profile modal too
                    onViewBucketListItem?.(item);
                }}
                onMarkBooked={async (item) => {
                    if (!currentUserId) return;

                    // Toggle: if already booked, set back to wishlist; otherwise mark as booked
                    const newStatus = item.status === 'booked' ? 'wishlist' : 'booked';

                    try {
                        await updateBucketListStatus(currentUserId, item.locationName, newStatus);

                        // Optimistic update for immediate UI feedback
                        setBucketList(prev => prev.map(b =>
                            b.locationName === item.locationName
                                ? { ...b, status: newStatus }
                                : b
                        ));

                        // Update the selected item so modal shows new state
                        setSelectedBucketItem({ ...item, status: newStatus });
                    } catch (error) {
                        console.error('Failed to update booked status:', error);
                        Alert.alert('Error', 'Could not update status.');
                    }
                }}
                onRemove={(item) => {
                    Alert.alert(
                        "Remove from Bucket List?",
                        `Are you sure you want to remove ${item.locationName}?`,
                        [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Remove",
                                style: "destructive",
                                onPress: async () => {
                                    if (currentUserId) {
                                        await removeFromBucketList(currentUserId, item);
                                        setBucketList(prev => prev.filter(b => b.locationName !== item.locationName));
                                        setSelectedBucketItem(null);
                                    }
                                }
                            }
                        ]
                    );
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
        backgroundColor: 'transparent',
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
    settingsButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 8,
        zIndex: 100,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
        zIndex: 100,
    },
    editButton: {
        position: 'absolute',
        top: 16,
        right: 60, // Left of close button
        padding: 8,
        zIndex: 100,
    },
    avatarContainer: {
        marginBottom: 16,
        marginTop: 24, // Clear the top buttons
        zIndex: 1,
    },
    avatarRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        padding: 4,
        borderColor: '#FF8C00', // Default, dynamic override inline
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
        color: '#1a1a1a',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    bio: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
        textAlign: 'center',
        marginTop: 4,
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
        // Responsive tile size: smaller on narrow screens
        width: width < 380 ? 100 : 120,
        height: width < 380 ? 130 : 160,
        borderRadius: 14,
        marginRight: width < 380 ? 8 : 12,
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
        marginTop: -20,
        marginBottom: 2,
    },
    tripName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    bookedBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        right: 6,
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 6,
        backgroundColor: '#22CC66',
        alignItems: 'center',
    },
    bookedBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: 'white',
    },
    wishlistBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        right: 6,
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 6,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    wishlistBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#6B7280',
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
    // Floating Pill Styles
    statusPill: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    pillBooked: {
        backgroundColor: '#10B981', // Emerald 500
    },
    pillVisited: {
        backgroundColor: '#3B82F6', // Blue 500
    },
    pillWishlist: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '700',
    },
});
