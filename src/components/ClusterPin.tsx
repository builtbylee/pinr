import { StyleSheet, View, Text, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ClusterPinProps {
    count: number;
    color?: string;
    onPress?: () => void;
}

/**
 * ClusterPin - Represents a group of aggregated pins
 * Shows the count of items in the cluster.
 */
export const ClusterPin: React.FC<ClusterPinProps> = ({ count, color = '#FFD700', onPress }) => {
    return (
        <View style={styles.container}>
            {/* Shadow */}
            <View style={styles.pinShadow} />

            {/* Pin Body (Teardrop) */}
            <View style={[styles.pinBody, { backgroundColor: color }]}>
                <View style={styles.iconContainer}>
                    <View style={styles.innerCircle}>
                        <Feather name="users" size={18} color="white" />
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 70, // Taller to accommodate the point
    },
    pinShadow: {
        position: 'absolute',
        width: 46,
        height: 46,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 23,
        borderBottomLeftRadius: 0,
        transform: [{ rotate: '-45deg' }, { translateY: 2 }],
        top: 14,
    },
    pinBody: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 46,
        height: 46,
        borderTopLeftRadius: 23,
        borderTopRightRadius: 23,
        borderBottomRightRadius: 23,
        borderBottomLeftRadius: 0,
        transform: [{ rotate: '-45deg' }],
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF', // White ring
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '45deg' }], // Counter-rotate
    },
    innerCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#1a1a1a', // Dark center
        alignItems: 'center',
        justifyContent: 'center',
    },
});
