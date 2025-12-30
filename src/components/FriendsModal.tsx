import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Modal,
    Pressable
} from 'react-native';
import { useMemoryStore } from '../store/useMemoryStore';
import {
    searchUsers,
    sendFriendRequest,
    getFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getUserProfile,
    getUsername,
    getUserByUsername,
    toggleHiddenFriend,
    getFriends
} from '../services/userService';
import { shareService } from '../services/ShareService';
import { AvatarPin } from './AvatarPin';

interface FriendsModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectUser: (userId: string) => void;
}

type Tab = 'list' | 'add' | 'scan' | 'code';

interface FriendRequest {
    id: string;
    fromUid: string;
    fromUsername: string;
}

interface Friend {
    uid: string;
    username: string;
    avatarUrl?: string | null;
    pinColor?: string;
}

const PIN_COLOR_MAP: Record<string, string> = {
    magenta: '#FF00FF',
    orange: '#FF8C00',
    green: '#22CC66',
    blue: '#0066FF',
    cyan: '#00DDDD',
    red: '#FF3333',
};

const { width, height } = Dimensions.get('window');

export const FriendsModal: React.FC<FriendsModalProps> = ({ visible, onClose, onSelectUser }) => {
    const { currentUserId, username, avatarUri, pinColor, hiddenFriendIds, toggleHiddenFriend: toggleHiddenFriendLocal } = useMemoryStore();
    const [activeTab, setActiveTab] = useState<Tab>('list');

    // Search / List State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<{ uid: string; username: string }[]>([]);
    const [searchError, setSearchError] = useState('');
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [filterText, setFilterText] = useState('');

    // Camera / QR State
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [isProcessingScan, setIsProcessingScan] = useState(false);

    // Friend Actions Menu State
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

    // Load friends and requests
    useEffect(() => {
        if (visible && currentUserId) {
            loadFriendData();
            // Reset scan state on open
            setScanned(false);
            setIsProcessingScan(false);
        }
    }, [visible, currentUserId]);

    const loadFriendData = async () => {
        if (!currentUserId) return;
        try {
            // Get friend requests
            const requestsData = await getFriendRequests(currentUserId);
            setFriendRequests(requestsData);

            // Get friends using new Request-Based logic
            const friendIds = await getFriends(currentUserId);

            if (friendIds.length > 0) {
                const friendsList: Friend[] = [];
                await Promise.all(friendIds.map(async (friendUid) => {
                    const friendProfile = await getUserProfile(friendUid);
                    friendsList.push({
                        uid: friendUid,
                        username: friendProfile?.username || 'Unknown',
                        avatarUrl: friendProfile?.avatarUrl,
                        pinColor: friendProfile?.pinColor || 'orange',
                    });
                }));
                // Sort alphabetically
                friendsList.sort((a, b) => a.username.localeCompare(b.username));
                setFriends(friendsList);
            } else {
                setFriends([]);
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !currentUserId) return;

        setIsSearching(true);
        setSearchResults([]);
        setSearchError('');

        try {
            const results = await searchUsers(searchQuery.trim());
            // Filter out self and existing friends
            const filtered = results.filter(r =>
                r.uid !== currentUserId && !friends.some(f => f.uid === r.uid)
            );
            if (filtered.length > 0) {
                setSearchResults(filtered);
            } else if (results.length > 0) {
                setSearchError("No new users found (already friends or that's you!)");
            } else {
                setSearchError('No users found');
            }
        } catch (error) {
            setSearchError('Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendRequest = async (targetUser: { uid: string; username: string }) => {
        if (!currentUserId) return;

        // User must have a username before sending friend requests
        if (!username) {
            Alert.alert(
                'Update Your Profile',
                'Please update your username in your profile before adding friends. Tap your profile picture to get started!',
                [{ text: 'Got it' }]
            );
            return;
        }

        try {
            const result = await sendFriendRequest(currentUserId, username, targetUser.uid);
            if (result.success) {
                Alert.alert('Request Sent', `Friend request sent to ${targetUser.username}`);
                setSearchResults(prev => prev.filter(r => r.uid !== targetUser.uid));
                setSearchQuery('');
            } else {
                Alert.alert('Info', result.message);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send request');
        }
    };

    const handleAcceptRequest = async (request: FriendRequest) => {
        if (!currentUserId) return;
        try {
            await acceptFriendRequest(request.id, currentUserId, request.fromUid);
            loadFriendData();
        } catch (error: any) {
            console.error('[FriendsModal] Accept failed:', error);
            Alert.alert('Error', error.message || 'Failed to accept request');
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            await rejectFriendRequest(requestId);
            loadFriendData();
        } catch (error) {
            Alert.alert('Error', 'Failed to reject request');
        }
    };

    const handleRemoveFriend = async (friendUid: string, friendUsername: string) => {
        Alert.alert('Remove Friend', `Remove ${friendUsername}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    if (!currentUserId) return;
                    try {
                        await removeFriend(currentUserId, friendUid);
                        loadFriendData();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to remove friend');
                    }
                }
            }
        ]);
    };

    const handleBarCodeScanned = async (scanningResult: BarcodeScanningResult) => {
        if (scanned || isProcessingScan) return;
        const { data } = scanningResult;

        setScanned(true);
        setIsProcessingScan(true);

        try {
            // Expected format: "app80days://friend/add/USERNAME"
            let usernameToAdd = '';

            if (data.startsWith('app80days://friend/add/')) {
                usernameToAdd = data.split('app80days://friend/add/')[1];
            } else if (data.startsWith('primal:user:')) {
                // Backward compatibility
                usernameToAdd = data.split(':')[2];
            }

            if (usernameToAdd) {
                Alert.alert(
                    'Friend Found',
                    `Add ${usernameToAdd} to your friends?`,
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => setTimeout(() => setScanned(false), 2000) },
                        {
                            text: 'Add Friend',
                            onPress: async () => {
                                if (currentUserId && username) {
                                    // 1. Resolve Username -> UID
                                    const targetUser = await getUserByUsername(usernameToAdd);
                                    if (targetUser) {
                                        const result = await sendFriendRequest(currentUserId, username, targetUser.uid);
                                        Alert.alert(result.success ? 'Success' : 'Notice', result.message);
                                        setSearchResults([]);
                                    } else {
                                        Alert.alert('Error', 'User not found.');
                                    }
                                }
                                setScanned(false);
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Invalid Code', 'Could not read username from QR code.');
                setScanned(false);
            }
        } catch (error) {
            console.error('Scan error:', error);
            setScanned(false);
        } finally {
            setIsProcessingScan(false);
        }
    };

    if (!visible) return null;

    return (
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Feather name="users" size={24} color="#1a1a1a" style={{ marginRight: 10 }} />
                        <Text style={styles.headerTitle}>Friends</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Feather name="x" size={28} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'list' && styles.activeTab]}
                        onPress={() => setActiveTab('list')}
                    >
                        <Feather name="list" size={18} color={activeTab === 'list' ? '#FFF' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'add' && styles.activeTab]}
                        onPress={() => setActiveTab('add')}
                    >
                        <Feather name="user-plus" size={18} color={activeTab === 'add' ? '#FFF' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'scan' && styles.activeTab]}
                        onPress={async () => {
                            setActiveTab('scan');
                            if (!permission?.granted) await requestPermission();
                        }}
                    >
                        <Feather name="camera" size={18} color={activeTab === 'scan' ? '#FFF' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'scan' && styles.activeTabText]}>Scan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'code' && styles.activeTab]}
                        onPress={() => setActiveTab('code')}
                    >
                        <Feather name="grid" size={18} color={activeTab === 'code' ? '#FFF' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}>Code</Text>
                    </TouchableOpacity>
                </View>

                {/* CONTENT BODY */}
                <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
                    {/* TAB: LIST */}
                    {activeTab === 'list' && (
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            {/* Friend Filter */}
                            <View style={styles.section}>
                                {/* Invite Friends Button */}
                                <TouchableOpacity
                                    style={styles.inviteButton}
                                    onPress={() => shareService.shareAppInvite()}
                                >
                                    <Feather name="share-2" size={18} color="white" />
                                    <Text style={styles.inviteButtonText}>Invite Friends to Pinr</Text>
                                </TouchableOpacity>

                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Filter friends..."
                                        placeholderTextColor="rgba(0,0,0,0.4)"
                                        value={filterText}
                                        onChangeText={setFilterText}
                                        autoCapitalize="none"
                                    />
                                    <View style={styles.searchButton}>
                                        <Feather name="filter" size={20} color="white" />
                                    </View>
                                </View>
                            </View>

                            {/* Pending Requests */}
                            {friendRequests.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Pending Requests ({friendRequests.length})</Text>
                                    {friendRequests.map(req => (
                                        <View key={req.id} style={styles.requestRow}>
                                            <View style={styles.userInfo}>
                                                <Feather name="user-plus" size={24} color="#1a1a1a" />
                                                <Text style={styles.userName}>{req.fromUsername}</Text>
                                            </View>
                                            <View style={styles.requestActions}>
                                                <TouchableOpacity
                                                    style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                                                    onPress={() => handleRejectRequest(req.id)}
                                                >
                                                    <Feather name="x" size={20} color="white" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionButton, { backgroundColor: '#34C759', marginLeft: 8 }]}
                                                    onPress={() => handleAcceptRequest(req)}
                                                >
                                                    <Feather name="check" size={20} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Friends List */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Your Friends ({friends.length})</Text>
                                {friends.length > 0 ? (
                                    friends
                                        .filter(f => f.username.toLowerCase().includes(filterText.toLowerCase()))
                                        .map(friend => {
                                            const isHidden = hiddenFriendIds.includes(friend.uid);

                                            return (
                                                <View key={friend.uid} style={styles.friendRow}>
                                                    <TouchableOpacity
                                                        style={styles.friendInfo}
                                                        onPress={() => onSelectUser(friend.uid)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                                                            <View style={{ transform: [{ scale: 0.7 }] }}>
                                                                <AvatarPin
                                                                    avatarUri={friend.avatarUrl || null}
                                                                    ringColor={friend.pinColor || 'orange'}
                                                                />
                                                            </View>
                                                        </View>
                                                        <Text style={styles.userName} numberOfLines={1}>{friend.username}</Text>
                                                        {isHidden && (
                                                            <View style={styles.hiddenBadge}>
                                                                <Feather name="eye-off" size={12} color="#666" />
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.menuButton}
                                                        onPress={() => setSelectedFriend(friend)}
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        <Feather name="more-vertical" size={20} color="#666" />
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })
                                ) : (
                                    <Text style={styles.emptyText}>No friends yet. Add some!</Text>
                                )}
                            </View>
                        </ScrollView>
                    )}

                    {/* TAB: ADD */}
                    {activeTab === 'add' && (
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Find People</Text>
                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by username..."
                                        placeholderTextColor="rgba(0,0,0,0.4)"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoCapitalize="none"
                                        returnKeyType="search"
                                        onSubmitEditing={handleSearch}
                                    />
                                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                                        <Feather name="search" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>

                                {searchError ? (
                                    <Text style={styles.errorText}>{searchError}</Text>
                                ) : null}

                                {searchResults.map(user => (
                                    <View key={user.uid} style={styles.searchResultRow}>
                                        <View style={styles.userInfo}>
                                            <View style={styles.userAvatar}>
                                                <Feather name="user" size={20} color="white" />
                                            </View>
                                            <Text style={styles.userName}>{user.username}</Text>
                                        </View>
                                        <TouchableOpacity style={styles.addButton} onPress={() => handleSendRequest(user)}>
                                            <Feather name="user-plus" size={18} color="white" />
                                            <Text style={styles.addButtonText}>Add</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}

                    {/* TAB: SCAN */}
                    {
                        activeTab === 'scan' && (
                            <View style={styles.scanContainer}>
                                {!permission ? (
                                    <ActivityIndicator color="#000" />
                                ) : !permission.granted ? (
                                    <View style={styles.permContainer}>
                                        <Text style={styles.permText}>Camera permission needed</Text>
                                        <TouchableOpacity onPress={requestPermission} style={styles.permButton}>
                                            <Text style={styles.permButtonText}>Grant Permission</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.cameraWrapper}>
                                        <CameraView
                                            style={StyleSheet.absoluteFillObject}
                                            facing="back"
                                            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                        />
                                        <View style={styles.scanOverlay}>
                                            <View style={styles.scanFrame} />
                                            <Text style={styles.scanInstruction}>Align QR code in frame</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )
                    }

                    {/* TAB: CODE */}
                    {
                        activeTab === 'code' && (
                            <View style={styles.codeContainer}>
                                <View style={{ marginBottom: 16, marginTop: 40, transform: [{ scale: 1.2 }] }}>
                                    <AvatarPin
                                        avatarUri={avatarUri}
                                        ringColor={pinColor || 'orange'}
                                    />
                                </View>
                                <Text style={styles.qrUsername}>{username}</Text>
                                <View style={styles.qrCard}>
                                    <QRCode
                                        value={username ? `app80days://friend/add/${username}` : 'loading'}
                                        size={200}
                                        color="black"
                                        backgroundColor="white"
                                        logo={require('../../assets/images/qr-logo-cropped.png')}
                                        logoSize={35}
                                        logoBackgroundColor="transparent"
                                        logoBorderRadius={8}
                                        ecl="H"
                                    />
                                </View>
                                <Text style={styles.qrHint}>Scan to add me as a friend</Text>
                            </View>
                        )
                    }
                </View >
            </View >

            {/* Friend Actions Modal */}
            <Modal
                visible={!!selectedFriend}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedFriend(null)}
            >
                <Pressable
                    style={styles.menuOverlay}
                    onPress={() => setSelectedFriend(null)}
                >
                    <View style={styles.menuPopup}>
                        {selectedFriend && (
                            <>
                                <View style={styles.menuHeader}>
                                    <Text style={styles.menuTitle}>{selectedFriend.username}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.menuOption}
                                    onPress={async () => {
                                        if (!currentUserId || !selectedFriend) return;
                                        const isHidden = hiddenFriendIds.includes(selectedFriend.uid);
                                        toggleHiddenFriendLocal(selectedFriend.uid);
                                        await toggleHiddenFriend(currentUserId, selectedFriend.uid, !isHidden);
                                        setSelectedFriend(null);
                                    }}
                                >
                                    <Feather
                                        name={hiddenFriendIds.includes(selectedFriend.uid) ? 'eye' : 'eye-off'}
                                        size={20}
                                        color="#1a1a1a"
                                    />
                                    <Text style={styles.menuOptionText}>
                                        {hiddenFriendIds.includes(selectedFriend.uid) ? 'Show Pins' : 'Hide Pins'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.menuOption, styles.menuOptionDanger]}
                                    onPress={() => {
                                        if (!selectedFriend) return;
                                        handleRemoveFriend(selectedFriend.uid, selectedFriend.username);
                                        setSelectedFriend(null);
                                    }}
                                >
                                    <Feather name="user-x" size={20} color="#FF3B30" />
                                    <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Remove Friend</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.menuCancel}
                                    onPress={() => setSelectedFriend(null)}
                                >
                                    <Text style={styles.menuCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Pressable>
            </Modal>
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    content: {
        width: '90%',
        height: '75%', // Changed from maxHeight to fixed height to ensure expansion
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 20,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(0,0,0,0.5)',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        color: '#1a1a1a',
    },
    searchButton: {
        backgroundColor: '#1a1a1a',
        borderRadius: 25,
        padding: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#FF3B30',
        marginTop: 10,
        fontSize: 14,
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.7)',
        padding: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    userInfo: {
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginRight: 8,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden', // Ensure image clips to circle
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#34C759',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 25,
        gap: 6,
    },
    addButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.7)',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    requestActions: {
        flexDirection: 'row',
    },
    actionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        borderRadius: 12,
        gap: 12,
    },
    swipeAction: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        marginBottom: 8,
        borderRadius: 12,
    },
    swipeActionHide: {
        backgroundColor: '#1a1a1a',
    },
    swipeActionShow: {
        backgroundColor: '#10B981',
    },
    swipeActionRemove: {
        backgroundColor: '#FF3B30',
    },
    swipeActionText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    hiddenBadge: {
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    friendInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    menuButton: {
        padding: 8,
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuPopup: {
        backgroundColor: 'white',
        borderRadius: 16,
        width: '80%',
        maxWidth: 300,
        overflow: 'hidden',
    },
    menuHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        alignItems: 'center',
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    menuOptionText: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    menuOptionDanger: {
        borderBottomWidth: 0,
    },
    menuOptionTextDanger: {
        color: '#FF3B30',
    },
    menuCancel: {
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
    },
    menuCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    friendActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButtonPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8, // Reduced padding
        borderRadius: 25,
    },
    actionButtonPillActive: { // Hidden state
        backgroundColor: '#F2F2F7',
        borderColor: '#E5E5EA',
    },
    actionButtonPillInactive: { // Visible state (Active action)
        backgroundColor: '#1a1a1a',
        borderColor: '#1a1a1a',
    },
    actionButtonText: {
        fontSize: 11, // Slightly smaller text
        fontWeight: '600',
    },
    removeButtonPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8, // Reduced padding
        borderRadius: 25,
        borderColor: '#FFC0C0',
    },
    removeButtonText: {
        fontSize: 11, // Slightly smaller text
        fontWeight: '600',
        color: '#FF3B30',
    },
    emptyText: {
        color: 'rgba(0,0,0,0.4)',
        textAlign: 'center',
        fontStyle: 'italic',
        paddingVertical: 20,
    },
    // Tab Styles
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        gap: 6,
    },
    activeTab: {
        backgroundColor: '#1a1a1a',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    activeTabText: {
        color: 'white',
    },
    // Scan Styles
    scanContainer: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        margin: 16,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraWrapper: {
        flex: 1,
        width: '100%',
        height: '100%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    scanOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 220,
        height: 220,
        borderWidth: 2,
        borderColor: 'white',
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    scanInstruction: {
        color: 'white',
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        overflow: 'hidden',
    },
    permContainer: {
        padding: 20,
        alignItems: 'center',
    },
    permText: {
        color: 'white',
        marginBottom: 16,
    },
    permButton: {
        backgroundColor: 'white',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    permButtonText: {
        fontWeight: 'bold',
        color: 'black',
    },
    // Code Styles
    codeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    qrCard: {
        padding: 24,
        backgroundColor: 'white',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 24,
    },
    qrUsername: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 24,
    },
    qrHint: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
    },
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#34C759',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 16,
        gap: 10,
    },
    inviteButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});
