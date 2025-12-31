import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { getPlaceDetails, WikiPlaceDetails } from '../services/wikiService';

import { useMemoryStore } from '../store/useMemoryStore';
import { addToBucketList, getUserProfile } from '../services/userService';
import { GeocodingResult } from '../services/geocodingService';
import { Alert } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ExploreInfoCardProps {
    placeName: string;
    location?: GeocodingResult; // Need coordinates!
    onClose: () => void;
}

export const ExploreInfoCard: React.FC<ExploreInfoCardProps> = ({ placeName, location, onClose }) => {
    const [details, setDetails] = useState<WikiPlaceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [isInBucketList, setIsInBucketList] = useState(false);

    // Store access
    const { currentUserId, showToast } = useMemoryStore();

    // 1. Fetch Details & Check Streak
    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            // WikiService now handles splitting and permutations (e.g. "Takoradi, Ghana" -> attempts "Takoradi")
            // So we pass the full name for maximum context.
            const result = await getPlaceDetails(placeName);
            setDetails(result);
            setLoading(false);
        };
        fetchDetails();

        // Check Bucket List Status
        if (currentUserId) {
            // Note: Streak is now tracked in handleExploreSelect in app/index.tsx
            // which shows the celebration modal instead of a toast

            // Check if already in bucket list
            getUserProfile(currentUserId).then(profile => {
                if (profile?.bucketList) {
                    const exists = profile.bucketList.some(item => item.locationName === placeName);
                    setIsInBucketList(exists);
                }
            });
        }
    }, [placeName, location, currentUserId]);

    const handleAddToBucketList = async () => {
        if (!currentUserId || !location) {
            Alert.alert("Error", "You must be logged in to add to your list.");
            return;
        }

        setAdding(true);
        try {
            await addToBucketList(currentUserId, {
                locationName: placeName,
                countryName: location.context?.find(c => c.id.startsWith('country'))?.text || '', // Fallback to empty string
                location: location.center,
                imageUrl: details?.thumbnail?.source || '', // Fallback to empty string
                status: 'wishlist',
                addedAt: Date.now(),
            });

            // Update button state to show success (green) - no alert, no auto-close
            setIsInBucketList(true);
        } catch (error) {
            console.error("Failed to add bucket list item:", error);
            Alert.alert("Error", "Could not add to bucket list.");
        } finally {
            setAdding(false);
        }
    };

    // UI Structure reused from DestinationCard, but tailored for scrolling text
    // The DestinationCard has a rotated look. We keep that.

    const cardWidth = width * 0.9;
    const cardHeight = height * 0.75;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={[styles.content, { width: cardWidth, height: cardHeight }]}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.mainTitle}>{details?.title || placeName}</Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        style={({ pressed }) => [
                            styles.closeButton,
                            pressed && { opacity: 0.7 }
                        ]}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Feather name="x" size={24} color="#1a1a1a" />
                    </Pressable>
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#1a1a1a" />
                    ) : (
                        <>
                            {/* Photo Area */}
                            <View style={styles.imageContainer}>
                                {details?.thumbnail ? (
                                    <Image
                                        source={{ uri: details.originalimage?.source || details.thumbnail.source }}
                                        style={styles.image}
                                        contentFit="cover"
                                        transition={500}
                                    />
                                ) : (
                                    <View style={styles.placeholderContainer}>
                                        <Feather name="image" size={40} color="gray" />
                                        <Text style={{ color: 'gray', marginTop: 10 }}>No Image Found</Text>
                                    </View>
                                )}
                            </View>

                            {/* Scrollable Description */}
                            <ScrollView style={styles.textScroll} contentContainerStyle={styles.textContainer}>
                                <Text style={styles.description}>
                                    {details?.extract || details?.description || "No details available."}
                                </Text>
                            </ScrollView>

                            {/* Bucket List Button */}
                            <TouchableOpacity
                                style={[styles.actionButton, (adding || isInBucketList) && { opacity: 0.7, backgroundColor: isInBucketList ? '#22CC66' : '#1a1a1a' }]}
                                onPress={handleAddToBucketList}
                                disabled={adding || isInBucketList}
                            >
                                {adding ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Feather name={isInBucketList ? "check" : "plus-circle"} size={18} color="white" />
                                        <Text style={styles.actionButtonText}>
                                            {isInBucketList ? "Added to Bucket List" : "Add to Bucket List"}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </>
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
        zIndex: 2000,
        elevation: 100, // Ensure touchable on Android
        // Transparent background
    },
    content: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        // Straight layout

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    subheaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    locationSubheader: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.6)',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 20,
    },
    cardBody: {
        flex: 1,
    },
    imageContainer: {
        height: '45%',
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        marginBottom: 16,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textScroll: {
        flex: 1,
        marginBottom: 16,
    },
    textContainer: {
        paddingRight: 10,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
    },
    actionButton: {
        flexDirection: 'row',
        backgroundColor: '#000', // Black for contrast/premium
        // Or Cyan #00FFFF if user wants neon? But card is white. Let's stick to clean.
        paddingVertical: 12,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
