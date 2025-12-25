import { Link } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function SandboxMenu() {
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Development Sandbox</Text>
                <Text style={styles.subtitle}>Isolate. Build. Test.</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prototypes</Text>

                <Link href={"/sandbox/notifications" as any} asChild>
                    <TouchableOpacity style={styles.card}>
                        <View style={[styles.iconBox, { backgroundColor: '#E0E7FF' }]}>
                            <Feather name="bell" size={24} color="#4F46E5" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>Notification System</Text>
                            <Text style={styles.cardDesc}>Test permissions, tokens, and local triggers.</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </Link>

                <Link href={"/sandbox/games" as any} asChild>
                    <TouchableOpacity style={styles.card}>
                        <View style={[styles.iconBox, { backgroundColor: '#FCE7F3' }]}>
                            <Feather name="flag" size={24} color="#DB2777" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>Flag Dash (Arcade)</Text>
                            <Text style={styles.cardDesc}>Time attack geography game prototype.</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </Link>

                {/* Placeholder for Game Hub */}
                <TouchableOpacity style={[styles.card, { opacity: 0.5 }]}>
                    <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Feather name="award" size={24} color="#D97706" />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>Game Hub (Coming Soon)</Text>
                        <Text style={styles.cardDesc}>Flag Dash engine and UI.</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        color: '#888',
        marginBottom: 10,
        letterSpacing: 1,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
    },
    cardDesc: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
});
