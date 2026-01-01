import { Link, useRouter } from 'expo-router';
import { CreationModal } from '@/src/components/CreationModal';
import { DestinationCard } from '@/src/components/DestinationCard';
import { FabMenu } from '@/src/components/FabMenu';
import { FrostedPin } from '@/src/components/FrostedPin';
import { GradientPin } from '@/src/components/GradientPin';
import { ProfileModal } from '@/src/components/ProfileModal';
import { SettingsModal } from '@/src/components/SettingsModal';
import { BriefcasePin } from '@/src/components/BriefcasePin';
import { AvatarPin } from '@/src/components/AvatarPin';
import { FriendsModal } from '@/src/components/FriendsModal';
import { StoryModeController } from '@/src/components/StoryModeController';
import { StoryEditorModal } from '@/src/components/StoryEditorModal';
import { StoryCreationFlow } from '@/src/components/StoryCreationFlow';
import { ToastNotification } from '@/src/components/ToastNotification';
import { ExploreSearchBar } from '@/src/components/ExploreSearchBar';
import { ExploreInfoCard } from '@/src/components/ExploreInfoCard';
import { UsernameModal } from '@/src/components/UsernameModal';
import { GeocodingResult } from '@/src/services/geocodingService';

import { useMemoryStore, Memory } from '@/src/store/useMemoryStore';
import { subscribeToPins, addPin, deletePin, updatePin } from '@/src/services/firestoreService';
import { uploadImage } from '@/src/services/storageService';
import { getUserProfile, saveUserProfile, saveUserAvatar, saveUserPinColor, getFriendRequests, subscribeToFriendRequests, sendFriendRequest, getUserByUsername, toggleHiddenPin as toggleHiddenPinService, toggleHiddenFriend as toggleHiddenFriendService, getFriends, savePushToken, checkExplorationStreak } from '@/src/services/userService';
import { StreakCelebrationModal } from '@/src/components/StreakCelebrationModal';



import { challengeService } from '@/src/services/ChallengeService';
import { notificationService } from '@/src/services/NotificationService';
import { useAppLocation } from '@/src/hooks/useAppLocation';
import { useDataSubscriptions } from '@/src/hooks/useDataSubscriptions';
import { Story, storyService } from '@/src/services/StoryService';
import { Feather } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { featureCollection, lineString, point } from '@turf/helpers';
import * as ImagePicker from 'expo-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Image, Alert, Linking, BackHandler, Dimensions, TouchableOpacity, AppState, LayoutAnimation, UIManager, Platform, ActivityIndicator, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, withDelay, Easing as ReanimatedEasing } from 'react-native-reanimated';
import { useMapClusters, Point } from '@/src/hooks/useMapClusters';
import { ClusterPin } from '@/src/components/ClusterPin';
import { ClusterListModal } from '@/src/components/ClusterListModal';
import { PinContextMenu } from '@/src/components/PinContextMenu';
import { ReportModal } from '@/src/components/ReportModal';


// Style JSON wrapper to set lightPreset config
// Static Day Style with unique ID to force cache refresh
const DAY_STYLE = {
    version: 8,
    name: 'Standard-Day-Static',
    sources: {},
    layers: [],
    imports: [
        {
            id: 'basemap-static-day', // Changed ID to bust cache
            url: 'mapbox://styles/mapbox/standard',
            config: {
                lightPreset: 'day',
                showPlaceLabels: false,
                showRoadLabels: false,
            }
        }
    ]
};

