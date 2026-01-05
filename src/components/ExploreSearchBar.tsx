import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Dimensions, Platform, TouchableOpacity, Text, ScrollView, ActivityIndicator, Keyboard, BackHandler, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GeocodingResult } from '../services/geocodingService';
import { searchWikiPlaces } from '../services/wikiService';
import { useMemoryStore } from '../store/useMemoryStore';

const { width } = Dimensions.get('window');

interface ExploreSearchBarProps {
    visible: boolean;
    onClose: () => void;
    onSelectLocation: (location: GeocodingResult) => void;
}

export const ExploreSearchBar: React.FC<ExploreSearchBarProps> = ({ visible, onClose, onSelectLocation }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeocodingResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Recent searches from persisted store (with defensive fallback)
    const recentExploreLocations = useMemoryStore((state) => state.recentExploreLocations) || [];
    const addRecentExploreLocation = useMemoryStore((state) => state.addRecentExploreLocation);

    // Handle Hardware Back Button (Android)
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            onClose();
            return true; // Prevent default behavior (exit app)
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => subscription.remove();
    }, [visible, onClose]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 3) {
                setLoading(true);
                // Use Wikipedia Search for Explore Mode (Rich content + Images)
                const places = await searchWikiPlaces(query);
                setResults(places);
                setLoading(false);
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Handle location selection
    const handleSelectLocation = (item: GeocodingResult) => {
        // Save to recent searches
        addRecentExploreLocation({
            id: item.id,
            text: item.text,
            place_name: item.place_name,
            center: item.center,
            image: item.image,
        });

        onSelectLocation(item);
        setQuery('');
        setResults([]);
    };

    if (!visible) return null;

    // Show recents when query is empty
    const showRecents = query.length === 0 && recentExploreLocations.length > 0;
    const showResults = results.length > 0 || loading;

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* White/Glass Card Style */}
            <View style={styles.cardContainer}>
                <View style={styles.inputRow}>
                    <Feather name="search" size={20} color="#1a1a1a" />
                    <TextInput
                        testID="explore-search-input"
                        style={styles.input}
                        placeholder="Search cities, countries..."
                        placeholderTextColor="rgba(0,0,0,0.4)"
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <Feather name="x" size={18} color="rgba(0,0,0,0.5)" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => {
                            Keyboard.dismiss();
                            onClose();
                        }}
                        style={styles.cancelButton}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Searches */}
                {showRecents && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            style={{ maxHeight: 250 }}
                        >
                            {recentExploreLocations.map((item) => (
                                <Pressable
                                    key={`recent-${item.id}`}
                                    style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: '#f5f5f5' }]}
                                    onPress={() => handleSelectLocation(item as GeocodingResult)}
                                >
                                    {item.image ? (
                                        <Image
                                            source={item.image}
                                            style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#eee' }}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    ) : (
                                        <View style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}>
                                            <Feather name="clock" size={16} color="#888" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Text style={styles.resultTitle}>{item.text}</Text>
                                        <Text style={styles.resultSubtitle}>{item.place_name}</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Search Results List */}
                {showResults && (
                    <View style={styles.resultsContainer}>
                        {loading ? (
                            <ActivityIndicator color="#1a1a1a" style={{ padding: 20 }} />
                        ) : (
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                style={{ maxHeight: 300 }}
                                contentContainerStyle={{ flexGrow: 1 }}
                            >
                                {results.map((item) => (
                                    <Pressable
                                        key={item.id}
                                        style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: '#f5f5f5' }]}
                                        onPress={() => handleSelectLocation(item)}
                                    >
                                        {/* Thumbnail or Fallback Icon */}
                                        {item.image ? (
                                            <Image
                                                source={item.image}
                                                style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#eee' }}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        ) : (
                                            <Feather name="map-pin" size={16} color="#000" style={{ marginRight: 10, marginLeft: 12 }} />
                                        )}

                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            <Text style={styles.resultTitle}>{item.text}</Text>
                                            <Text style={styles.resultSubtitle}>{item.place_name}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60, // Safe area top
        width: width * 0.9,
        alignSelf: 'center',
        zIndex: 2000,
        elevation: 100, // Ensure high elevation on Android
    },
    cardContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        // Optional: slight rotation for style consistency if desired, 
        // but normally search bars are straight. Let's keep it straight for usability.
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    input: {
        flex: 1,
        color: '#1a1a1a',
        fontSize: 16,
        paddingVertical: 8,
        fontWeight: '500',
    },
    cancelButton: {
        marginLeft: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
    },
    cancelText: {
        color: '#1a1a1a',
        fontWeight: '600',
        fontSize: 14,
    },
    resultsContainer: {
        marginTop: 15,
        maxHeight: 300,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    resultTitle: {
        color: '#1a1a1a',
        fontWeight: 'bold',
        fontSize: 16,
    },
    resultSubtitle: {
        color: 'rgba(0,0,0,0.5)',
        fontSize: 12,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

