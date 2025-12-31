import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, Text, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { BucketListItem } from '../services/userService';

const { width, height } = Dimensions.get('window');

interface BucketListActionModalProps {
    visible: boolean;
    onClose: () => void;
    item: BucketListItem | null;
    isOwner: boolean;
    onView: (item: BucketListItem) => void;
    onRemove: (item: BucketListItem) => void;
    onMarkBooked?: (item: BucketListItem) => void;
}

export const BucketListActionModal: React.FC<BucketListActionModalProps> = ({
    visible,
    onClose,
    item,
    isOwner,
    onView,
    onRemove,
    onMarkBooked
}) => {
    if (!item) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <Animated.View
                    entering={ZoomIn.duration(250).springify().damping(15)}
                    exiting={FadeOut}
                    style={styles.card}
                >
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Feather name="x" size={20} color="#1a1a1a" />
                    </TouchableOpacity>
                    {item.imageUrl && (
                        <View style={styles.imageHeader}>
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                                transition={300}
                            />
                        </View>
                    )}

                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={styles.title} numberOfLines={2}>{item.locationName}</Text>

                        </View>

                        {/* Only show country if it exists and is different from location name */}
                        {item.countryName && item.countryName !== item.locationName && (
                            <Text style={styles.subtitle}>
                                {item.countryName}
                            </Text>
                        )}

                        <View style={styles.divider} />


                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton]}
                                onPress={() => onView(item)}
                            >
                                <Feather name="map-pin" size={18} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryButtonText}>Explore Location</Text>
                            </TouchableOpacity>

                            {isOwner && onMarkBooked && (
                                <TouchableOpacity
                                    style={[styles.button, item.status === 'booked' ? styles.bookedButton : styles.bookButton]}
                                    onPress={() => onMarkBooked(item)}
                                >
                                    <Feather
                                        name={item.status === 'booked' ? "check-circle" : "calendar"}
                                        size={18}
                                        color={item.status === 'booked' ? "#10B981" : "#1a1a1a"}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={item.status === 'booked' ? styles.bookedButtonText : styles.bookButtonText}>
                                        {item.status === 'booked' ? "Booked ✓" : "Mark as Booked"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {isOwner && (
                                <TouchableOpacity
                                    style={[styles.button, styles.secondaryButton]}
                                    onPress={() => onRemove(item)}
                                >
                                    <Feather name="trash-2" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
                                    <Text style={styles.secondaryButtonText}>Remove</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        width: width,
        height: height,
        backgroundColor: 'rgba(0,0,0,0.5)', // Slightly darker for better focus
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        width: width,
        height: height,
        position: 'absolute',
        top: 0,
        left: 0,
    },
    card: {
        width: width * 0.85,
        backgroundColor: 'white',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    imageHeader: {
        height: 120,
        backgroundColor: '#eee',
    },
    content: {
        padding: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        flex: 1,
        marginRight: 10,
        fontFamily: 'System', // Use default or custom font
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
        marginBottom: 16,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        padding: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        color: '#444',
        marginBottom: 24,
        lineHeight: 20,
    },
    actionRow: {
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
    },
    primaryButton: {
        backgroundColor: '#1a1a1a',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#FFF0F0',
        borderWidth: 1,
        borderColor: '#FFDbd9',
    },
    secondaryButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
    },
    bookButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    bookButtonText: {
        color: '#1a1a1a',
        fontSize: 16,
        fontWeight: '600',
    },
    bookedButton: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    bookedButtonText: {
        color: '#10B981',
        fontSize: 16,
        fontWeight: '600',
    },
});
