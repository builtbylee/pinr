import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { notificationService } from '../../src/services/NotificationService';
import { getCurrentUser } from '../../src/services/authService';
import { getUserProfile, getFriends } from '../../src/services/userService';
// OneSignal imported conditionally to prevent crash if module not linked
let OneSignal: any;
try {
  const oneSignalModule = require('react-native-onesignal');
  OneSignal = oneSignalModule.OneSignal;
} catch (e) {
  console.warn('[NotificationsSandbox] OneSignal module not available:', e);
  OneSignal = null;
}

export default function NotificationTest() {
    const [permissionStatus, setPermissionStatus] = useState<string>('checking');
    const [pushToken, setPushToken] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
        console.log(`[Sandbox] ${msg}`);
    };

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        if (!OneSignal) {
            setPermissionStatus('unavailable');
            addLog('OneSignal not available');
            return;
        }
        const hasPermission = OneSignal.Notifications.hasPermission();
        setPermissionStatus(hasPermission ? 'granted' : 'denied');
        addLog(`Permission checked: ${hasPermission ? 'granted' : 'denied'}`);
    };

    const handleRequestPermissions = async () => {
        setLoading(true);
        try {
            addLog('Requesting permissions via OneSignal...');
            const granted = await notificationService.requestPermissions();
            setPermissionStatus(granted ? 'granted' : 'denied');
            if (granted && OneSignal) {
                // Get the player ID / push subscription ID
                const id = OneSignal.User.pushSubscription.getPushSubscriptionId();
                setPushToken(id || 'Registered (ID hidden)');
                addLog(`Success! Subscription ID available`);
            } else {
                addLog('Permission denied');
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLocalNotification = async () => {
        addLog('Local notifications not supported in OneSignal client-side directly.');
    };

    const handleRemoteNotification = async () => {
        addLog('Remote push test via client not directly supported with OneSignal integration structure.');
    };

    // Test sendGameInvite directly (bypasses ChallengeService)
    const handleTestGameInvite = async () => {
        addLog('Testing sendGameInvite...');
        setLoading(true);
        try {
            // Dynamically get current user's first friend
            const currentUser = getCurrentUser();
            if (!currentUser) {
                addLog('ERROR: No current user logged in');
                setLoading(false);
                return;
            }
            addLog(`Current user UID: ${currentUser.uid}`);

            const myProfile = await getUserProfile(currentUser.uid);
            addLog(`My profile found: ${!!myProfile}`);
            const friendIds = await getFriends(currentUser.uid);
            addLog(`My friends list: ${JSON.stringify(friendIds || [])}`);

            if (!friendIds || friendIds.length === 0) {
                addLog('ERROR: You have no friends to send to');
                setLoading(false);
                return;
            }

            const friendUid = friendIds[0];
            addLog(`Sending to first friend: ${friendUid}`);

            const result = await notificationService.sendGameInvite(friendUid, 'Test Invite');

            // Display all diagnostic steps
            addLog('--- DIAGNOSTIC STEPS ---');
            for (const step of result.steps) {
                addLog(step);
            }
            addLog('--- END STEPS ---');

            if (result.success) {
                addLog('✅ SUCCESS: Notification sent!');
            } else {
                addLog(`❌ FAILED: ${result.error}`);
            }
        } catch (e: any) {
            addLog(`sendGameInvite exception: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.statusCard}>
                <Text style={styles.label}>Permission Status</Text>
                <View style={styles.statusRow}>
                    <View style={[styles.badge, { backgroundColor: permissionStatus === 'granted' ? '#D1FAE5' : '#FEE2E2' }]}>
                        <Text style={[styles.badgeText, { color: permissionStatus === 'granted' ? '#065F46' : '#991B1B' }]}>
                            {permissionStatus.toUpperCase()}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={checkPermissions}>
                        <Feather name="refresh-cw" size={18} color="#666" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions</Text>

                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={handleRequestPermissions}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Feather name="shield" size={18} color="#fff" />}
                    <Text style={styles.primaryButtonText}>Request Permissions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={handleLocalNotification}
                >
                    <Feather name="bell" size={18} color="#4F46E5" />
                    <Text style={styles.secondaryButtonText}>Test Local Notification (2s)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton, { marginTop: 12, borderColor: '#D97706' }]}
                    onPress={handleRemoteNotification}
                    disabled={loading || !pushToken}
                >
                    <Feather name="send" size={18} color="#D97706" />
                    <Text style={[styles.secondaryButtonText, { color: '#D97706' }]}>Test Remote Push (Self)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton, { marginTop: 12, borderColor: '#10B981' }]}
                    onPress={handleTestGameInvite}
                    disabled={loading}
                >
                    <Feather name="zap" size={18} color="#10B981" />
                    <Text style={[styles.secondaryButtonText, { color: '#10B981' }]}>Test Game Invite (to friend)</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Token</Text>
                <View style={styles.tokenBox}>
                    <Text style={styles.tokenText} selectable>
                        {pushToken || 'No token generated yet'}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Debug Log</Text>
                <View style={styles.logBox}>
                    {logs.map((log, index) => (
                        <Text key={index} style={styles.logText}>{log}</Text>
                    ))}
                    {logs.length === 0 && <Text style={styles.logText}>No logs yet...</Text>}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
    },
    statusCard: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        color: '#888',
        marginBottom: 12,
        letterSpacing: 1,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        gap: 8,
    },
    primaryButton: {
        backgroundColor: '#111',
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    secondaryButtonText: {
        color: '#4F46E5',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    tokenBox: {
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tokenText: {
        fontFamily: 'Courier',
        color: '#4B5563',
        fontSize: 12,
    },
    logBox: {
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 12,
        minHeight: 200,
    },
    logText: {
        color: '#E2E8F0',
        fontFamily: 'Courier',
        fontSize: 12,
        marginBottom: 4,
    },
});
