import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { sendFriendRequest, getUserByUsername, getUserProfile } from '@/src/services/userService';
import { useMemoryStore } from '@/src/store/useMemoryStore';

export default function FriendAddRoute() {
    const { username } = useLocalSearchParams<{ username: string }>();
    const router = useRouter();
    const { currentUserId, username: myUsername } = useMemoryStore();

    useEffect(() => {
        if (!username) return;

        console.log('[FriendAddRoute] Processing:', username);

        const processAdd = async () => {
            // 1. Check strict params
            if (!currentUserId || !myUsername) {
                Alert.alert('Not Logged In', 'Please log in to add friends.', [
                    { text: 'OK', onPress: () => router.replace('/') }
                ]);
                return;
            }

            // 2. Confirm User Action
            Alert.alert(
                'Friend Request',
                `Add ${username} as a friend?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => router.replace('/')
                    },
                    {
                        text: 'Add Friend',
                        onPress: async () => {
                            try {
                                const targetUser = await getUserByUsername(username);
                                if (targetUser) {
                                    const result = await sendFriendRequest(currentUserId, myUsername, targetUser.uid);
                                    Alert.alert(
                                        result.success ? 'Success' : 'Notice',
                                        result.message,
                                        [{ text: 'OK', onPress: () => router.replace('/') }]
                                    );
                                } else {
                                    Alert.alert('Error', 'User not found.', [
                                        { text: 'OK', onPress: () => router.replace('/') }
                                    ]);
                                }
                            } catch (e) {
                                Alert.alert('Error', 'Failed to add friend.');
                                router.replace('/');
                            }
                        }
                    }
                ]
            );
        };

        processAdd();

    }, [username, currentUserId, myUsername]);

    return (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#white" />
        </View>
    );
}