export default function App() {
    const { memories, setMemories, selectedMemoryId, selectMemory, addMemory, addPhotoToMemory, username, setUsername, avatarUri, setAvatarUri, pinColor, setPinColor, currentUserId, friends, setFriends, hiddenFriendIds, setHiddenFriendIds, hiddenPinIds, toggleHiddenPin: toggleHiddenPinLocal, toggleHiddenFriend: toggleHiddenFriendLocal, setHiddenPinIds } = useMemoryStore();
    const router = useRouter();
    console.log('[App] Rendering Index');
    const [isCreationModalVisible, setIsCreationModalVisible] = useState(false);
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null); // Track memory being edited
    const [contextMenuPinId, setContextMenuPinId] = useState<string | null>(null); // Pin ID for context menu
    const [reportModalPinId, setReportModalPinId] = useState<string | null>(null); // Pin ID for report modal
    const [isFriendsVisible, setIsFriendsVisible] = useState(false);
    const [selectedUserProfileId, setSelectedUserProfileId] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);

    // Explore Mode State
    const [isExploreSearchVisible, setIsExploreSearchVisible] = useState(false);
    const [selectedExplorePlace, setSelectedExplorePlace] = useState<GeocodingResult | null>(null);
    const [isExploreInfoVisible, setIsExploreInfoVisible] = useState(false);
    const [showStreakCelebration, setShowStreakCelebration] = useState(false);
    const [celebrationStreak, setCelebrationStreak] = useState(0);
    const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
    const isCameraAnimating = useRef(false);

    // Global Story Editor State (For "Create Story from Pin" flow)
    const [isGlobalStoryEditorVisible, setIsGlobalStoryEditorVisible] = useState(false);
    const [storyEditorInitialPinId, setStoryEditorInitialPinId] = useState<string | null>(null);

    // Story Creation Flow (photo-first story wizard)
    const [isStoryCreationVisible, setIsStoryCreationVisible] = useState(false);

    const cameraRef = useRef<Mapbox.Camera>(null);
    const mapRef = useRef<Mapbox.MapView>(null);
    const [authorAvatars, setAuthorAvatars] = useState<Record<string, string>>({}); // Cache for creator avatars
    const [authorColors, setAuthorColors] = useState<Record<string, string>>({}); // Cache for creator pin colors
    const [filteredUserId, setFilteredUserId] = useState<string | null>(null); // ID of user to focus on

    // Story Mode State
    const [storyModeData, setStoryModeData] = useState<{ userId: string, story?: Story } | null>(null);
    const storyModeUserId = storyModeData?.userId || null;

    const [pulsingPinId, setPulsingPinId] = useState<string | null>(null); // ID of pin currently pulsing in story mode
    const [latestNewPinId, setLatestNewPinId] = useState<string | null>(null); // Track most recent new pin for FAB Logic
    const [friendRequestCount, setFriendRequestCount] = useState(0); // For FAB badge
    const [gameInviteCount, setGameInviteCount] = useState(0); // For Games badge
    const [newPinCount, setNewPinCount] = useState(0); // For New Pin badge
    const [hiddenByCreators, setHiddenByCreators] = useState<string[]>([]); // Creators who have hidden their pins from me
    const [storyPinIds, setStoryPinIds] = useState<Set<string>>(new Set()); // Pin IDs that belong to stories
    const [hiddenStoryPinIds, setHiddenStoryPinIds] = useState<Set<string>>(new Set()); // IDs of pins that should be hidden (part of story but not cover)
    const [pinToStoryMap, setPinToStoryMap] = useState<Record<string, Story>>({}); // Map pin ID to its Story

    // Fetch badge counts for FAB (Real-time for requests)
    const prevRequestCountRef = useRef(-1);
    const prevGameCountRef = useRef(-1);

    // Derived State (for filters)
    const allPinsRef = useRef<Memory[]>([]);

    // 0. Data Subscriptions (RESTORED)
    const { allPins, userProfile: firestoreProfile, profileLoaded } = useDataSubscriptions(currentUserId);

    // Clustering State
    const [mapBounds, setMapBounds] = useState<any>(null); // [minLng, minLat, maxLng, maxLat]

    const [zoomLevel, setZoomLevel] = useState(1.5);
    const [selectedClusterLeaves, setSelectedClusterLeaves] = useState<any[] | null>(null); // For List Modal


    // Fetch avatars for visible memories

    const storyPins = useMemo(() => {
        if (!storyModeUserId) return [];
        const userPins = memories.filter(m => m.creatorId === storyModeUserId);

        // If playing a specific story, filter and order by the story's pinIds
        if (storyModeData?.story) {
            const orderedPins: Memory[] = [];
            storyModeData.story.pinIds.forEach(id => {
                const found = userPins.find(p => p.id === id);
                if (found) orderedPins.push(found);
            });
            return orderedPins;
        }

        // Otherwise play all, sorted by date (oldest first?)
        return userPins.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [memories, storyModeUserId, storyModeData]);

    const visibleMemories = useMemo(() => {
        // If in Story Mode with a specific user, show ALL their pins (including multiple per story)
        if (storyModeUserId) {
            return memories.filter(m => m.creatorId === storyModeUserId);
        }

        return memories.filter(m => {
            // 1. Filter by specific user
            if (filteredUserId && m.creatorId !== filteredUserId) return false;

            // 2. Hide pins if creator has hidden them from me
            if (hiddenByCreators.includes(m.creatorId)) return false;

            // 3. Hide locally hidden pins
            if (hiddenPinIds.includes(m.id)) return false;

            // 4. Hide pins from non-friends (unless self)
            // Note: This logic depends on what is in 'memories'. If 'memories' only contains friends/self, this is redundant.
            // But good for safety.
            const isMine = m.creatorId === currentUserId;
            const isFriend = friends.includes(m.creatorId);
            if (!isMine && !isFriend) return false;

            // 5. Journey Logic: Only show the "Cover Pin" (first pin)
            // If this pin is in a story, we check if it is the primary pin.
            if (storyPinIds.has(m.id)) {
                const story = pinToStoryMap[m.id];
                if (story) {
                    const primaryPin = story.coverPinId || (story.pinIds && story.pinIds.length > 0 ? story.pinIds[0] : null);
                    // If this pin is NOT the primary pin, hide it.
                    if (primaryPin && m.id !== primaryPin) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [memories, filteredUserId, friends, currentUserId, hiddenByCreators, hiddenPinIds, storyPinIds, pinToStoryMap, storyModeUserId]);

    // Fetch avatars for visible memories
    useEffect(() => {
        const fetchAvatars = async () => {
            const uniqueCreatorIds = new Set(visibleMemories.map(m => m.creatorId));
            const newAvatars: Record<string, string> = { ...authorAvatars };
            let hasNew = false;

            // Ensure current user is always there
            if (currentUserId && avatarUri) {
                newAvatars[currentUserId] = avatarUri;
            }

            for (const uid of uniqueCreatorIds) {
                if (!newAvatars[uid]) {
                    // Check if friend
                    const friendProfile = await getUserProfile(uid);
                    if (friendProfile && friendProfile.avatarUrl) {
                        newAvatars[uid] = friendProfile.avatarUrl;
                        hasNew = true;
                    }
                }
            }

            if (hasNew) {
                setAuthorAvatars(newAvatars);
            }
        };

        if (visibleMemories.length > 0) {
            fetchAvatars();
        }
    }, [visibleMemories, currentUserId, avatarUri]);

    // Convert visible memories to GeoJSON points for clustering
    const points = useMemo<Point[]>(() => {
        return visibleMemories.map(m => ({
            type: 'Feature',
            properties: {
                cluster: false,
                id: m.id,
                creatorId: m.creatorId,
                memory: m,
            },
            geometry: {
                type: 'Point',
                coordinates: m.location,
            },
        }));
    }, [visibleMemories]);

    // Get clusters
    const { clusters, getLeaves, supercluster } = useMapClusters({
        points,
        bounds: mapBounds,
        zoom: zoomLevel,
    });

    // Debounce timer for region updates
    const regionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

    // Auto-Rotate Logic
    const autoRotateTimer = useRef<NodeJS.Timeout | null>(null);

    const startAutoRotate = (currentCenter: [number, number]) => {
        if (isExploreInfoVisible || !cameraRef.current) return;

        // Continuous Westward Drift (Left-to-Right ground)
        // We use -170 degrees to stay valid-ish, and loop.
        // Duration: 60s for 170 degrees ~ 3 deg/s.
        cameraRef.current.setCamera({
            centerCoordinate: [currentCenter[0] - 170, currentCenter[1]],
            animationDuration: 60000,
            animationMode: 'linear'
        });
    };

    const stopAutoRotate = () => {
        if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
    };

    // Helper: Mapbox region change handler
    const onRegionDidChange = async (feature: any) => {
        if (!feature || !feature.properties || isCameraAnimating.current) return;

        // Auto-Rotate Loop Logic
        const isUserInteraction = feature.properties.isUserInteraction;
        const delay = isUserInteraction ? 2000 : 50; // Resume quickly if just animation cycle

        stopAutoRotate();
        autoRotateTimer.current = setTimeout(() => {
            const center = feature.geometry.coordinates;
            // Only auto-rotate if we are in "Global View" (Zoom < 4).
            // We can check the zoom from the feature or map state?
            // Existing logic has zoom state.
            // Let's assume safe to rotate if not ExploreInfoVisible.
            startAutoRotate(center);
        }, delay);

        // Clear existing timer (Debounce)
        if (regionUpdateTimeout.current) {
            clearTimeout(regionUpdateTimeout.current);
        }

        // Set new timer (Debounce 100ms)
        regionUpdateTimeout.current = setTimeout(async () => {
            const bounds = await mapRef.current?.getVisibleBounds();
            const zoom = await mapRef.current?.getZoom();

            if (bounds && zoom) {
                const lons = [bounds[0][0], bounds[1][0]];
                const lats = [bounds[0][1], bounds[1][1]];
                const minLng = Math.min(...lons);
                const maxLng = Math.max(...lons);
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);

                setMapBounds([minLng, minLat, maxLng, maxLat]);
                setZoomLevel(zoom);
            }
        }, 100);
    };



    // Helper: Get leaves for a cluster ID
    const getSpiderLeaves = (clusterId: number) => {
        return getLeaves(clusterId, 50); // Fetch up to 50 leaves
    };

    // Handle Cluster Press (Zoom or List)
    const handleClusterPress = async (clusterId: number, coordinate: [number, number]) => {
        // 1. Get expansion zoom
        // Note: useMapClusters hook returns a simplified object. We need access to supercluster instance
        // accessible via 'supercluster' return from hook?

        // Wait, the current useMapClusters file implementation (Step 1664) DOES return supercluster instance!
        // But we need to grab it from the hook return.

        // Let's modify the hook call below to get 'supercluster'
    };


    // Derived selected memory
    const selectedMemory = memories.find(m => m.id === selectedMemoryId) || null;

    useEffect(() => {
        if (!currentUserId) return;

        // 1. Pending Challenges (Real-time)
        const unsubscribeChallenges = challengeService.subscribeToPendingChallenges(currentUserId, (challenges) => {
            const count = challenges.length;
            setGameInviteCount(count);

            // Notification Logic
            if (prevGameCountRef.current !== -1 && count > prevGameCountRef.current) {
                console.log('[App] New Game Invite received!');
                try {
                    if (Haptics && Haptics.notificationAsync) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((e: any) => console.log('Haptics failed', e));
                    }
                } catch (e) {
                    console.log('Haptics module missing or error', e);
                }
                const newChallenges = count - prevGameCountRef.current;
                useMemoryStore.getState().showToast(`New Game Challenge! ⚔️`, 'info');
            }
            prevGameCountRef.current = count;
        });

        // 2. Real-time Friend Requests
        const unsubscribeRequests = subscribeToFriendRequests(currentUserId, (requests) => {
            const count = requests.length;
            setFriendRequestCount(count);

            // Notification Logic
            if (prevRequestCountRef.current !== -1 && count > prevRequestCountRef.current) {
                // New request arrived while app is open
                console.log('[App] New Friend Request received via stream!');
                try {
                    if (Haptics && Haptics.notificationAsync) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((e: any) => console.log('Haptics failed', e));
                    }
                } catch (e) {
                    console.log('Haptics module missing or error', e);
                }
                useMemoryStore.getState().showToast(`New Friend Request! (${count} pending)`, 'info');
            }
            prevRequestCountRef.current = count;
        });

        // OneSignal Identification
        notificationService.login(currentUserId);

        // Verify OneSignal configuration on startup (debug)
        notificationService.verifyConfiguration().then(config => {
            console.log('[App] OneSignal Config Check:', {
                appId: config.appId,
                restApiKeyLoaded: config.restApiKeyLoaded,
                restApiKeyLength: config.restApiKeyLength,
                restApiKeyPreview: config.restApiKeyPreview,
            });
            if (config.issues.length > 0) {
                console.warn('[App] OneSignal Configuration Issues:', config.issues);
            }
        }).catch(err => console.error('[App] Config check failed:', err));

        // Ensure token (once)
        notificationService.registerForPushNotificationsAsync().then(token => {
            if (token && currentUserId) {
                console.log('[App] Saving push token:', token);
                savePushToken(currentUserId, token);
            }
        }).catch(err =>
            console.error('[App] Token registration failed:', err)
        );




        // Listen for Notification Clicks (Deep Linking)
        notificationService.addClickListener((data) => {
            console.log('[App] Notification Payload:', data);
            if (data.type === 'challenge_result' && data.challengeId) {
                // Navigate to games with ID
                console.log('[App] Navigating to challenge result:', data.challengeId);
                // setTimeout to ensure router is ready if cold start?
                setTimeout(() => {
                    router.push({ pathname: '/sandbox/games', params: { challengeId: data.challengeId } } as any);
                }, 500);
            } else if (data.type === 'game_invite') {
                // Just open games
                router.push('/sandbox/games' as any);
            } else if (data.type === 'new_pin' && data.lat && data.lon) {
                // Deep link to new pin location
                console.log('[App] Flying to new pin at:', data.lat, data.lon);
                setTimeout(() => {
                    if (cameraRef.current) {
                        cameraRef.current.setCamera({
                            centerCoordinate: [data.lon, data.lat],
                            zoomLevel: 4,
                            animationDuration: 2000,
                            animationMode: 'flyTo',
                        });
                        // Set highlighted pin for pulse effect
                        if (data.pinId) {
                            setHighlightedPinId(data.pinId);
                            // Clear highlight after 5 seconds
                            setTimeout(() => setHighlightedPinId(null), 5000);
                        }
                    }
                }, 500);
            } else if (data.type === 'new_story' && data.lat && data.lon) {
                // Deep link to story cover location
                console.log('[App] Flying to new story at:', data.lat, data.lon);
                setTimeout(() => {
                    if (cameraRef.current) {
                        cameraRef.current.setCamera({
                            centerCoordinate: [data.lon, data.lat],
                            zoomLevel: 4,
                            animationDuration: 2000,
                            animationMode: 'flyTo',
                        });
                    }
                }, 500);
            }
        });

        // const { storyService } = require('@/src/services/StoryService'); // Fixed: Use static import
        const unsubscribeStories = storyService.subscribeToUserStories(currentUserId, (stories: Story[]) => {
            // Determine shown story pins
            // Logic: 
            // 1. Map explicit story pins to the story object
            // 2. Build the set of ALL pins that belong to ANY story
            const newPinToStoryMap: Record<string, Story> = {};
            const newStoryPinIds = new Set<string>();

            const newHiddenStoryPinIds = new Set<string>();

            stories.forEach(story => {
                if (story.pinIds && Array.isArray(story.pinIds) && story.pinIds.length > 0) {
                    // Identify the primary pin (cover)
                    const primaryPinId = story.coverPinId || story.pinIds[0];

                    story.pinIds.forEach(pinId => {
                        newPinToStoryMap[pinId] = story;
                        newStoryPinIds.add(pinId);

                        // If NOT the primary pin, add to hidden set
                        if (pinId !== primaryPinId) {
                            newHiddenStoryPinIds.add(pinId);
                        }
                    });
                }
            });

            console.log('[App] Stories updated. Mapped pins:', newStoryPinIds.size, 'Hidden pins:', newHiddenStoryPinIds.size);
            setPinToStoryMap(newPinToStoryMap);
            setStoryPinIds(newStoryPinIds);
            setHiddenStoryPinIds(newHiddenStoryPinIds);
        });


        // Deep Linking (QR Codes / Custom Scheme)
        const handleDeepLink = async (event: { url: string }) => {
            const url = event.url;
            console.log('[App] Deep link received:', url);

            if (url.includes('friend/add/')) {
                const usernameToAdd = url.split('friend/add/')[1];
                if (usernameToAdd && currentUserId && username) {
                    // Confirm before adding
                    Alert.alert(
                        'Friend Request',
                        `Add ${usernameToAdd} as a friend?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Add Friend',
                                onPress: async () => {
                                    const targetUser = await getUserByUsername(usernameToAdd);
                                    if (targetUser) {
                                        const result = await sendFriendRequest(currentUserId, username, targetUser.uid);
                                        Alert.alert(result.success ? 'Success' : 'Notice', result.message);
                                    } else {
                                        Alert.alert('Error', 'User not found.');
                                    }
                                }
                            }
                        ]
                    );
                }
            }

            // Handle pin deep links: pinr://pin/{pinId}
            if (url.includes('pin/')) {
                const pinId = url.split('pin/')[1]?.split('?')[0]; // Handle any query params
                if (pinId) {
                    console.log('[App] Deep link to pin:', pinId);
                    // Find the pin and fly to it
                    const pin = memories.find(m => m.id === pinId);
                    if (pin && cameraRef.current) {
                        cameraRef.current.setCamera({
                            centerCoordinate: [pin.longitude, pin.latitude],
                            zoomLevel: 4,
                            animationDuration: 2000,
                            animationMode: 'flyTo',
                        });
                        // Highlight the pin
                        setHighlightedPinId(pinId);
                        setTimeout(() => setHighlightedPinId(null), 5000);
                    } else if (!pin) {
                        // Pin not in local cache, try to fetch it
                        try {
                            const { getPin } = require('../src/services/firestoreService');
                            const fetchedPin = await getPin(pinId);
                            if (fetchedPin && cameraRef.current) {
                                cameraRef.current.setCamera({
                                    centerCoordinate: [fetchedPin.longitude, fetchedPin.latitude],
                                    zoomLevel: 4,
                                    animationDuration: 2000,
                                    animationMode: 'flyTo',
                                });
                                setHighlightedPinId(pinId);
                                setTimeout(() => setHighlightedPinId(null), 5000);
                            }
                        } catch (err) {
                            console.error('[App] Failed to fetch pin for deep link:', err);
                        }
                    }
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check initial URL (Cold start)
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => {
            unsubscribeChallenges();
            unsubscribeRequests();
            subscription.remove();
        };
    }, [currentUserId]);

    // Handle Hardware Back Button
    useEffect(() => {
        const onBackPress = () => {
            // Priority 1: Modals (most specific first)
            if (isExploreSearchVisible) {
                setIsExploreSearchVisible(false);
                return true;
            }
            if (isExploreInfoVisible) {
                // Determine if we should go back to search or just close
                setIsExploreInfoVisible(false);
                setSelectedExplorePlace(null);
                return true;
            }
            if (selectedClusterLeaves) {
                setSelectedClusterLeaves(null);
                return true;
            }
            if (isGlobalStoryEditorVisible) {
                setIsGlobalStoryEditorVisible(false);
                setStoryEditorInitialPinId(null);
                return true;
            }
            if (storyModeData) {
                setStoryModeData(null);
                setPulsingPinId(null);
                // Reset camera on exit?
                if (cameraRef.current) {
                    cameraRef.current.setCamera({
                        zoomLevel: 1.5,
                        pitch: 45,
                        animationDuration: 2000,
                    });
                }
                return true;
            }
            if (selectedUserProfileId) {
                setSelectedUserProfileId(null);
                return true;
            }
            if (isCreationModalVisible) {
                setIsCreationModalVisible(false);
                return true;
            }
            if (isSettingsVisible) {
                setIsSettingsVisible(false);
                return true;
            }
            if (isFriendsVisible) {
                setIsFriendsVisible(false);
                return true;
            }
            if (selectedMemoryId) {
                selectMemory(null);
                return true;
            }

            // Allow default behavior (exit app if at root)
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
    }, [isExploreSearchVisible, isExploreInfoVisible, isCreationModalVisible, isSettingsVisible, isFriendsVisible, selectedMemoryId, selectedUserProfileId, selectedClusterLeaves, isGlobalStoryEditorVisible, storyModeData]);

    // Handle Logout / Null User
    useEffect(() => {
        if (!currentUserId) {
            notificationService.logout();
        }
    }, [currentUserId]);

    // Sync Pins & Detect New Pins
    useEffect(() => {
        if (allPins) {
            // Check for added pins (Comparison logic)
            if (allPinsRef.current.length > 0 && allPins.length > allPinsRef.current.length) {
                const prevIds = new Set(allPinsRef.current.map(p => p.id));
                const newPins = allPins.filter(p => !prevIds.has(p.id));

                newPins.forEach(pin => {
                    // Check if friend's pin and NOT my own
                    if (friends.includes(pin.creatorId) && pin.creatorId !== currentUserId) {
                        console.log('[App] New Friend Pin detected:', pin.id);

                        // Increment badge
                        setNewPinCount(prev => prev + 1);

                        // Toast
                        try {
                            if (Haptics && Haptics.notificationAsync) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } catch (e) { }

                        // Fallback name if creatorName missing
                        const name = authorAvatars[pin.creatorId] ? 'A friend' : 'A friend';
                        // Implementation note: we don't have creatorName on Memory object usually, 
                        // and looking up profile might be async. Just use generic or try to find cached name.

                        // Toast removed - push notification already informs user

                        // Set as target for FAB
                        setLatestNewPinId(pin.id);
                    }
                });
            }

            allPinsRef.current = allPins;
            setMemories(allPins);
        }
    }, [allPins, friends, hiddenFriendIds, currentUserId]);

    // Fetch profiles for memories (Fix for blank friend pins)
    useEffect(() => {
        const fetchMissingProfiles = async () => {
            const missingIds = new Set<string>();
            memories.forEach(m => {
                // If not me, and not in cache (checking authorAvatars from state closure which might be stale in strict mode but acceptable here as we append)
                // Better approach: Check against current state in a functional update or just fire if memories change
                if (m.creatorId && m.creatorId !== currentUserId) {
                    // We can't easily check 'authorAvatars' dependency here without triggering loops or stale closures.
                    // We'll trust the set logic to merge.
                    missingIds.add(m.creatorId);
                }
            });

            // Filter out ones we already have locally (simple optimization)
            const idsToFetch = Array.from(missingIds).filter(uid => !authorAvatars[uid]);

            if (idsToFetch.length === 0) return;

            console.log('[App] Fetching profiles for pins:', idsToFetch.length);

            const results = await Promise.all(idsToFetch.map(async (uid) => {
                const profile = await getUserProfile(uid);
                return { uid, profile };
            }));

            setAuthorAvatars(prev => {
                const next = { ...prev };
                results.forEach(({ uid, profile }) => {
                    if (profile?.avatarUrl) next[uid] = profile.avatarUrl;
                });
                return next;
            });

            setAuthorColors(prev => {
                const next = { ...prev };
                results.forEach(({ uid, profile }) => {
                    if (profile?.pinColor) {
                        // Store lowercase to ensure consistent lookup in colorMap
                        next[uid] = profile.pinColor.toLowerCase().trim();
                    }
                });
                return next;
            });

            // Check if any creators have hidden their pins from the current user
            if (currentUserId) {
                const creatorsHidingPins = results
                    .filter(({ profile }) => profile?.hidePinsFrom?.includes(currentUserId))
                    .map(({ uid }) => uid);

                if (creatorsHidingPins.length > 0) {
                    setHiddenByCreators(prev => [...new Set([...prev, ...creatorsHidingPins])]);
                }
            }
        };

        if (memories.length > 0) {
            fetchMissingProfiles();
        }
    }, [memories, currentUserId]); // Removing authorAvatars logic dependency avoids loop

    // Sync Profile
    const prevFriendsRef = useRef<string[]>([]);

    useEffect(() => {
        if (firestoreProfile) {
            if (firestoreProfile.username) setUsername(firestoreProfile.username);
            if (firestoreProfile.avatarUrl) setAvatarUri(firestoreProfile.avatarUrl);
            if (firestoreProfile.pinColor) {
                console.log('[DEBUG] Syncing pinColor from Firestore:', firestoreProfile.pinColor, '| typeof:', typeof firestoreProfile.pinColor);
                setPinColor(firestoreProfile.pinColor);
            }

            // LEGACY: const newFriends = firestoreProfile.friends || [];
            // SECURE: Fetch from Request System
            (async () => {
                if (currentUserId) {
                    try {
                        const secureFriends = await getFriends(currentUserId);
                        console.log('[App] Hydrated secure friends:', secureFriends.length);
                        setFriends(secureFriends);

                        // Toast Logic for New Friends
                        // We compare against the PREVIOUSLY loaded list in ref
                        if (prevFriendsRef.current.length > 0 && secureFriends.length > prevFriendsRef.current.length) {
                            const addedIds = secureFriends.filter(id => !prevFriendsRef.current.includes(id));
                            if (addedIds.length > 0) {
                                useMemoryStore.getState().showToast('New Connection! You made a new friend.', 'success');
                            }
                        }
                        prevFriendsRef.current = secureFriends;

                    } catch (e) {
                        console.error('[App] Failed to hydrate friends:', e);
                    }
                }
            })();

            // Sync hidden friends
            const newHiddenFriends = firestoreProfile.hiddenFriendIds || [];
            setHiddenFriendIds(newHiddenFriends);

            const newHiddenPins = firestoreProfile.hiddenPinIds || [];
            setHiddenPinIds(newHiddenPins);
        }
    }, [firestoreProfile, profileLoaded, currentUserId]);


    const onMapStyleLoaded = () => {
        console.log(`[Map] Style loaded. Mode: DAY`);
        SplashScreen.hideAsync();
    };

    // Handle avatar change
    const handleEditAvatar = async () => {
        if (!currentUserId) return;

        try {
            const image = await ImageCropPicker.openPicker({
                width: 400,
                height: 400,
                cropping: true,
                cropperCircleOverlay: true,
                compressImageQuality: 0.8,
                mediaType: 'photo',
                cropperToolbarTitle: 'Crop Profile Picture',
                cropperChooseText: 'Done',
                cropperCancelText: 'Cancel',
            });

            const localUri = image.path;

            // Upload to Firebase Storage
            const downloadUrl = await uploadImage(localUri, currentUserId, 'avatar');

            // Save URL to Firestore
            await saveUserAvatar(currentUserId, downloadUrl);

            // Update local state
            setAvatarUri(downloadUrl);
        } catch (error: any) {
            if (error.code !== 'E_PICKER_CANCELLED') {
                console.error('[App] Error uploading avatar:', error);
                Alert.alert('Error', 'Failed to upload avatar');
            }
        }
    };

    const handleCreateMemory = async (memoryData: Omit<Memory, 'id'> | (Partial<Memory> & { id: string }), createStory: boolean = false) => {
        console.log('[App] Saving Memory:', memoryData, 'Create Story:', createStory);

        const currentUserId = useMemoryStore.getState().currentUserId;
        if (!currentUserId) {
            console.error('[App] No user ID - cannot create pin');
            return;
        }

        // EDIT FLOW
        if ('id' in memoryData && memoryData.id) {
            const pinId = memoryData.id;
            console.log('[App] Updating existing pin:', pinId);

            // Optimistic Update (Local)
            // Ideally store has updateMemory, but for now we rely on re-fetch or specific logic
            // For MVP: We rely on Firestore listener to update UI quickly.

            // Background Update
            (async () => {
                try {
                    const updates = { ...memoryData };

                    // Specific Logic: If image changed to a LOCAL uri, upload it
                    // The CreationModal returns a local path if picked new, or remote url if untouched.
                    // We check if it starts with 'file://' or similar, not http
                    if (updates.imageUris && updates.imageUris.length > 0) {
                        const uri = updates.imageUris[0];
                        if (!uri.startsWith('http')) {
                            console.log('[App] Uploading new image for edit...');
                            const downloadUrl = await uploadImage(uri, currentUserId, pinId);
                            updates.imageUris = [downloadUrl];
                        }
                    }

                    await updatePin(pinId, updates);
                } catch (e) {
                    console.error('[App] Update failed:', e);
                    Alert.alert('Error', 'Failed to update pin.');
                }
            })();

            setEditingMemory(null); // Clear edit state
            return;
        }

        // CREATE FLOW (Existing)
        // Generate a temporary ID for optimistic update
        const tempId = `temp_${Date.now()}`;

        // Create optimistic memory with local image (shows immediately)
        // Create optimistic memory with local image (shows immediately)
        // We know this is Omit<Memory, 'id'> because we passed the 'id' check above
        const createData = memoryData as Omit<Memory, 'id'>;

        const optimisticMemory: Memory = {
            ...createData,
            id: tempId,
            creatorId: currentUserId,
        };

        // Add to local store immediately (optimistic update)
        addMemory(optimisticMemory);

        // Spin globe to the new pin location (don't open card)
        setTimeout(() => {
            if (cameraRef.current) {
                console.log('[App] Spinning to new pin:', memoryData.location);
                cameraRef.current.setCamera({
                    centerCoordinate: memoryData.location,
                    zoomLevel: 1.5,
                    animationDuration: 2000,
                    animationMode: 'flyTo',
                    pitch: 45,
                });
            }
        }, 100);

        // Upload and sync to Firestore in background
        (async () => {
            try {
                const newMemory: Memory = {
                    ...createData,
                    id: '',
                    creatorId: currentUserId,
                };

                // If there's an image, upload it
                if (memoryData.imageUris && memoryData.imageUris.length > 0) {
                    const localUri = memoryData.imageUris[0];
                    const pinId = Date.now().toString();

                    console.log('[App] Uploading image in background...');
                    const downloadUrl = await uploadImage(localUri, currentUserId, pinId);
                    newMemory.imageUris = [downloadUrl];
                }

                // Save to Firestore (real-time sync will update with proper ID)
                // Save to Firestore (real-time sync will update with proper ID)
                const pinId = await addPin(newMemory);
                console.log('[App] Pin saved to Firestore:', pinId);

                // Notify Friends
                const store = useMemoryStore.getState();
                const friends = store.friends || [];
                const username = store.username || 'A friend';

                console.log(`[App] Friends list for notification:`, friends);
                if (friends.length > 0) {
                    console.log(`[App] Notifying ${friends.length} friends about new pin...`);
                    // Fire and forget - don't await loop to block UI
                    friends.forEach(friendUid => {
                        notificationService.notifyNewPin(friendUid, username);
                    });
                } else {
                    console.log('[App] No friends to notify - friends array is empty');
                }

                // The Firestore listener will receive the update and replace our temp memory
            } catch (error) {
                console.error('[App] Error syncing memory to cloud:', error);
            }
        })();

        // If user requested to create a story immediately
        if (createStory) {
            setStoryEditorInitialPinId(tempId);
            setIsGlobalStoryEditorVisible(true);
        }
    };

    // Handle card close - spin to pin location then deselect
    const handleCardClose = () => {
        const memoryToSpinTo = selectedMemory;
        // Deselect first to close the card
        selectMemory(null);

        // Then spin to the pin location
        if (memoryToSpinTo && cameraRef.current) {
            console.log('[App] Spinning to pin location:', memoryToSpinTo.location);
            cameraRef.current.setCamera({
                centerCoordinate: memoryToSpinTo.location,
                zoomLevel: 1.5,
                animationDuration: 800,
                pitch: 45,
            });
        }
    };

    // GeoJSON for memory pins with color property for CircleLayer
    const colorMap: Record<string, string> = {
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
    const memoryPinSource = featureCollection(
        memories.map((m) => point(m.location, {
            id: m.id,
            color: colorMap[(m.pinColor || 'orange').toLowerCase()] || '#FF8C00'
        }))
    );

    // Debug: Log every memory on each render
    useEffect(() => {
        // console.log('[App] Memories updated:', memories.length);
    }, [memories]);

    console.log('[App] Rendering memories count:', memories.length);

    // Filter memories for display


    const handlePlayStory = (userId: string, story?: Story) => {
        console.log('[App] Playing story for user:', userId, story ? `(${story.title})` : '(All)');
        // Close ProfileModal before starting story mode to prevent it blocking map after story ends
        setSelectedUserProfileId(null);
        setStoryModeData({ userId, story });
    };

    const handleExploreSelect = async (location: GeocodingResult) => {
        setIsExploreSearchVisible(false);
        setSelectedExplorePlace(location);
        isCameraAnimating.current = true;
        stopAutoRotate();

        // Fly to location
        if (cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: location.center,
                zoomLevel: 4, // Increased zoom for better focus
                animationDuration: 2000,
                animationMode: 'flyTo',
            });
        }

        // Reset camera animating state after flight
        setTimeout(() => {
            isCameraAnimating.current = false;
        }, 2000);

        // Track exploration streak
        if (currentUserId) {
            const streakResult = await checkExplorationStreak(currentUserId);
            if (streakResult.increased) {
                setCelebrationStreak(streakResult.streak);
                // Delay celebration to after info card is shown
                setTimeout(() => {
                    setShowStreakCelebration(true);
                }, 2500);
            }
        }

        // Show info card immediately after globe spin (2000ms) + glow animation (800ms)
        setTimeout(() => {
            setIsExploreInfoVisible(true);
        }, 2800);
    };

    // Explore Pulse & Glow Animation
    const pulseAnim = useSharedValue(1);
    const glowAnim = useSharedValue(0);

    useEffect(() => {
        // Only animate when a place is selected
        if (!selectedExplorePlace) return;

        // Reset animation values first
        pulseAnim.value = 1;
        glowAnim.value = 0;

        // TIMING: Globe fly = 2000ms, then pulse/glow, then card
        const GLOBE_FLY_DURATION = 2000;
        const PULSE_DURATION = 400; // 200ms up + 200ms down
        const GLOW_DURATION = 800;

        // Main Pulse (Scale) - Single Heartbeat, DELAYED until after globe spin
        pulseAnim.value = withDelay(
            GLOBE_FLY_DURATION,
            withSequence(
                withTiming(1.3, { duration: 200, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
                withTiming(1, { duration: 200, easing: ReanimatedEasing.in(ReanimatedEasing.ease) })
            )
        );

        // Glow Ring (Radar Ping) - DELAYED until after globe spin
        glowAnim.value = withDelay(
            GLOBE_FLY_DURATION,
            withTiming(1, { duration: GLOW_DURATION, easing: ReanimatedEasing.out(ReanimatedEasing.ease) })
        );

        // Show card immediately after glow completes
        // Total wait = GLOBE_FLY_DURATION + GLOW_DURATION = 2800ms
    }, [selectedExplorePlace]);

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    const glowRingStyle = useAnimatedStyle(() => ({
        opacity: 1 - glowAnim.value, // Fade out
        transform: [{ scale: 1 + glowAnim.value * 3 }], // Scale 1 -> 4 (more visible)
    }));


    // Helper to get hex color from pinColor name (magenta, etc)
    const getUserHexColor = () => colorMap[(pinColor || 'orange').toLowerCase()] || '#FF8C00';

    // Callback for viewing item from Bucket List (Simulate Explore Search)
    const handleViewBucketItem = (item: any) => {
        const targetLocation = item.location && (item.location[0] !== 0 || item.location[1] !== 0)
            ? item.location
            : [0, 0];

        const exploreResult: GeocodingResult = {
            id: `bucket-${Date.now()}`,
            text: item.locationName,
            place_name: item.locationName,
            center: targetLocation,
            context: []
        };

        handleExploreSelect(exploreResult);
    };

    // Prevent rendering until profile is loaded to avoid white screens/race conditions
    if (!profileLoaded) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#1a1a1a" />
                <Text style={{ marginTop: 20, color: '#1a1a1a', fontSize: 16 }}>Preparing your journey...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: '#B8DEE8' }]}>




            <Mapbox.MapView
                key="day"
                ref={mapRef}
                style={styles.map}
                projection="globe"
                styleJSON={JSON.stringify(DAY_STYLE)}
                logoEnabled={false}
                attributionEnabled={false}
                scaleBarEnabled={false}
                onDidFinishLoadingStyle={() => {
                    SplashScreen.hideAsync();
                }}
                decelerationRate={0.999}
                onRegionWillChange={(feature: any) => {
                    // Only stop if user is interacting
                    if (feature?.properties?.isUserInteraction) {
                        stopAutoRotate();
                    }
                }}
                onRegionDidChange={onRegionDidChange}
            >

                {/* Map Events for Clustering */}
                <Mapbox.Camera
                    ref={cameraRef}
                    defaultSettings={{
                        centerCoordinate: [-74.006, 40.7128],
                        zoomLevel: 1.5,
                        pitch: 45,
                    }}
                    onUserTrackingModeChange={() => { }}
                />

                {/* Explore SEARCH MARKER (Pulsing User Pin) */}
                {
                    selectedExplorePlace && !isExploreInfoVisible && (
                        <Mapbox.MarkerView
                            key="explore-marker"
                            id="explore-marker"
                            coordinate={selectedExplorePlace.center}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                {/* Radar Glow Ring */}
                                <Animated.View style={[
                                    {
                                        position: 'absolute',
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: getUserHexColor(),
                                        zIndex: -1,
                                    },
                                    glowRingStyle
                                ]} />

                                {/* Pulsing Avatar */}
                                <Animated.View style={[pulseAnimatedStyle]}>
                                    {avatarUri ? (
                                        <Image
                                            source={{ uri: avatarUri }}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                borderWidth: 3,
                                                borderColor: getUserHexColor(), // User Color
                                                backgroundColor: 'white',
                                                // Glow Shadow
                                                shadowColor: getUserHexColor(),
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowOpacity: 0.8,
                                                shadowRadius: 10,
                                            }}
                                        />
                                    ) : (
                                        <View style={{
                                            width: 30, // Fallback icon size
                                            height: 30,
                                            borderRadius: 15,
                                            backgroundColor: getUserHexColor(),
                                            borderWidth: 2,
                                            borderColor: 'white',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            shadowColor: getUserHexColor(),
                                            shadowOffset: { width: 0, height: 0 },
                                            shadowOpacity: 0.8,
                                            shadowRadius: 10,
                                        }}>
                                            <Feather name="user" size={16} color="white" />
                                        </View>
                                    )}
                                </Animated.View>
                            </View>
                        </Mapbox.MarkerView>
                    )
                }

                {/* Render CLUSTERS and PINS */}
                {
                    clusters.map((point) => {
                        const { geometry, properties } = point;
                        const coordinates = geometry.coordinates;
                        const isCluster = properties.cluster;


                        // 1. CLUSTER MARKER
                        if (isCluster) {

                            return (
                                <Mapbox.MarkerView
                                    key={`cluster-${properties.cluster_id}`}
                                    coordinate={coordinates}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    allowOverlap={true}
                                    allowOverlapWithPuck={true}
                                >
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={async () => {
                                            const clusterId = properties.cluster_id;

                                            // Always open list logic (No Zooming)
                                            // User request: "let's adjustment have the logic be that a cluster... opens a list. no zoom."
                                            const leaves = getLeaves(clusterId, 100);
                                            setSelectedClusterLeaves(leaves);
                                        }}
                                    >
                                        <ClusterPin count={properties.point_count} />
                                    </TouchableOpacity>
                                </Mapbox.MarkerView>
                            );
                        }

                        // 2. INDIVIDUAL PIN (Leaf)
                        const memory = properties.memory as Memory;

                        return (
                            <Mapbox.MarkerView
                                key={`pin-${memory.id}`}
                                id={`marker-${memory.id}`}
                                coordinate={coordinates}
                                anchor={{ x: 0.5, y: 0.5 }}
                                allowOverlap={true}
                                allowOverlapWithPuck={true}
                            >
                                <TouchableOpacity
                                    onPress={() => {
                                        if (storyPinIds.has(memory.id)) {
                                            const story = pinToStoryMap[memory.id];
                                            handlePlayStory(memory.creatorId, story);
                                        } else {
                                            selectMemory(memory.id);
                                        }
                                    }}
                                    activeOpacity={0.7}
                                    onLongPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setContextMenuPinId(memory.id);
                                    }}
                                >
                                    <AvatarPin
                                        avatarUri={
                                            memory.creatorId === currentUserId
                                                ? avatarUri
                                                : (authorAvatars[memory.creatorId] || null)
                                        }
                                        ringColor={
                                            colorMap[
                                            (memory.creatorId === currentUserId
                                                ? pinColor
                                                : (authorColors[memory.creatorId] || memory.pinColor))?.toLowerCase() || 'orange'
                                            ] || '#FF8C00'
                                        }
                                        isPulsing={memory.id === pulsingPinId}
                                        isStory={(() => {
                                            if (storyPinIds.has(memory.id)) {
                                                const story = pinToStoryMap[memory.id];
                                                if (story) {
                                                    const primaryPin = story.coverPinId || story.pinIds[0];
                                                    return memory.id === primaryPin;
                                                }
                                            }
                                            return false;
                                        })()}
                                    />
                                </TouchableOpacity>
                            </Mapbox.MarkerView>
                        );
                    })
                }

                {/* 3. CLUSTER LIST MODAL (To be implemented) */}

            </Mapbox.MapView >

            {/* Explore UI Overlays - Rendering AFTER map forces correct Android Elevation/Touch handling */}
            <ExploreSearchBar
                visible={isExploreSearchVisible}
                onClose={() => setIsExploreSearchVisible(false)}
                onSelectLocation={handleExploreSelect}
            />

            <Modal
                transparent
                visible={isExploreInfoVisible && !!selectedExplorePlace}
                animationType="fade"
                onRequestClose={() => {
                    setIsExploreInfoVisible(false);
                    setSelectedExplorePlace(null);
                }}
            >
                {selectedExplorePlace && (
                    <ExploreInfoCard
                        placeName={selectedExplorePlace.text}
                        location={selectedExplorePlace}
                        onClose={() => {
                            setIsExploreInfoVisible(false);
                            setSelectedExplorePlace(null);
                        }}
                    />
                )}
            </Modal>




            {/* UI Elements - Hide when in Story Mode */}
            {
                !storyModeUserId && (
                    <>



                        <FabMenu
                            avatarUri={avatarUri}
                            pinColor={getUserHexColor()}
                            onPressExplore={() => setIsExploreSearchVisible(true)}
                            onPressProfile={() => {
                                if (currentUserId) {
                                    setSelectedUserProfileId(currentUserId);
                                }
                            }}
                            onPressFriends={() => {
                                // Intercept: If there is a new pin, fly to it instead of opening modal
                                if (newPinCount > 0 && latestNewPinId) {
                                    const pin = memories.find(m => m.id === latestNewPinId);
                                    if (pin) {
                                        // 1. Fly to Pin
                                        cameraRef.current?.setCamera({
                                            centerCoordinate: pin.location,
                                            zoomLevel: 1.5,
                                            animationDuration: 2000,
                                        });
                                        // 2. Pulse Pin
                                        setPulsingPinId(pin.id);
                                        // Stop pulsing after 5s
                                        setTimeout(() => setPulsingPinId(null), 5000);

                                        // 3. Clear Badges
                                        setNewPinCount(0);
                                        setLatestNewPinId(null);

                                        // Toast removed - visual indicators are sufficient
                                        return;
                                    }
                                }

                                setIsFriendsVisible(true);
                                // Clear badges (standard behavior)
                                setFriendRequestCount(0);
                                setNewPinCount(0);
                            }}
                            onPressAddPin={() => {
                                // Unified flow: StoryCreationFlow handles both single pins and stories
                                setIsStoryCreationVisible(true);
                            }}
                            onPressGames={() => {
                                setGameInviteCount(0); // Clear badge
                                router.push('/sandbox/games' as any);
                            }}
                            // Removed onPressCreateStory - unified into onPressAddPin
                            friendRequestCount={friendRequestCount}
                            gameInviteCount={gameInviteCount}
                            newPinCount={newPinCount}
                        />

                        {/* Filter Active Chip */}
                        {filteredUserId && (
                            <TouchableOpacity
                                style={styles.filterChip}
                                onPress={() => setFilteredUserId(null)}
                            >
                                <Feather name="filter" size={16} color="white" />
                                <Text style={styles.filterText}>
                                    Showing {filteredUserId === currentUserId ? 'My' : 'User'} Pins
                                </Text>
                                <View style={styles.filterClose}>
                                    <Feather name="x" size={14} color="#1a1a1a" />
                                </View>
                            </TouchableOpacity>
                        )}
                    </>
                )
            }



            {/* Story Mode Controller */}
            {
                storyModeData && storyModeUserId && (
                    <StoryModeController
                        pins={storyPins}
                        cameraRef={cameraRef}
                        onExit={() => {
                            setStoryModeData(null);
                            setPulsingPinId(null); // Clear pulsing state on exit
                            // Reset camera?
                            if (cameraRef.current) {
                                cameraRef.current.setCamera({
                                    zoomLevel: 1.5,
                                    pitch: 45,
                                    animationDuration: 2000,
                                });
                            }
                        }}
                        onPulsingPinChange={setPulsingPinId}
                        userColor={
                            storyModeUserId === currentUserId
                                ? (colorMap[(pinColor || 'orange').toLowerCase()] || '#FF8C00')
                                : (authorColors[storyModeUserId] || colorMap[(memories.find(m => m.creatorId === storyModeUserId)?.pinColor || 'orange').toLowerCase()] || '#FF8C00')
                        }
                    />
                )
            }

            <ProfileModal
                visible={!!selectedUserProfileId}
                userId={selectedUserProfileId}
                onClose={() => setSelectedUserProfileId(null)}
                onFilterMap={(uid) => {
                    console.log('[App] Filtering map by user:', uid);
                    setFilteredUserId(uid);
                }}
                onPlayStory={handlePlayStory}
                onEditUsername={() => {
                    // UsernameModal will open over ProfileModal
                    setIsUsernameModalVisible(true);
                }}
                onEditAvatar={handleEditAvatar}
                onPinColorChange={async (color) => {
                    setPinColor(color);
                    if (currentUserId) {
                        await saveUserPinColor(currentUserId, color);
                    }
                }}
                onOpenSettings={() => setIsSettingsVisible(true)}
                onViewBucketListItem={handleViewBucketItem}
            />

            <SettingsModal
                visible={isSettingsVisible}
                onClose={() => setIsSettingsVisible(false)}
            />

            <UsernameModal
                visible={isUsernameModalVisible}
                onClose={() => setIsUsernameModalVisible(false)}
                onSave={async (newUsername) => {
                    if (currentUserId) {
                        await saveUserProfile(currentUserId, newUsername);
                        setUsername(newUsername);
                    }
                    setIsUsernameModalVisible(false);
                }}
                currentUsername={username}
                currentUserId={currentUserId}
            />

            {
                isGlobalStoryEditorVisible && currentUserId && (
                    <StoryEditorModal
                        visible={isGlobalStoryEditorVisible}
                        onClose={() => {
                            setIsGlobalStoryEditorVisible(false);
                            setStoryEditorInitialPinId(null);
                        }}
                        currentUserId={currentUserId}
                        userPins={memories.filter(m => m.creatorId === currentUserId)}
                        initialPinId={storyEditorInitialPinId || undefined}
                    />
                )
            }

            <CreationModal
                visible={isCreationModalVisible}
                onClose={() => {
                    setIsCreationModalVisible(false);
                    setEditingMemory(null);
                }}
                onSave={handleCreateMemory}
                initialMemory={editingMemory}
            />

            {/* Unified Pin/Story Creation Flow */}
            {
                isStoryCreationVisible && currentUserId && (
                    <StoryCreationFlow
                        visible={isStoryCreationVisible}
                        onClose={() => setIsStoryCreationVisible(false)}
                        onCreateSinglePin={async (pinDraft) => {
                            console.log('[App] Creating single pin:', pinDraft.title);
                            try {
                                // Use existing handleCreateMemory for single pin
                                await handleCreateMemory({
                                    title: pinDraft.title,
                                    location: pinDraft.location
                                        ? [pinDraft.location.lon, pinDraft.location.lat] as [number, number]
                                        : [0, 0],
                                    locationName: pinDraft.location?.name || 'Unknown',
                                    imageUris: [pinDraft.localImageUri],
                                    date: pinDraft.visitDate ? new Date(pinDraft.visitDate).toISOString() : new Date().toISOString(),
                                    pinColor: pinColor as 'magenta' | 'orange' | 'green' | 'blue' | 'cyan' | 'red',
                                    creatorId: currentUserId,
                                    expiresAt: null,
                                });
                                setIsStoryCreationVisible(false);
                                useMemoryStore.getState().showToast('Pin created!', 'success');
                            } catch (error) {
                                console.error('[App] Pin creation error:', error);
                                useMemoryStore.getState().showToast('Failed to create pin', 'error');
                            }
                        }}
                        onComplete={async (storyTitle, pinDrafts) => {
                            console.log('[App] Story creation complete:', storyTitle, pinDrafts.length, 'pins');
                            try {
                                const { storyService } = require('@/src/services/StoryService');
                                const store = useMemoryStore.getState();
                                const result = await storyService.createStoryWithPhotos(
                                    currentUserId,
                                    storyTitle,
                                    pinDrafts,
                                    store.friends || []
                                );
                                if (result.success) {
                                    setIsStoryCreationVisible(false);
                                    useMemoryStore.getState().showToast('Journey posted!', 'success');

                                    // Optimized Refresh: Immediately fetch newest stories
                                    // storyService.getStoriesForUser... (Actually subscription handles this)                    }
                                } else {
                                    useMemoryStore.getState().showToast(result.error || 'Failed to create story', 'error');
                                }
                            } catch (error) {
                                console.error('[App] Story creation error:', error);
                                useMemoryStore.getState().showToast('Failed to create story', 'error');
                            }
                        }}
                    />
                )
            }



            <FriendsModal
                visible={isFriendsVisible}
                onClose={() => setIsFriendsVisible(false)}
                onSelectUser={(userId) => {
                    setSelectedUserProfileId(userId);
                    setIsFriendsVisible(false); // Close friends list
                }}
            />

            {/* Pin Context Menu */}
            {
                contextMenuPinId && (() => {
                    const pin = memories.find(m => m.id === contextMenuPinId);
                    const isOwner = pin?.creatorId === currentUserId;
                    const isStory = storyPinIds.has(contextMenuPinId);
                    // Get creator name (fallback to 'User')
                    // Note: authorAvatars keys are UIDs, but values are URIs. We don't have names easily available here.
                    // We'll rely on the profile modal to show full info or fetch if needed. 
                    // For now, "User" is safe.

                    return (
                        <PinContextMenu
                            visible={!!contextMenuPinId}
                            onClose={() => setContextMenuPinId(null)}
                            pinId={contextMenuPinId}
                            pinTitle={pin?.title || 'Pin'}
                            locationName={pin?.locationName || 'Unknown'}
                            isOwner={!!isOwner}
                            isStory={isStory}
                            creatorName={"User"}
                            onViewProfile={() => {
                                if (pin) setSelectedUserProfileId(pin.creatorId);
                                setContextMenuPinId(null);
                            }}
                            onShare={async () => {
                                const { Share } = require('react-native');
                                const shareUrl = `https://builtbylee.github.io/pinr/pin.html?id=${contextMenuPinId}`;

                                // Get the creator's username for personalized message
                                let creatorUsername = '';
                                if (pin?.creatorId) {
                                    try {
                                        creatorUsername = await getUsername(pin.creatorId) || '';
                                    } catch (e) {
                                        console.warn('[Share] Could not fetch username:', e);
                                    }
                                }

                                const viewText = creatorUsername
                                    ? `View ${creatorUsername}'s pin on Pinr`
                                    : 'View on Pinr';
                                const message = `📍 ${pin?.title || 'Pin'} - ${pin?.locationName || 'Location'}\n\n${viewText}: ${shareUrl}`;

                                await Share.share({
                                    message: message,
                                    title: `Check out my pin!`,
                                });
                                setContextMenuPinId(null);
                            }}
                            onEdit={() => {
                                if (isStory) {
                                    // For journey pins, open the story editor
                                    const story = pinToStoryMap[contextMenuPinId];
                                    if (story && pin) {
                                        setStoryEditorInitialPinId(contextMenuPinId);
                                        setIsGlobalStoryEditorVisible(true);
                                    }
                                } else {
                                    // For single pins, open the pin creator/editor
                                    setEditingMemory(pin || null);
                                    setIsCreationModalVisible(true);
                                }
                                setContextMenuPinId(null);
                            }}
                            onDelete={() => {
                                if (isStory) {
                                    // For journey pins, delete the entire story
                                    const story = pinToStoryMap[contextMenuPinId];
                                    Alert.alert(
                                        'Delete Journey',
                                        'Are you sure you want to delete this entire journey and all its pins?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete Journey',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    if (story) {
                                                        const { storyService } = require('@/src/services/StoryService');
                                                        await storyService.deleteStory(story.id);
                                                        useMemoryStore.getState().showToast('Journey deleted', 'success');
                                                    }
                                                    setContextMenuPinId(null);
                                                }
                                            }
                                        ]
                                    );
                                } else {
                                    // For single pins, delete just the pin
                                    Alert.alert(
                                        'Delete Pin',
                                        'Are you sure you want to delete this memory?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    if (pin) {
                                                        await deletePin(pin.id);
                                                        useMemoryStore.getState().deleteMemory(pin.id);
                                                    }
                                                    setContextMenuPinId(null);
                                                }
                                            }
                                        ]
                                    );
                                }
                            }}
                            onHidePin={async () => {
                                if (currentUserId && pin) {
                                    // 1. Optimistic update
                                    toggleHiddenPinLocal(pin.id);
                                    setContextMenuPinId(null);
                                    useMemoryStore.getState().showToast('Pin hidden from your map', 'success');

                                    // 2. Persist
                                    try {
                                        await toggleHiddenPinService(currentUserId, pin.id, true);
                                    } catch (e) {
                                        console.error('Failed to hide pin remotely:', e);
                                        // Revert if failed? For now keep local.
                                    }
                                }
                            }}
                            onHideUser={async () => {
                                if (currentUserId && pin) {
                                    Alert.alert(
                                        'Hide All Pins',
                                        `Hide all pins from this user? You remain friends.`,
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Hide All',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    // 1. Optimistic
                                                    toggleHiddenFriendLocal(pin.creatorId);
                                                    setContextMenuPinId(null);

                                                    // 2. Persist
                                                    await toggleHiddenFriendService(currentUserId, pin.creatorId, true);
                                                }
                                            }
                                        ]
                                    );
                                }
                            }}
                            onReport={() => {
                                console.log('[Report] Button pressed, contextMenuPinId:', contextMenuPinId);
                                if (contextMenuPinId) {
                                    setReportModalPinId(contextMenuPinId);
                                }
                                setContextMenuPinId(null);
                            }}
                        />
                    );
                })()
            }

            {
                selectedMemory && (
                    <DestinationCard
                        memory={selectedMemory}
                        onClose={handleCardClose}
                        onAddPhoto={(uri) => addPhotoToMemory(selectedMemory.id, uri)}
                        onRemovePhoto={(uri) => useMemoryStore.getState().removePhotoFromMemory(selectedMemory.id, uri)}
                        onSelectUser={(userId) => {
                            setSelectedUserProfileId(userId);
                            handleCardClose();
                        }}
                        onEdit={() => {
                            console.log('[App] Edit requested for:', selectedMemory.id);
                            setEditingMemory(selectedMemory);
                            setIsCreationModalVisible(true);
                            handleCardClose(); // Close card to show modal
                        }}
                    />
                )
            }



            {/* Global Toast Notification */}
            <ToastNotification />
            {/* Cluster List Modal */}
            <ClusterListModal
                visible={!!selectedClusterLeaves}
                leaves={selectedClusterLeaves || []}
                onClose={() => setSelectedClusterLeaves(null)}
                authorAvatars={authorAvatars}
                currentUserId={currentUserId}
                currentUserAvatar={avatarUri}
                onSelectMemory={(memory) => {
                    if (storyPinIds.has(memory.id)) {
                        const story = pinToStoryMap[memory.id];
                        handlePlayStory(memory.creatorId, story);
                    } else {
                        selectMemory(memory.id);
                    }
                }}
                onLongPressMemory={(memory) => {
                    setSelectedClusterLeaves(null); // Close cluster modal first
                    setContextMenuPinId(memory.id); // Open context menu for this pin
                }}
            />

            {/* Report Modal */}
            <ReportModal
                visible={!!reportModalPinId}
                onClose={() => setReportModalPinId(null)}
                reportType="pin"
                targetId={reportModalPinId || ''}
                targetName={memories.find(m => m.id === reportModalPinId)?.title}
            />

            {/* Explore Streak Celebration Modal */}
            <StreakCelebrationModal
                visible={showStreakCelebration}
                streakCount={celebrationStreak}
                onDismiss={() => setShowStreakCelebration(false)}
            />

        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#B8DEE8', // Light blue-green background (original)
    },
    map: {
        flex: 1,
    },
    settingsButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    filterChip: {
        position: 'absolute',
        top: 110, // Below settings
        alignSelf: 'center',
        backgroundColor: '#007AFF', // Blue accent
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    filterText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    filterClose: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 10,
        padding: 2,
    },
});
