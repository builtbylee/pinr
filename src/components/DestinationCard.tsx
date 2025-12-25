import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    const [creatorUsername, setCreatorUsername] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<number>(1);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

    // Check if current user is the creator of this memory (needed early for card dims)
    const isOwner = memory.creatorId === currentUserId;

    // Detect if photo is landscape (wider than tall)
    const isLandscape = aspectRatio > 1.3; // Consider landscape if aspect ratio > 1.3

    // Calculate dimensions based on aspect ratio
    const getCardDimensions = () => {
        if (isLandscape) {
            // For landscape photos, make card wider and shorter (displayed rotated)
            const cardWidth = height * 0.85; // Use screen height as card width (because rotated)
            const cardHeight = width * 0.9;  // Use screen width as card height (because rotated)
            return { width: cardWidth, height: cardHeight };
        }

        // Portrait/square photos - original logic
        const maxWidth = width * 0.95;
        const maxHeight = height * 0.85;
        const headerHeight = 100;
        const footerHeight = isOwner ? 80 : 20;

        if (!imageSize) return { width: maxWidth, height: maxHeight };

        const targetImageHeight = maxHeight - headerHeight - footerHeight;
        const targetImageWidth = targetImageHeight * (imageSize.width / imageSize.height);

        if (targetImageWidth > maxWidth) {
            const scaledHeight = maxWidth * (imageSize.height / imageSize.width);
            return {
                width: maxWidth,
                height: scaledHeight + headerHeight + footerHeight
            };
        }

        return {
            width: Math.max(targetImageWidth, width * 0.8),
            height: maxHeight
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

    // Fetch creator's username
    useEffect(() => {
        const fetchUsername = async () => {
            if (memory.creatorId) {
                const username = await getUsername(memory.creatorId);
                setCreatorUsername(username);
            }
        };
        fetchUsername();
    }, [memory.creatorId]);

    const handlePickImage = async () => {
        // Basic implementation of image picker integration
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0 && onAddPhoto) {
            onAddPhoto(result.assets[0].uri);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Pin',
            `Are you sure you want to delete this pin at "${memory.locationName}"? This action cannot be undone.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePin(memory.id);
                            // Card will auto-close when Firestore sync updates
                        } catch (error) {
                            console.error('[DestinationCard] Delete failed:', error);
                            Alert.alert('Error', 'Failed to delete pin. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    // Display username - use username if available, otherwise first 6 chars of UID as fallback
    const displayName = creatorUsername
        || (memory.creatorId ? memory.creatorId.slice(0, 6) : 'Unknown');

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
        <View style={styles.container}>
            <View style={[
                styles.content,
                {
                    width: cardDims.width,
                    height: cardDims.height,
                    // Rotate card 90 degrees for landscape photos
                    transform: isLandscape ? [{ rotate: '90deg' }] : [],
                }
            ]}>
                {/* Header - Compact layout */}
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.mainTitle}>{memory.title}</Text>
                            {isOwner && remainingTime && (
                                <View style={styles.expiryBadge}>
                                    <Feather name="clock" size={12} color="#D97706" />
                                    <Text style={styles.expiryText}>{remainingTime}</Text>
                                </View>
                            )}
                        </View>
                        {/* Location and Date on one line */}
                        <View style={styles.subheaderRow}>
                            <Feather name="map-pin" size={14} color="rgba(0,0,0,0.5)" />
                            <Text style={styles.locationSubheader}>{memory.locationName}</Text>
                            <Text style={styles.locationSubheader}> • </Text>
                            <Feather name="calendar" size={14} color="rgba(0,0,0,0.5)" />
                            <Text style={styles.dateSubheader}>{formatMemoryDate(memory.date)}</Text>
                        </View>
                    </View>
                    {/* Action buttons - Close, Edit, Delete (only for owner) */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {isOwner && (
                            <>
                                <TouchableOpacity onPress={onEdit} style={styles.closeButton}>
                                    <Feather name="edit-2" size={20} color="#007AFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleDelete} style={styles.closeButton}>
                                    <Feather name="trash-2" size={20} color="#FF3B30" />
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color="#1a1a1a" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.cardBody, { flex: 1 }]}>
                    {memory.imageUris.length > 0 ? (
                        <View style={[styles.heroImageContainer, { flex: 1, width: '100%' }]}>
                            <Image
                                source={{ uri: memory.imageUris[0] }}
                                style={styles.heroImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={200}
                                placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No photo available.</Text>
                        </View>
                    )}
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
    },
    content: {
        // dynamic width/height handled in inline styles
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Solid background
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        padding: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 20,
    },
    titleContainer: {
        flex: 1,
        marginRight: 16,
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subheaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    locationSubheader: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.6)',
        fontWeight: '500',
    },
    locationTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    dateSubheader: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.6)',
        fontWeight: '400',
    },
    usernameTag: {
        fontSize: 12,
        color: 'rgba(0, 0, 0, 0.5)',
        marginTop: 8,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    date: {
        fontSize: 16,
        color: 'rgba(0, 0, 0, 0.6)',
        marginTop: 8,
    },
    cardBody: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImageContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    emptyState: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    emptyText: {
        color: 'rgba(0,0,0,0.5)',
        fontStyle: 'italic',
        fontSize: 16,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(220, 53, 69, 0.8)', // Red danger color
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    deleteButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    addPhotoText: {
        color: 'white',
        fontWeight: '600',
    },
    expiryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    expiryText: {
        fontSize: 12,
        color: '#D97706',
        fontWeight: '600',
    },
});
