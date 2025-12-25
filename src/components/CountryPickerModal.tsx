import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COUNTRIES, Country } from '../data/countries';
import { TripListItem } from '../services/userService';

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (items: Omit<TripListItem, 'addedAt'>[]) => void;
}

const { height } = Dimensions.get('window');

type TripStatus = 'wishlist' | 'booked';

export const CountryPickerModal: React.FC<CountryPickerModalProps> = ({ visible, onClose, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // Track selection AND status: countryCode -> status
    const [selectedStates, setSelectedStates] = useState<Record<string, TripStatus>>({});

    // Reset selection when modal opens/closes
    React.useEffect(() => {
        if (visible) {
            setSelectedStates({});
            setSearchQuery('');
        }
    }, [visible]);

    const filteredCountries = useMemo(() => {
        if (!searchQuery) return COUNTRIES;
        const lowerQ = searchQuery.toLowerCase();
        return COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(lowerQ) ||
            c.code.toLowerCase().includes(lowerQ)
        );
    }, [searchQuery]);

    const toggleStatus = (code: string, status: TripStatus) => {
        setSelectedStates(prev => {
            const newState = { ...prev };
            // If clicking same status, remove it (toggle off)
            if (newState[code] === status) {
                delete newState[code];
            } else {
                // Otherwise set/overwrite status
                newState[code] = status;
            }
            return newState;
        });
    };

    const handleDone = () => {
        const results: Omit<TripListItem, 'addedAt'>[] = Object.entries(selectedStates).map(([code, status]) => {
            const country = COUNTRIES.find(c => c.code === code);
            return {
                countryCode: code,
                countryName: country?.name || code,
                status: status
            };
        });
        onSelect(results);
        onClose();
    };

    const renderItem = ({ item }: { item: Country }) => {
        const currentStatus = selectedStates[item.code];

        return (
            <View style={[styles.item, currentStatus && styles.selectedItem]}>
                <Text style={styles.itemFlag}>{item.flag}</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>

                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.statusBtn,
                            currentStatus === 'wishlist' && styles.wishlistActive
                        ]}
                        onPress={() => toggleStatus(item.code, 'wishlist')}
                    >
                        <Text style={[styles.statusBtnText, currentStatus === 'wishlist' && styles.activeBtnText]}>
                            Wishlist
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.statusBtn,
                            currentStatus === 'booked' && styles.bookedActive
                        ]}
                        onPress={() => toggleStatus(item.code, 'booked')}
                    >
                        <Text style={[styles.statusBtnText, currentStatus === 'booked' && styles.activeBtnText]}>
                            Booked
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const selectionCount = Object.keys(selectedStates).length;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalContent}
                >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Select Destinations</Text>
                        <TouchableOpacity onPress={handleDone} disabled={selectionCount === 0}>
                            <Text style={[styles.doneText, selectionCount === 0 && styles.disabledText]}>
                                Done ({selectionCount})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search countries..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={false}
                        />
                    </View>

                    <FlatList
                        data={filteredCountries}
                        renderItem={renderItem}
                        keyExtractor={item => item.code}
                        style={styles.list}
                        keyboardShouldPersistTaps="handled"
                    />
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%', // Responsive to keyboard changes (adjustResize)
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    cancelText: {
        fontSize: 16,
        color: '#666',
    },
    doneText: {
        fontSize: 16,
        color: '#4F46E5', // Primary brand color
        fontWeight: 'bold',
    },
    disabledText: {
        color: '#ccc',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1a1a1a',
        height: '100%',
    },
    list: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Reduced slightly to fit buttons
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingHorizontal: 8,
    },
    selectedItem: {
        backgroundColor: '#f8fbfc', // Light blue bg for selection
    },
    itemFlag: {
        fontSize: 24,
        marginRight: 12,
    },
    itemName: {
        fontSize: 16,
        color: '#1a1a1a',
        flex: 1,
        marginRight: 8,
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    statusBtn: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    wishlistActive: {
        backgroundColor: '#EEF2FF', // Light Indigo
        borderColor: '#6366F1',
    },
    bookedActive: {
        backgroundColor: '#ecfdf5', // Light Green
        borderColor: '#22c55e',
    },
    statusBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
    },
    activeBtnText: {
        color: '#111827',
    }
});
