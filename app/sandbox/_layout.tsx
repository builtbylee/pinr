import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function SandboxLayout() {
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#fff',
                    },
                    headerTintColor: '#000',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    contentStyle: {
                        backgroundColor: '#f5f5f5',
                    }
                }}
            >
                <Stack.Screen
                    name="index"
                    options={{
                        title: 'Sandbox Lab 🧪'
                    }}
                />
                <Stack.Screen
                    name="notifications"
                    options={{
                        title: 'Notification Test'
                    }}
                />
                <Stack.Screen
                    name="games"
                    options={{
                        title: 'Games',
                        headerShown: true,
                    }}
                />
            </Stack>
        </View>
    );
}
