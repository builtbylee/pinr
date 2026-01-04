import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
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
    onViewPin?: (pinId: string, location: [number, number]) => void;
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
    onViewBucketListItem,
    onViewPin
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

    // Tab state for Android tabbed layout
    const [activeTab, setActiveTab] = useState<'pins' | 'journeys' | 'bucketlist'>('pins');
    const tabScrollViewRef = useRef<ScrollView>(null);
    // Calculated width of the tab content area: Card Width (90%) - GlassCard Padding (32)
    const modalContentWidth = width * 0.90 - 32;

    const handleTabPress = (tab: 'pins' | 'journeys' | 'bucketlist') => {
        setActiveTab(tab);
        const index = tab === 'pins' ? 0 : tab === 'journeys' ? 1 : 2;
        tabScrollViewRef.current?.scrollTo({ x: index * modalContentWidth, animated: true });
    };

    const handleTabScroll = (event: any) => {
        const x = event.nativeEvent.contentOffset.x;
        const index = Math.round(x / modalContentWidth);
        const newTab = index === 0 ? 'pins' : index === 1 ? 'journeys' : 'bucketlist';
        if (newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

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
                    // Load Bucket List (fallback to legacy 'triplist' if present)
                    // @ts-ignore - 'triplist' is legacy field
                    const legacyList = profile.triplist as BucketListItem[] | undefined;
                    setBucketList(profile.bucketList || legacyList || []);

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
                onPress: async () => {
                    // Optimistic update to immediately remove from UI
                    setStories(prev => prev.filter(s => s.id !== storyId));
                    await storyService.deleteStory(storyId);
                }
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

            <Animated.View style={[
                styles.cardContainer,
                animatedStyle,
                {
                    marginTop: insets.top + 10,
                    // On Android, we need a fixed height for the flex:1 children to expand
                    height: Platform.OS === 'android' ? height - insets.top - insets.bottom - 40 : undefined,
                    maxHeight: height - insets.top - insets.bottom - 40
                }
            ]}>
                {/* Fixed Header Buttons - Outside ScrollView */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 }}>
                    {isMe ? (
                        <TouchableOpacity onPress={onOpenSettings} testID="profile-settings-button">
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


                    {/* FIXED TOP SECTION */}

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

                    {/* ===== ANDROID: TABBED LAYOUT ===== */}
                    {Platform.OS === 'android' ? (
                        <>
                            {/* Tab Bar */}
                            <View style={styles.tabBar}>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'pins' && styles.activeTab]}
                                    onPress={() => handleTabPress('pins')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'pins' && styles.activeTabText]}>Pins</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'journeys' && styles.activeTab]}
                                    onPress={() => handleTabPress('journeys')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'journeys' && styles.activeTabText]}>Journeys</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'bucketlist' && styles.activeTab]}
                                    onPress={() => handleTabPress('bucketlist')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'bucketlist' && styles.activeTabText]}>Bucket List</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Tab Content - Swipeable Horizontal Pager */}
                            <ScrollView
                                ref={tabScrollViewRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={handleTabScroll}
                                style={{ flex: 1, width: '100%' }}
                            >
                                {/* PINS TAB */}
                                <ScrollView style={{ width: modalContentWidth }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                                    <View style={styles.gridContainer}>
                                        {userPins.length > 0 ? (
                                            userPins.map((pin, index) => (
                                                <Pressable
                                                    key={`pin-${pin.id || index}`}
                                                    style={({ pressed }) => [
                                                        styles.gridCard,
                                                        Platform.OS === 'ios' && pressed && { opacity: 0.7 }
                                                    ]}
                                                    android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                                                    onPress={() => {
                                                        if (onViewPin && pin.location) {
                                                            onViewPin(pin.id, pin.location);
                                                        } else {
                                                            handleFilter();
                                                        }
                                                    }}
                                                >
                                                    {pin.imageUris?.[0] ? (
                                                        <Image source={{ uri: pin.imageUris[0] }} style={styles.gridCardImage} contentFit="cover" />
                                                    ) : (
                                                        <View style={[styles.gridCardImage, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
                                                            <Feather name="map-pin" size={24} color="#ccc" />
                                                        </View>
                                                    )}
                                                    <View style={styles.gridCardOverlay}>
                                                        {/* Floating Pill Title */}
                                                        {Platform.OS === 'ios' ? (
                                                            <BlurView style={styles.gridCardTitleContainer} intensity={30} tint="dark">
                                                                <Text style={styles.gridCardTitle} numberOfLines={2}>{pin.title || pin.locationName}</Text>
                                                            </BlurView>
                                                        ) : (
                                                            <View style={[styles.gridCardTitleContainer, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                                                <Text style={styles.gridCardTitle} numberOfLines={2}>{pin.title || pin.locationName}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </Pressable>
                                            ))
                                        ) : (
                                            <View style={styles.emptyTabState}>
                                                <Feather name="map-pin" size={32} color="#ccc" />
                                                <Text style={styles.emptyTabText}>No pins yet</Text>
                                                <Text style={styles.emptyTabSubtext}>Start exploring to add pins!</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>

                                {/* JOURNEYS TAB */}
                                <ScrollView style={{ width: modalContentWidth }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                                    <View style={styles.gridContainer}>
                                        {stories.length > 0 ? (
                                            stories.map(story => {
                                                const coverPin = userPins.find(p => p.id === story.coverPinId) || userPins.find(p => p.id === story.pinIds[0]);
                                                return (
                                                    <Pressable
                                                        key={story.id}
                                                        style={({ pressed }) => [
                                                            styles.gridCard,
                                                            Platform.OS === 'ios' && pressed && { opacity: 0.7 }
                                                        ]}
                                                        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                                                        onPress={() => handlePlay(story)}
                                                        onLongPress={() => isMe && handleEditStory(story)}
                                                    >
                                                        <Image
                                                            source={{ uri: coverPin?.imageUris?.[0] || 'https://via.placeholder.com/150' }}
                                                            style={styles.gridCardImage}
                                                            contentFit="cover"
                                                        />
                                                        <View style={styles.gridCardOverlay}>
                                                            {Platform.OS === 'ios' ? (
                                                                <BlurView style={styles.gridCardTitleContainer} intensity={30} tint="dark">
                                                                    <Text style={styles.gridCardTitle} numberOfLines={1}>{story.title}</Text>
                                                                </BlurView>
                                                            ) : (
                                                                <View style={[styles.gridCardTitleContainer, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                                                    <Text style={styles.gridCardTitle} numberOfLines={1}>{story.title}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {isMe && (
                                                            <TouchableOpacity
                                                                style={styles.deleteStoryBtn}
                                                                onPress={() => handleDeleteStory(story.id)}
                                                            >
                                                                <Feather name="x" size={12} color="white" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </Pressable>
                                                );
                                            })
                                        ) : (
                                            <View style={styles.emptyTabState}>
                                                <Feather name="book-open" size={32} color="#ccc" />
                                                <Text style={styles.emptyTabText}>No journeys yet</Text>
                                                <Text style={styles.emptyTabSubtext}>Create a journey from your pins!</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>

                                {/* BUCKET LIST TAB */}
                                <ScrollView style={{ width: modalContentWidth }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                                    <View style={styles.gridContainer}>
                                        {bucketList.length > 0 ? (
                                            bucketList.map(item => (
                                                <Pressable
                                                    key={item.locationName}
                                                    style={({ pressed }) => [
                                                        styles.gridCard,
                                                        Platform.OS === 'ios' && pressed && { opacity: 0.7 }
                                                    ]}
                                                    onPress={() => setSelectedBucketItem(item)}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Image
                                                            source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                                                            style={styles.gridCardImage}
                                                            contentFit="cover"
                                                        />
                                                        <View style={styles.gridCardOverlay}>
                                                            {Platform.OS === 'ios' ? (
                                                                <BlurView style={styles.gridCardTitleContainer} intensity={30} tint="dark">
                                                                    <Text style={styles.gridCardTitle} numberOfLines={2}>{item.locationName}</Text>
                                                                </BlurView>
                                                            ) : (
                                                                <View style={[styles.gridCardTitleContainer, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                                                    <Text style={styles.gridCardTitle} numberOfLines={2}>{item.locationName}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {/* Status Badge */}
                                                        {item.status === 'visited' && (
                                                            <View style={[styles.statusPill, styles.pillVisited]}>
                                                                <Text style={[styles.statusPillText, { color: 'white' }]}>VISITED</Text>
                                                            </View>
                                                        )}
                                                        {item.status === 'booked' && (
                                                            <View style={[styles.statusPill, styles.pillBooked]}>
                                                                <Text style={styles.statusPillText}>BOOKED</Text>
                                                            </View>
                                                        )}
                                                        {item.status === 'wishlist' && (
                                                            <View style={[styles.statusPill, styles.pillWishlist]}>
                                                                <Text style={[styles.statusPillText, { color: '#666' }]}>WISHLIST</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </Pressable>
                                            ))
                                        ) : (
                                            <View style={styles.emptyTabState}>
                                                <Feather name="flag" size={32} color="#ccc" />
                                                <Text style={styles.emptyTabText}>Empty Bucket List</Text>
                                                <Text style={styles.emptyTabSubtext}>Add places you want to visit!</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            </ScrollView>
                        </>
                    ) : (
                        /* ===== iOS: ORIGINAL HORIZONTAL LAYOUT ===== */
                        <>
                            {/* View Pins Button */}
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

                            {/* Horizontal Scroll */}
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
                        </>
                    )}

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
                    onViewBucketListItem && onViewBucketListItem(item);
                    onClose(); // Close the profile modal to show the map
                }}
                onRemove={async (item) => {
                    if (userId) {
                        try {
                            // BucketListItem uses object matching for removal
                            await removeFromBucketList(userId, item);
                            // Optimistic update
                            setBucketList(prev => prev.filter(i => i.locationName !== item.locationName));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove item');
                        }
                    }
                    setSelectedBucketItem(null);
                }}
                onMarkBooked={async (item) => {
                    if (userId) {
                        try {
                            const newStatus = item.status === 'booked' ? 'wishlist' : 'booked';
                            await updateBucketListStatus(userId, item.locationName, newStatus);
                            // Optimistic Update
                            setBucketList(prev => prev.map(i => i.locationName === item.locationName ? { ...i, status: newStatus } : i));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update status');
                        }
                    }
                    setSelectedBucketItem(null);
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
        flex: 1, // Ensure it fills the card container
        width: '100%',
        paddingTop: 30, // Changed from paddingVertical to paddingTop/Bottom to allow flex children
        paddingBottom: 16,
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
    // Android Tab Styles
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#1a1a1a',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#999',
    },
    activeTabText: {
        color: '#1a1a1a',
    },
    tabContent: {
        paddingBottom: 24,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 12,
    },
    gridCard: {
        // Width: 90% Screen - GlassCard Padding (32) - GridPadding (32) - Gap (12) - Borders/Safety (4)
        width: (width * 0.90 - 32 - 32 - 12 - 4) / 2, // Explicitly broken out for clarity
        height: ((width * 0.90 - 80) / 2) * 1.5, // 2:3 aspect ratio
        borderRadius: 16,
        backgroundColor: '#eee',
        overflow: 'hidden',
        marginBottom: 12,
    },
    gridCardImage: {
        width: '100%',
        height: '100%',
    },
    gridCardOverlay: {
        position: 'absolute',
        bottom: 8, // Floating above bottom edge
        left: 0,
        right: 0,
        height: 'auto', // Auto height for text
        alignItems: 'center', // Center horizontally
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    gridCardTitleContainer: {
        // backgroundColor handled by BlurView
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)', // Thin light border
        paddingHorizontal: 16, // Slightly wider for pill shape
        paddingVertical: 8,
        borderRadius: 20, // More rounded capsule
        overflow: 'hidden', // Required for BlurView rounding
        maxWidth: '90%',
    },
    gridCardTitle: {
        color: 'white', // White text
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    gridCardSubtitle: {
        color: '#ccc', // Light grey for subtitle
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
        display: 'none', // Hide subtitle for cleaner pill look as requested ("small pill with text")
    },
    emptyTabState: {
        width: '100%',
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyTabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
    },
    emptyTabSubtext: {
        fontSize: 14,
        color: '#ccc',
    },
});
