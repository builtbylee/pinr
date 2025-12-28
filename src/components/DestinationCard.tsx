import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
        if (memory.imageUris.length > 0) {
            // Get original image size
            import('react-native').then(({ Image: RNImage }) => {
                RNImage.getSize(memory.imageUris[0], (w, h) => {
                    setImageSize({ width: w, height: h });
                    setAspectRatio(w / h);
                });
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
                            await deletePin(memory.id);
                        } catch (error) {
                            console.error('[DestinationCard] Delete failed:', error);
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

                {/* 3. Gradient & Text Overlay (Bottom) */}
                <View style={styles.gradientOverlay}>
                    <View style={styles.textContainer}>
                        {/* Title Row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.title} numberOfLines={2}>{memory.title}</Text>
                            {/* Expiry Badge if needed */}
                            {remainingTime && (
                                <View style={styles.expiryBadge}>
                                    <Feather name="clock" size={12} color="#D97706" />
                                    <Text style={styles.expiryText}>{remainingTime}</Text>
                                </View>
                            )}
                        </View>

                        {/* Details Row */}
                        <View style={styles.detailsRow}>
                            <View style={styles.detailItem}>
                                <Feather
                                    name="map-pin"
                                    size={14}
                                    color="white"
                                    style={{ textShadowColor: 'black', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}
                                />
                                <Text style={styles.detailText} numberOfLines={1}>{memory.locationName}</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Feather
                                    name="calendar"
                                    size={14}
                                    color="white"
                                    style={{ textShadowColor: 'black', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}
                                />
                                <Text style={styles.detailText}>{formatMemoryDate(memory.date)}</Text>
                            </View>
                        </View>
                    </View>
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
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%', // Cover bottom 40%
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        paddingBottom: 32,
        // Removed dark background, replaced with text shadows
        backgroundColor: 'transparent',
    },
    textContainer: {
        width: '100%',
        gap: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        // Strong "Outline" Shadow
        textShadowColor: 'black',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        flex: 1,
        marginRight: 8,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        // Strong "Outline" Shadow
        textShadowColor: 'black',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    expiryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(254, 243, 199, 0.9)', // Light yellow
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    expiryText: {
        fontSize: 12,
        color: '#D97706',
        fontWeight: '700',
    },
});
