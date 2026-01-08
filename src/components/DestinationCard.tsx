import { Feather } from '@expo/vector-icons';
import { LiquidGlass } from './LiquidGlass';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, Image as RNImage } from 'react-native';
// Note: ViewShot removed until native rebuild - using text sharing fallback
import { Memory, useMemoryStore } from '../store/useMemoryStore';
import { deletePin } from '../services/firestoreService';
import { getUsername } from '../services/userService';
import { formatMemoryDate } from '../utils/dateFormatter';

interface DestinationCardProps {
    memory: Memory;
    onClose: () => void;
    onAddPhoto?: (uri: string) => void;
    onRemovePhoto?: (uri: string) => void;
    onSelectUser: (userId: string) => void;
    onEdit?: () => void;
}

const { width, height } = Dimensions.get('window');

export const DestinationCard: React.FC<DestinationCardProps> = ({ memory, onClose, onAddPhoto, onRemovePhoto, onSelectUser, onEdit }) => {
    const { currentUserId, deleteMemory, selectMemory } = useMemoryStore();
    const [aspectRatio, setAspectRatio] = useState<number>(1);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

    // Check if current user is the creator of this memory
    const isOwner = memory.creatorId === currentUserId;

    // Detect if photo is landscape (wider than tall)
    const isLandscape = aspectRatio > 1.3;

    // Calculate dimensions based on aspect ratio
    const getCardDimensions = () => {
        if (isLandscape) {
            // For landscape photos, make card wider and shorter (displayed rotated)
            const cardWidth = height * 0.85; // Use screen height as card width (because rotated)
            const cardHeight = width * 0.9;  // Use screen width as card height (because rotated)
            return { width: cardWidth, height: cardHeight };
        }

        // Portrait/square photos - fill mostly vertical
        return {
            width: width * 0.9,
            height: height * 0.75 // Taller immersive card
        };
    };

    useEffect(() => {
        if (memory.imageUris && memory.imageUris.length > 0) {
            // Get original image size (using static import to avoid bridge contention on iOS)
            RNImage.getSize(memory.imageUris[0], (w, h) => {
                setImageSize({ width: w, height: h });
                setAspectRatio(w / h);
            });
        }
    }, [memory.imageUris]);

    const cardDims = getCardDimensions();

    const handleDelete = () => {
        Alert.alert(
            'Delete Pin',
            `Are you sure you want to delete this pin at "${memory.locationName}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Delete from Firestore
                            await deletePin(memory.id);
                            
                            // Remove from local store
                            deleteMemory(memory.id);
                            
                            // Close the card and deselect
                            selectMemory(null);
                            onClose();
                        } catch (error: any) {
                            if (__DEV__) console.error('[DestinationCard] Delete failed:', error?.message || 'Unknown error');
                            Alert.alert('Error', 'Failed to delete pin. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    // Expiration Logic
    const getRemainingTime = () => {
        if (!memory.expiresAt) return null;
        const diffMs = memory.expiresAt - Date.now();
        if (diffMs <= 0) return 'Expired';
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d left`;
        if (hours > 0) return `${hours}h left`;
        return `${Math.floor(diffMs / (1000 * 60))}m left`;
    };
    const remainingTime = getRemainingTime();

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={[
                styles.content,
                {
                    width: cardDims.width,
                    height: cardDims.height,
                    transform: isLandscape ? [{ rotate: '90deg' }] : [],
                }
            ]}>
                {/* 1. Full Bleed Image */}
                {memory.imageUris.length > 0 ? (
                    <Image
                        source={{ uri: memory.imageUris[0] }}
                        style={styles.heroImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                        placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No photo available.</Text>
                    </View>
                )}

                {/* 2. Controls Overlay (Top Right) */}
                <View style={styles.topControls}>
                    {isOwner && (
                        <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
                            <Feather name="trash-2" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <Feather name="x" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* 3. Compact Frosted Pill (Bottom) - LiquidGlass for both platforms */}
                <View style={styles.pillContainer}>
                    <LiquidGlass
                        intensity={Platform.OS === 'ios' ? 40 : 40}
                        tint="light"
                        style={styles.blurPill}
                    >
                        <View style={[
                            styles.blurOverlay,
                            Platform.OS === 'android' ? styles.blurOverlayAndroid : null
                        ]}>
                            <View style={styles.frostedPillContent}>
                                {/* Line 1: Title */}
                                <Text style={styles.pillTitleGlass} numberOfLines={1}>{memory.title}</Text>
                                {/* Line 2: Location & Date */}
                                <View style={styles.pillDetailsRow}>
                                    <View style={styles.iconContainer}>
                                        <Feather name="map-pin" size={12} color="#FFFFFF" />
                                    </View>
                                    <Text style={styles.pillDetailGlass} numberOfLines={1}>{memory.locationName?.split(',')[0] || 'Unknown'}</Text>
                                    <View style={styles.iconContainer}>
                                        <Feather name="calendar" size={12} color="#FFFFFF" />
                                    </View>
                                    <Text style={styles.pillDetailGlass}>{formatMemoryDate(memory.date, memory.endDate)}</Text>
                                    {/* Expiry Badge if needed */}
                                    {remainingTime && (
                                        <>
                                            <View style={styles.iconContainer}>
                                                <Feather name="clock" size={12} color="#FBBF24" />
                                            </View>
                                            <Text style={[styles.pillDetailGlass, { color: '#FBBF24' }]}>{remainingTime}</Text>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                    </LiquidGlass>
                </View>
            </View>
        </View>
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
        zIndex: 1000,
        // No backdrop blur requested, assuming clear or existing map context
    },
    content: {
        // dynamic width/height set inline
        backgroundColor: '#1a1a1a', // Dark background behind image
        borderRadius: 30, // Smooth rounded corners
        overflow: 'hidden', // Clip image to corners
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 20,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#eee',
    },
    emptyText: {
        color: '#999',
    },
    topControls: {
        position: 'absolute',
        top: 20,
        right: 20,
        flexDirection: 'row',
        gap: 12,
        zIndex: 10,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent dark
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)', // Works on iOS
    },
    pillContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    blurPill: {
        borderRadius: 24,
        overflow: 'hidden',
        maxWidth: '90%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)', // Lighter border for light frosted glass
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    blurOverlay: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)', // Light overlay for frosted glass effect
        width: '100%',
    },
    blurOverlayAndroid: {
        // Darker shade of white on Android to match iOS appearance
        backgroundColor: 'rgba(120, 120, 120, 0.3)',
    },
    frostedPill: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(245, 245, 245, 0.92)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 4,
        maxWidth: '90%',
        // Subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    frostedPillBlur: {
        borderRadius: 24,
        overflow: 'hidden',
        maxWidth: '90%',
        // Glass edge border
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    frostedPillContent: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 4,
        // NO backgroundColor - let the blur show through!
    },
    pillTitleGlass: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    pillDetailGlass: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    pillTitle: {
        color: '#1a1a1a',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    pillDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconContainer: {
        // Ensure icons have no shadows
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0, // Android
    },
    pillDetail: {
        color: 'rgba(0, 0, 0, 0.6)',
        fontSize: 12,
        fontWeight: '500',
    },
});
