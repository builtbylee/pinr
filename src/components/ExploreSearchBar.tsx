import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Dimensions, Platform, TouchableOpacity, Text, ScrollView, ActivityIndicator, Keyboard, BackHandler, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GeocodingResult } from '../services/geocodingService';
import { searchWikiPlaces } from '../services/wikiService';

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
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    if (!visible) return null;

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

                {/* Results List */}
                {(results.length > 0 || loading) && (
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
                                        onPress={() => {
                                            // Delay slightly to ensure ripple shows and keyboard dismisses cleanly
                                            // Keyboard.dismiss(); // Let unmount handle it or user dismiss
                                            onSelectLocation(item);
                                            setQuery('');
                                            setResults([]);
                                        }}
                                    >
                                    >
                                        {/* Thumbnail or Fallback Icon */}
                                        {item.image ? (
                                            <Image
                                                source={{ uri: item.image }}
                                                style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#eee' }}
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
});

