import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, Switch, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, BackHandler } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { getCurrentEmail, sendPasswordReset, getCurrentUser, reauthenticateUser, updatePassword } from '../services/authService';
import { LinkEmailModal } from './LinkEmailModal';
import { TermsModal } from './TermsModal';
import { ManageVisibilityModal } from './ManageVisibilityModal';
import { addFriend, removeFriend, getUserProfile, saveUserPinColor, updateNotificationSettings, getFriendRequests, acceptFriendRequest, rejectFriendRequest, FriendRequest, updatePinVisibility, getFriends, clearProfileCache, updatePrivacySettings } from '../services/userService';
import { notificationService } from '../services/NotificationService';
import { useMemoryStore } from '../store/useMemoryStore';
import crashlytics from '@react-native-firebase/crashlytics';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

// Available pin colors


const { width, height } = Dimensions.get('window');

export const SettingsModal: React.FC<SettingsModalProps> = ({
    visible,
    onClose
}) => {
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Animation state
    const animation = useSharedValue(0);

    // Animated styles for drop-down effect
    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { translateY: withSpring((1 - animation.value) * -50, { damping: 18, stiffness: 180 }) },
            { scale: withSpring(0.95 + animation.value * 0.05, { damping: 15, stiffness: 200 }) }
        ]
    }));

    // Friend & Notification State
    const [friends, setFriends] = useState<any[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [mutedFriends, setMutedFriends] = useState<string[]>([]);
    const [hidePinsFrom, setHidePinsFrom] = useState<string[]>([]); // Privacy: friends who can't see my pins
    const [allowSharing, setAllowSharing] = useState(true); // Privacy: allow friends to share my content

    // Notification Type Preferences
    const [pinNotificationsEnabled, setPinNotificationsEnabled] = useState(true);
    const [storyNotificationsEnabled, setStoryNotificationsEnabled] = useState(true);
    const [gameInvitesEnabled, setGameInvitesEnabled] = useState(true);
    const [gameResultsEnabled, setGameResultsEnabled] = useState(true);

    const [isVisibilityModalVisible, setIsVisibilityModalVisible] = useState(false);

    // LinkEmail & Deletion State (moved up for BackHandler access)
    const [linkEmailVisible, setLinkEmailVisible] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Change Password State
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

    // Check auth state and trigger animation when modal opens
    useEffect(() => {
        if (visible) {
            animation.value = 1;
            checkEmail();
            loadProfileData();
        } else {
            animation.value = 0;
        }
    }, [visible]);

    // Handle Hardware Back Button for nested modals
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            if (linkEmailVisible) {
                setLinkEmailVisible(false);
                return true;
            }
            if (showTerms) {
                setShowTerms(false);
                return true;
            }
            if (showDeleteConfirm) {
                setShowDeleteConfirm(false);
                return true;
            }
            if (showChangePassword) {
                setShowChangePassword(false);
                return true;
            }
            if (isVisibilityModalVisible) {
                setIsVisibilityModalVisible(false);
                return true;
            }
            // Close main modal
            onClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [visible, linkEmailVisible, showDeleteConfirm, showChangePassword, isVisibilityModalVisible, onClose]);

    const loadProfileData = async () => {
        const user = getCurrentUser();
        if (user) {
            const profile = await getUserProfile(user.uid);
            if (profile) {
                setPushEnabled(profile.notificationSettings?.globalEnabled ?? false);
                setMutedFriends(profile.notificationSettings?.mutedFriendIds || []);

                // Load notification type preferences
                setPinNotificationsEnabled(profile.notificationSettings?.pinNotifications ?? true);
                setStoryNotificationsEnabled(profile.notificationSettings?.storyNotifications ?? true);
                setGameInvitesEnabled(profile.notificationSettings?.gameInvites ?? true);
                setGameResultsEnabled(profile.notificationSettings?.gameResults ?? true);

                // Load Pin Visibility Privacy
                setHidePinsFrom(profile.hidePinsFrom || []);
                setAllowSharing(profile.privacySettings?.allowSharing ?? true);

                // Load Friends
                // SECURE: Use getFriends() to ensure we list verified friends
                const friendIds = await getFriends(user.uid);

                if (friendIds && friendIds.length > 0) {
                    const friendList = [];
                    for (const friendUid of friendIds) {
                        const fProfile = await getUserProfile(friendUid);
                        if (fProfile) {
                            friendList.push({
                                uid: friendUid,
                                username: fProfile.username,
                                avatarUrl: fProfile.avatarUrl,
                                pinColor: fProfile.pinColor
                            });
                        }
                    }
                    setFriends(friendList);
                } else {
                    setFriends([]);
                }

                // Load Requests
                const requests = await getFriendRequests(user.uid);
                setFriendRequests(requests);
            }
        }
    };

    const handleTogglePush = async (value: boolean) => {
        setPushEnabled(value);
        const user = getCurrentUser();
        if (user) {
            // Permission request logic can go here or in a wrapper
            if (value) {
                await notificationService.registerForPushNotificationsAsync();
            }
            await updateNotificationSettings(user.uid, { globalEnabled: value });
        }
    };

    const handleToggleNotificationType = async (
        type: 'pinNotifications' | 'storyNotifications' | 'gameInvites' | 'gameResults',
        value: boolean
    ) => {
        // Optimistic update
        if (type === 'pinNotifications') setPinNotificationsEnabled(value);
        if (type === 'storyNotifications') setStoryNotificationsEnabled(value);
        if (type === 'gameInvites') setGameInvitesEnabled(value);
        if (type === 'gameResults') setGameResultsEnabled(value);

        const user = getCurrentUser();
        if (user) {
            await updateNotificationSettings(user.uid, { [type]: value });
        }
    };

    const handleRemoveFriend = async (friendUid: string) => {
        const user = getCurrentUser();
        if (user) {
            try {
                await removeFriend(user.uid, friendUid);
                loadProfileData();

                // Sync with global store so map updates immediately
                const currentFriends = useMemoryStore.getState().friends;
                useMemoryStore.getState().setFriends(currentFriends.filter(id => id !== friendUid));
            } catch (error) {
                console.error('[SettingsModal] Failed to remove friend:', error);
                Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
        }
    };

    const handleToggleMuteFriend = async (friendUid: string, isMuted: boolean) => {
        // Optimistic update
        setMutedFriends(prev => isMuted ? [...prev, friendUid] : prev.filter(id => id !== friendUid));

        const user = getCurrentUser();
        if (user) {
            await updateNotificationSettings(user.uid, isMuted ? { muteFriendUid: friendUid } : { unmuteFriendUid: friendUid });
        }
    };

    const handleToggleHidePins = async (friendUid: string, isHidden: boolean) => {
        // Optimistic update
        setHidePinsFrom(prev => isHidden ? [...prev, friendUid] : prev.filter(id => id !== friendUid));

        const user = getCurrentUser();
        if (user) {
            await updatePinVisibility(user.uid, friendUid, isHidden);
        }
    };

    const handleToggleAllowSharing = async (value: boolean) => {
        setAllowSharing(value);
        const user = getCurrentUser();
        if (user) {
            await updatePrivacySettings(user.uid, { allowSharing: value });
        }
    };

    const handleAcceptRequest = async (request: FriendRequest) => {
        const user = getCurrentUser();
        if (user) {
            try {
                await acceptFriendRequest(request.id, user.uid, request.fromUid);
                // Refresh list
                loadProfileData(); // Refresh friends and requests
                useMemoryStore.getState().showToast(`${request.fromUsername} added!`, 'success');

                // Sync global
                const currentFriends = useMemoryStore.getState().friends;
                useMemoryStore.getState().setFriends([...currentFriends, request.fromUid]);
            } catch (e) {
                useMemoryStore.getState().showToast('Failed to accept request.', 'error');
            }
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            await rejectFriendRequest(requestId);
            setFriendRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (e) {
            console.error(e);
        }
    };

    const checkEmail = () => {
        const email = getCurrentEmail();
        setUserEmail(email);
    };

    const currentUser = getCurrentUser();

    const handleDeleteAccount = () => {
        setDeleteError(null);
        setShowDeleteConfirm(true);
    };

    const handleChangePassword = async () => {
        // Validation
        if (!currentPassword) {
            setChangePasswordError('Please enter your current password');
            return;
        }
        if (!newPassword) {
            setChangePasswordError('Please enter a new password');
            return;
        }
        if (newPassword.length < 6) {
            setChangePasswordError('New password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setChangePasswordError('Passwords do not match');
            return;
        }

        setIsChangingPassword(true);
        setChangePasswordError(null);

        try {
            // 1. Re-authenticate with current password
            await reauthenticateUser(currentPassword);

            // 2. Update to new password
            await updatePassword(newPassword);

            // 3. Success
            Alert.alert('Success', 'Your password has been changed successfully.');
            setShowChangePassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Change password failed:', error);
            if (error.code === 'auth/wrong-password' || error.message?.includes('Incorrect')) {
                setChangePasswordError('Current password is incorrect');
            } else if (error.code === 'auth/weak-password') {
                setChangePasswordError('New password is too weak');
            } else {
                setChangePasswordError(error.message || 'Failed to change password');
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletePassword) {
            setDeleteError('Please enter your password');
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);

        try {
            const user = getCurrentUser();
            if (!user) return;

            // 1. Re-authenticate (Must succeed to proceed)
            await reauthenticateUser(deletePassword);

            // 2. Delete Data (Best Effort)
            try {
                const { deleteUserData } = require('../services/userService');
                await deleteUserData(user.uid);
            } catch (dataError: any) {
                console.error('[Settings] Data deletion error:', dataError);
                // Prompt user to continue or abort
                const forceDelete = await new Promise<boolean>((resolve) => {
                    Alert.alert(
                        "Data Deletion Issue",
                        "We encountered an error deleting some of your data (e.g. photos). Do you want to force delete your account anyway?",
                        [
                            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                            { text: "Force Delete", style: "destructive", onPress: () => resolve(true) }
                        ]
                    );
                });

                if (!forceDelete) {
                    throw new Error("Deletion cancelled by user.");
                }
            }

            // 3. Delete Account (Auth)
            const { deleteAccount } = require('../services/authService');
            await deleteAccount();

            // 4. Close and Exit
            onClose();

        } catch (error: any) {
            console.error('Delete failed:', error);
            if (error.code === 'auth/wrong-password') {
                setDeleteError('Incorrect password');
            } else {
                setDeleteError(error.message || 'Failed to delete account');
                // Ensure they see it if UI is hidden?
                Alert.alert("Error", error.message || "Failed to delete account");
            }
        } finally {
            setIsDeleting(false);
        }
    };

    if (!visible) return null;

    // Change Password Screen
    if (showChangePassword) {
        return (
            <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Change Password</Text>
                        <TouchableOpacity onPress={() => {
                            setShowChangePassword(false);
                            setChangePasswordError(null);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                        }} style={styles.closeButton}>
                            <Feather name="arrow-left" size={28} color="#1a1a1a" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={{ alignItems: 'center', marginBottom: 30 }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 122, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <Feather name="lock" size={40} color="#007AFF" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 }}>Update Your Password</Text>
                                <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', textAlign: 'center' }}>
                                    Enter your current password and choose a new one.
                                </Text>
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginLeft: 4 }}>CURRENT PASSWORD</Text>
                            <TextInput
                                style={{
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 16,
                                    padding: 16,
                                    fontSize: 16,
                                    marginBottom: 16,
                                    color: '#1a1a1a'
                                }}
                                placeholder="Enter current password"
                                placeholderTextColor="rgba(0,0,0,0.4)"
                                secureTextEntry
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                autoCapitalize="none"
                            />

                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginLeft: 4 }}>NEW PASSWORD</Text>
                            <TextInput
                                style={{
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 16,
                                    padding: 16,
                                    fontSize: 16,
                                    marginBottom: 16,
                                    color: '#1a1a1a'
                                }}
                                placeholder="Enter new password"
                                placeholderTextColor="rgba(0,0,0,0.4)"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                                autoCapitalize="none"
                            />

                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginLeft: 4 }}>CONFIRM NEW PASSWORD</Text>
                            <TextInput
                                style={{
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 16,
                                    padding: 16,
                                    fontSize: 16,
                                    marginBottom: 20,
                                    color: '#1a1a1a'
                                }}
                                placeholder="Confirm new password"
                                placeholderTextColor="rgba(0,0,0,0.4)"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                autoCapitalize="none"
                            />

                            {changePasswordError && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                    <Feather name="alert-circle" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
                                    <Text style={{ color: '#FF3B30', fontSize: 14 }}>{changePasswordError}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#007AFF',
                                    borderRadius: 16,
                                    padding: 18,
                                    alignItems: 'center',
                                    shadowColor: '#007AFF',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
                                onPress={handleChangePassword}
                                disabled={isChangingPassword}
                            >
                                {isChangingPassword ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Update Password</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </View>
        );
    }

    if (showDeleteConfirm) {
        return (
            <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Delete Account</Text>
                        <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={styles.closeButton}>
                            <Feather name="arrow-left" size={28} color="#1a1a1a" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={{ alignItems: 'center', marginBottom: 30 }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 59, 48, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <Feather name="alert-triangle" size={40} color="#FF3B30" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 }}>Are you sure?</Text>
                                <Text style={{ fontSize: 16, color: 'rgba(0,0,0,0.6)', textAlign: 'center' }}>
                                    This will permanently delete your profile, memories, and photos. This action cannot be undone.
                                </Text>
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginLeft: 4 }}>ENTER PASSWORD</Text>
                            <TextInput
                                style={{
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 16,
                                    padding: 16,
                                    fontSize: 16,
                                    marginBottom: 20,
                                    color: '#1a1a1a'
                                }}
                                placeholder="Password"
                                placeholderTextColor="rgba(0,0,0,0.4)"
                                secureTextEntry
                                value={deletePassword}
                                onChangeText={setDeletePassword}
                                autoCapitalize="none"
                            />

                            {deleteError && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                    <Feather name="alert-circle" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
                                    <Text style={{ color: '#FF3B30', fontSize: 14 }}>{deleteError}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#FF3B30',
                                    borderRadius: 16,
                                    padding: 18,
                                    alignItems: 'center',
                                    shadowColor: '#FF3B30',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
                                onPress={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Delete Permanently</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
            <Animated.View style={[styles.content, animatedContentStyle]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Settings</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Feather name="x" size={28} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollContent}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                >
                    {/* (Profile Section Removed) */}


                    {/* Notifications Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notifications</Text>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Feather name="bell" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Push Notifications</Text>
                                    <Text style={styles.settingValue}>{pushEnabled ? 'On' : 'Off'}</Text>
                                </View>
                            </View>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handleTogglePush}
                                trackColor={{ false: '#767577', true: '#34C759' }}
                                thumbColor={'#f4f3f4'}
                            />
                        </View>

                        {/* Notification Types - only show if push is enabled */}
                        {pushEnabled && (
                            <>
                                <View style={styles.settingRowIndented}>
                                    <View style={styles.settingInfo}>
                                        <Feather name="map-pin" size={20} color="#6B7280" />
                                        <View style={styles.settingText}>
                                            <Text style={styles.settingLabelSmall}>Friend Pins</Text>
                                            <Text style={styles.settingValueSmall}>When friends drop new pins</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={pinNotificationsEnabled}
                                        onValueChange={(v) => handleToggleNotificationType('pinNotifications', v)}
                                        trackColor={{ false: '#767577', true: '#34C759' }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                </View>

                                <View style={styles.settingRowIndented}>
                                    <View style={styles.settingInfo}>
                                        <Feather name="layers" size={20} color="#6B7280" />
                                        <View style={styles.settingText}>
                                            <Text style={styles.settingLabelSmall}>Friend Stories</Text>
                                            <Text style={styles.settingValueSmall}>When friends share new stories</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={storyNotificationsEnabled}
                                        onValueChange={(v) => handleToggleNotificationType('storyNotifications', v)}
                                        trackColor={{ false: '#767577', true: '#34C759' }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                </View>

                                <View style={styles.settingRowIndented}>
                                    <View style={styles.settingInfo}>
                                        <Feather name="send" size={20} color="#6B7280" />
                                        <View style={styles.settingText}>
                                            <Text style={styles.settingLabelSmall}>Game Invites</Text>
                                            <Text style={styles.settingValueSmall}>Invitations to play games</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={gameInvitesEnabled}
                                        onValueChange={(v) => handleToggleNotificationType('gameInvites', v)}
                                        trackColor={{ false: '#767577', true: '#34C759' }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                </View>

                                <View style={styles.settingRowIndented}>
                                    <View style={styles.settingInfo}>
                                        <Feather name="award" size={20} color="#6B7280" />
                                        <View style={styles.settingText}>
                                            <Text style={styles.settingLabelSmall}>Game Results</Text>
                                            <Text style={styles.settingValueSmall}>When friends beat your scores</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={gameResultsEnabled}
                                        onValueChange={(v) => handleToggleNotificationType('gameResults', v)}
                                        trackColor={{ false: '#767577', true: '#34C759' }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                </View>
                            </>
                        )}
                    </View>

                    {/* Privacy Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Privacy</Text>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Feather name="eye-off" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Pin & Journey Visibility</Text>
                                    <Text style={styles.settingValue}>Control who sees your pins and journeys</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Feather name="share-2" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Allow Friends to Share</Text>
                                    <Text style={styles.settingValue}>Allow friends to share your content</Text>
                                </View>
                            </View>
                            <Switch
                                value={allowSharing}
                                onValueChange={handleToggleAllowSharing}
                                trackColor={{ false: '#767577', true: '#34C759' }}
                                thumbColor={'#f4f3f4'}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.settingRow}
                            onPress={() => setIsVisibilityModalVisible(true)}
                        >
                            <View style={styles.settingInfo}>
                                <Feather name="users" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Manage Visibility</Text>
                                    <Text style={styles.settingValue}>Block specific friends</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>
                    </View>

                    {/* About Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Feather name="info" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Version</Text>
                                    <Text style={styles.settingValue}>1.0.0</Text>
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.settingRow} onPress={() => {
                            Linking.openURL('https://opentdb.com');
                        }}>
                            <View style={styles.settingInfo}>
                                <Feather name="award" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Trivia Questions</Text>
                                    <Text style={styles.settingValue}>Powered by Open Trivia Database</Text>
                                </View>
                            </View>
                            <Feather name="external-link" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>
                    </View>

                    {/* Help & Legal */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Help & Legal</Text>

                        {/* Terms of Service */}
                        <TouchableOpacity style={styles.settingRow} onPress={() => setShowTerms(true)}>
                            <View style={styles.settingInfo}>
                                <Feather name="book-open" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Terms & Code of Conduct</Text>
                                    <Text style={styles.settingValue}>Rules and guidelines</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>

                        {/* Privacy Policy */}
                        <TouchableOpacity style={styles.settingRow} onPress={() => {
                            Linking.openURL('https://builtbylee.github.io/pinr/');
                        }}>
                            <View style={styles.settingInfo}>
                                <Feather name="shield" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Privacy Policy</Text>
                                    <Text style={styles.settingValue}>Read our privacy policy</Text>
                                </View>
                            </View>
                            <Feather name="external-link" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>

                        {/* Support */}
                        <TouchableOpacity style={styles.settingRow} onPress={() => {
                            Linking.openURL('mailto:pinr.builtbylee@gmail.com?subject=Pinr Support Request');
                        }}>
                            <View style={styles.settingInfo}>
                                <Feather name="help-circle" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Contact Support</Text>
                                    <Text style={styles.settingValue}>Get help or send feedback</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>
                    </View>

                    {/* Account Security Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Security</Text>

                        {/* Change Password */}
                        <TouchableOpacity style={styles.settingRow} onPress={() => {
                            setChangePasswordError(null);
                            setShowChangePassword(true);
                        }}>
                            <View style={styles.settingInfo}>
                                <Feather name="lock" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Change Password</Text>
                                    <Text style={styles.settingValue}>Update your login password</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>

                        {/* Reset Password */}
                        <TouchableOpacity style={styles.settingRow} onPress={async () => {
                            try {
                                const { getCurrentEmail, sendPasswordReset } = require('../services/authService');
                                const email = getCurrentEmail();
                                if (email) {
                                    await sendPasswordReset(email);
                                    alert(`Password reset email sent to ${email}`);
                                } else {
                                    alert('No email associated with this account.');
                                }
                            } catch (e: any) {
                                alert(e.message);
                            }
                        }}>
                            <View style={styles.settingInfo}>
                                <Feather name="mail" size={22} color="#1a1a1a" />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Reset Password</Text>
                                    <Text style={styles.settingValue}>Send reset link to email</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                        </TouchableOpacity>

                        {/* Delete Account */}
                        <TouchableOpacity style={[styles.settingRow, { marginTop: 8 }]} onPress={handleDeleteAccount}>
                            <View style={styles.settingInfo}>
                                <Feather name="trash-2" size={22} color="#FF3B30" />
                                <View style={styles.settingText}>
                                    <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Delete Account</Text>
                                    <Text style={styles.settingValue}>Permanently remove your data</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Sign Out */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={[styles.settingRow, styles.signOutRow]}
                            onPress={async () => {
                                const auth = require('@react-native-firebase/auth').default;
                                clearProfileCache(); // Clear cached profiles on logout
                                await auth().signOut();
                                onClose();
                                // Auth state listener in _layout will handle navigation
                            }}
                        >
                            <View style={styles.settingInfo}>
                                <Feather name="log-out" size={22} color="#FF3B30" />
                                <View style={styles.settingText}>
                                    <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Sign Out</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animated.View>

            <LinkEmailModal
                visible={linkEmailVisible}
                onClose={() => setLinkEmailVisible(false)}
                onSuccess={() => loadProfileData()}
            />

            <TermsModal
                visible={showTerms}
                onClose={() => setShowTerms(false)}
            />

            <ManageVisibilityModal
                visible={isVisibilityModalVisible}
                onClose={() => setIsVisibilityModalVisible(false)}
                friends={friends}
            />
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
        zIndex: 100,
    },
    content: {
        width: '90%',
        height: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        overflow: 'hidden',
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        marginLeft: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
    settingValue: {
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.5)',
        marginTop: 2,
    },
    settingRowIndented: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 245, 247, 0.8)',
        borderRadius: 10,
        padding: 12,
        paddingLeft: 36,
        marginBottom: 6,
        marginTop: 2,
    },
    settingLabelSmall: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    settingValueSmall: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 1,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    avatarContainer: {
        position: 'relative',
        width: 60,
        height: 60,
    },
    avatarImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF00FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    linkAccountRow: {
        backgroundColor: '#007AFF',
    },
    signOutRow: {
        marginTop: 20,
        backgroundColor: 'rgba(255, 59, 48, 0.1)', // Light red
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.2)',
    },
    avatarText: {
        marginLeft: 16,
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    warningText: {
        color: '#FF9500',
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
        fontWeight: '500',
    },
    pinColorSection: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    pinColorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    colorOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    colorOption: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendName: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
    friendActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    muteButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    mutedButtonActive: {
        backgroundColor: '#FF3B30',
    },
    removeFriendButton: {
        padding: 4,
    },
    emptyText: {
        color: 'rgba(0,0,0,0.4)',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    requestsContainer: {
        marginBottom: 16,
    },
    subHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    requestName: {
        marginLeft: 8,
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    requestActions: {
        flexDirection: 'row',
    },
    requestButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
