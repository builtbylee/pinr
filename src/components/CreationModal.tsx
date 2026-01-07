import { Feather } from '@expo/vector-icons';
import ImageCropPicker from 'react-native-image-crop-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState, useCallback } from 'react';
import { Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, Pressable } from 'react-native';
import { Memory } from '../store/useMemoryStore';
import { MAPBOX_TOKEN } from '../constants/Config';
import { searchPlaces, GeocodingResult } from '../services/geocodingService';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import dayjs from 'dayjs';

// Setup Calendar Locale
LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    today: "Today"
};
LocaleConfig.defaultLocale = 'en';

const { width, height } = Dimensions.get('window');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 50 + i);

interface CreationModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (memory: Omit<Memory, 'id'> | (Partial<Memory> & { id: string }), createStory?: boolean) => void;
    initialMemory?: Memory | null;
}

export const CreationModal: React.FC<CreationModalProps> = ({ visible, onClose, onSave, initialMemory }) => {
    const [title, setTitle] = useState('');

    // Calendar navigation state
    const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));

    // Date selection state
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    // Modal states
    const [showCalendar, setShowCalendar] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);

    // Temporary picker state (so picker doesn't close on each selection)
    const [tempPickerYear, setTempPickerYear] = useState<number>(new Date().getFullYear());
    const [tempPickerMonth, setTempPickerMonth] = useState<number>(new Date().getMonth());

    // Pin duration state
    const DURATION_OPTIONS = [
        { label: '1 Day', value: 1 * 24 * 60 * 60 * 1000 },
        { label: '1 Week', value: 7 * 24 * 60 * 60 * 1000 },
        { label: '1 Month', value: 30 * 24 * 60 * 60 * 1000 },
        { label: '1 Year', value: 365 * 24 * 60 * 60 * 1000 },
        { label: 'Until I Delete', value: null },
    ];
    const [selectedDuration, setSelectedDuration] = useState<{ label: string, value: number | null }>(DURATION_OPTIONS[4]); // Default: permanent

    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [manualLocation, setManualLocation] = useState<[number, number] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [foundLocationName, setFoundLocationName] = useState('');
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);

    useEffect(() => {
        if (visible) {
            if (initialMemory) {
                // Edit Mode
                setTitle(initialMemory.title);
                setFoundLocationName(initialMemory.locationName);
                if (initialMemory.imageUris.length > 0) {
                    setPhotoUri(initialMemory.imageUris[0]);
                }
                setManualLocation(initialMemory.location);
                setSearchQuery(initialMemory.locationName);

                // Duration
                // If expiresAt is null => Permanent. Else calculate.
                // For MVP just default to permanent or existing state

                // Date Parsing (Naive for now)
                // "November, 2024" or "November, 2024 - December, 2024"
                // Ideally we store raw date or range, but for now reset to today or leave empty
                setCurrentDate(dayjs().format('YYYY-MM-DD'));
            } else {
                // Create Mode - Reset
                setTitle('');
                setCurrentDate(dayjs().format('YYYY-MM-DD'));
                setStartDate(null);
                setEndDate(null);
                setSelectedDuration(DURATION_OPTIONS[4]); // Reset to "Until I Delete"
                setPhotoUri(null);
                setManualLocation(null);
                setSearchQuery('');
                setFoundLocationName('');
            }

            setShowCalendar(false);
            setShowYearPicker(false);
            setShowDurationPicker(false);
            setSuggestions([]);
        }
    }, [visible, initialMemory]);

    const handlePickImage = async () => {
        try {
            const image = await ImageCropPicker.openPicker({
                mediaType: 'photo',
                compressImageMaxWidth: 1080,
                compressImageMaxHeight: 1920,
                compressImageQuality: 0.8,
                cropping: true,
            });

            if (image && image.path) {
                setPhotoUri(image.path);
            }
        } catch (error: any) {
            if (error.code !== 'E_PICKER_CANCELLED') {
                console.error('[CreationModal] Error picking image:', error);
            }
        }
    };

    const fetchSuggestions = async (query: string) => {
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchPlaces(query);
            setSuggestions(results);
        } catch (error) {
            console.error('[Autocomplete] Error fetching suggestions:', error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery && searchQuery !== foundLocationName) {
                fetchSuggestions(searchQuery);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, foundLocationName]);

    const handleSelectLocation = (item: any) => {
        const [lon, lat] = item.center;
        setManualLocation([lon, lat]);

        const parts = item.place_name.split(', ');
        let displayName = item.place_name;

        if (parts.length >= 2) {
            const city = parts[0];
            const country = parts[parts.length - 1];
            displayName = `${city}, ${country}`;
        }

        setFoundLocationName(displayName);
        setSearchQuery(displayName);
        setSuggestions([]);
        setIsSearching(false);
    };

    const handleSave = async (createStory: boolean = false) => {
        if (!manualLocation && !foundLocationName) {
            alert('Please select a pin location');
            return;
        }

        let location: [number, number] = [-74.006, 40.7128];

        if (manualLocation) {
            location = manualLocation;
        } else {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    location = [loc.coords.longitude, loc.coords.latitude];
                }
            } catch (e) { }
        }

        // Store date as ISO string for Firestore, but also prepare display format
        let dateISO = "";
        let endDateISO: string | undefined = undefined;
        if (startDate) {
            dateISO = dayjs(startDate).toISOString();
            if (endDate && endDate !== startDate) {
                endDateISO = dayjs(endDate).toISOString();
            }
        } else {
            dateISO = dayjs().toISOString();
        }

        const cardTitle = title || foundLocationName || 'Memory';

        // Calculate expiration timestamp
        const expiresAt = selectedDuration.value
            ? Date.now() + selectedDuration.value
            : null;

        const memoryData = {
            title: cardTitle,
            date: dateISO, // Store as ISO string for Firestore
            endDate: endDateISO, // Store end date as ISO string if range
            location,
            locationName: foundLocationName || 'Unknown Location',
            imageUris: photoUri ? [photoUri] : [],
            creatorId: '', // Will be filled by store/parent
            pinColor: 'magenta' as const,
            expiresAt,
        };

        if (initialMemory) {
            onSave({ ...memoryData, id: initialMemory.id }, createStory);
        } else {
            onSave(memoryData, createStory);
        }

        onClose();
    };

    // --- Calendar Logic ---
    const onDayPress = useCallback((day: any) => {
        if (!startDate || (startDate && endDate)) {
            // Start fresh selection
            setStartDate(day.dateString);
            setEndDate(null);
        } else {
            // Selecting end date
            if (day.dateString < startDate) {
                setStartDate(day.dateString);
                setEndDate(startDate);
            } else {
                setEndDate(day.dateString);
            }
        }
    }, [startDate, endDate]);

    const getMarkedDates = useCallback(() => {
        const marked: any = {};

        if (startDate && endDate) {
            // Range selection
            let start = dayjs(startDate);
            const end = dayjs(endDate);

            marked[startDate] = { startingDay: true, color: '#000000', textColor: 'white' };
            marked[endDate] = { endingDay: true, color: '#000000', textColor: 'white' };

            let current = start.add(1, 'day');
            while (current.isBefore(end)) {
                marked[current.format('YYYY-MM-DD')] = { color: '#E5E7EB', textColor: '#1a1a1a' };
                current = current.add(1, 'day');
            }
        } else if (startDate) {
            // Single date selection
            marked[startDate] = { 
                selected: true, 
                selectedColor: '#000000', 
                selectedTextColor: 'white',
                color: '#000000',
                textColor: 'white'
            };
        }

        return marked;
    }, [startDate, endDate]);

    // Update temp picker state without closing the modal
    const handleYearSelect = (year: number) => {
        setTempPickerYear(year);
    };

    const handleMonthSelect = (monthIndex: number) => {
        setTempPickerMonth(monthIndex);
    };

    const handlePrevMonth = () => {
        const newDate = dayjs(currentDate).subtract(1, 'month').format('YYYY-MM-DD');
        setCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = dayjs(currentDate).add(1, 'month').format('YYYY-MM-DD');
        setCurrentDate(newDate);
    };

    // Confirm selection and close the picker
    const confirmYearMonthSelection = () => {
        const newDate = dayjs().year(tempPickerYear).month(tempPickerMonth).date(1).format('YYYY-MM-DD');
        setCurrentDate(newDate);
        setShowYearPicker(false);
    };

    // Initialize temp picker state when opening
    const openYearPicker = () => {
        console.log('[CreationModal] Opening Year Picker');
        setTempPickerYear(dayjs(currentDate).year());
        setTempPickerMonth(dayjs(currentDate).month());
        setShowYearPicker(true);
    };

    const getDisplayText = () => {
        if (!startDate) return "Select Date";
        const start = dayjs(startDate).format('MMM D, YYYY');
        if (endDate && endDate !== startDate) {
            const end = dayjs(endDate).format('MMM D, YYYY');
            return `${start} - ${end}`;
        }
        return start;
    };

    if (!visible) return null;

    const containerStyle: any = [
        styles.container,
        isSearching && { justifyContent: 'flex-start', paddingTop: 40 }
    ];

    const currentYear = dayjs(currentDate).year();
    const currentMonthIndex = dayjs(currentDate).month();

    return (
        <View style={containerStyle}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="map-pin" size={24} color="#1a1a1a" style={{ marginRight: 10 }} />
                            <Text style={styles.headerTitle}>{initialMemory ? 'Edit Pin' : 'New Pin'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color="black" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={[styles.form, { paddingBottom: 30 }]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Give your pin a name..."
                                placeholderTextColor="rgba(0,0,0,0.4)"
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>

                        <View style={[styles.inputGroup, { zIndex: 100 }]}>
                            <Text style={styles.label}>Where were you?</Text>
                            <View style={styles.searchContainer}>
                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, marginRight: 10 }]}
                                        placeholder="Start typing..."
                                        placeholderTextColor="rgba(0,0,0,0.4)"
                                        value={searchQuery}
                                        onFocus={() => setIsSearching(true)}
                                        onChangeText={setSearchQuery}
                                    />
                                    {isSearching && <Feather name="loader" size={20} color="black" />}
                                </View>

                                {suggestions.length > 0 && (
                                    <View style={styles.suggestionsList}>
                                        {suggestions.map((item) => (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.suggestionItem}
                                                onPress={() => handleSelectLocation(item)}
                                            >
                                                <Feather name="map-pin" size={16} color="#000000" style={{ marginRight: 8 }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.suggestionText} numberOfLines={1}>{item.text}</Text>
                                                    <Text style={[styles.suggestionText, { fontSize: 12, color: 'gray', marginTop: 2 }]} numberOfLines={1}>{item.place_name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {foundLocationName ? (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={styles.foundLocationText}>
                                            <Feather name="check-circle" size={14} color="#00AA00" /> Selected:
                                        </Text>
                                        <Text style={[styles.foundLocationText, { color: 'black' }]}>{foundLocationName}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>When were you there?</Text>
                            <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.settingRow}>
                                <View style={styles.settingRowContent}>
                                    <Feather name="calendar" size={22} color="#1a1a1a" />
                                    <Text style={styles.settingRowText}>{getDisplayText()}</Text>
                                </View>
                                <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Pin Duration</Text>
                            <TouchableOpacity onPress={() => setShowDurationPicker(true)} style={styles.settingRow}>
                                <View style={styles.settingRowContent}>
                                    <Feather name="clock" size={22} color="#1a1a1a" />
                                    <Text style={styles.settingRowText}>{selectedDuration.label}</Text>
                                </View>
                                <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.inputGroup, { minHeight: 200, width: '100%' }]}>
                            <Text style={styles.label}>Photo</Text>
                            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.9} style={{ width: '100%' }}>
                                {photoUri ? (
                                    <View style={styles.previewContainer}>
                                        <Image
                                            source={{ uri: photoUri }}
                                            style={{ width: '100%', height: 200, backgroundColor: '#eee', borderRadius: 16 }}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.editOverlay}>
                                            <View style={styles.editBadge}>
                                                <Feather name="edit-2" size={16} color="black" />
                                                <Text style={styles.editText}>Change</Text>
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.uploadPlaceholder}>
                                        <Feather name="camera" size={40} color="rgba(0,0,0,0.6)" />
                                        <Text style={styles.uploadText}>Select Photo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
                            {initialMemory ? (
                                // Edit mode: single Update Pin button
                                <TouchableOpacity
                                    style={[styles.saveButton, { flex: 1, backgroundColor: '#000' }]}
                                    onPress={() => handleSave(false)}
                                >
                                    <Text style={styles.saveButtonText}>Update Pin</Text>
                                </TouchableOpacity>
                            ) : (
                                // Create mode: Post Pin and +Story buttons
                                <>
                                    <TouchableOpacity
                                        style={[styles.saveButton, { flex: 1, backgroundColor: '#000' }]}
                                        onPress={() => handleSave(false)}
                                    >
                                        <Text style={styles.saveButtonText}>Post Pin</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.saveButton, { flex: 1, backgroundColor: '#4F46E5' }]}
                                        onPress={() => handleSave(true)}
                                    >
                                        <Text style={styles.saveButtonText}>+ Story</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* Calendar Modal */}
                <Modal
                    visible={showCalendar}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowCalendar(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalBlur, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <Text style={styles.calendarTitle}>Select Dates</Text>
                                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                                    <Feather name="x" size={24} color="#1a1a1a" />
                                </TouchableOpacity>
                            </View>

                            {/* External Custom Header for Navigation */}
                            <View style={styles.externalNavigationHeader}>
                                <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
                                    <Feather name="chevron-left" size={24} color="#1a1a1a" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={openYearPicker}
                                    style={styles.customHeader}
                                >
                                    <Text style={styles.customHeaderText}>
                                        {dayjs(currentDate).format('MMMM YYYY')}
                                    </Text>
                                    <Feather name="chevron-down" size={18} color="#000000" />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
                                    <Feather name="chevron-right" size={24} color="#1a1a1a" />
                                </TouchableOpacity>
                            </View>

                            <Calendar
                                key={currentDate}
                                current={currentDate}
                                onDayPress={onDayPress}
                                markingType={startDate && endDate ? 'period' : 'custom'}
                                markedDates={getMarkedDates()}
                                hideArrows={true}
                                renderHeader={() => null}
                                onMonthChange={(month) => setCurrentDate(month.dateString)}
                                theme={{
                                    arrowColor: '#000000',
                                    todayTextColor: '#000000',
                                    monthTextColor: '#000000',
                                    dayTextColor: '#000000',
                                    textSectionTitleColor: '#000000',
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                }}
                            />

                            <TouchableOpacity style={styles.confirmButton} onPress={() => setShowCalendar(false)}>
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Year/Month Picker Modal */}
                <Modal
                    visible={showYearPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowYearPicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalBlur, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                        <View style={styles.yearPickerContainer}>
                            <View style={styles.calendarHeader}>
                                <Text style={styles.calendarTitle}>Select Month & Year</Text>
                                <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                                    <Feather name="x" size={24} color="#1a1a1a" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.yearPickerContent}>
                                {/* Year Picker */}
                                <View style={styles.yearColumn}>
                                    <Text style={styles.pickerLabel}>Year</Text>
                                    <FlatList
                                        data={YEARS}
                                        keyExtractor={(item) => item.toString()}
                                        showsVerticalScrollIndicator={false}
                                        initialScrollIndex={Math.max(0, YEARS.indexOf(tempPickerYear) - 2)}
                                        getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.pickerItem,
                                                    item === tempPickerYear && styles.pickerItemSelected
                                                ]}
                                                onPress={() => handleYearSelect(item)}
                                            >
                                                <Text style={[
                                                    styles.pickerItemText,
                                                    item === tempPickerYear && styles.pickerItemTextSelected
                                                ]}>
                                                    {item}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>

                                {/* Month Picker */}
                                <View style={styles.monthColumn}>
                                    <Text style={styles.pickerLabel}>Month</Text>
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        {MONTHS.map((month, index) => (
                                            <TouchableOpacity
                                                key={month}
                                                style={[
                                                    styles.pickerItem,
                                                    index === tempPickerMonth && styles.pickerItemSelected
                                                ]}
                                                onPress={() => handleMonthSelect(index)}
                                            >
                                                <Text style={[
                                                    styles.pickerItemText,
                                                    index === tempPickerMonth && styles.pickerItemTextSelected
                                                ]}>
                                                    {month}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Done Button */}
                            <TouchableOpacity style={styles.confirmButton} onPress={confirmYearMonthSelection}>
                                <Text style={styles.confirmButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Duration Picker Modal */}
                <Modal
                    visible={showDurationPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowDurationPicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalBlur, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                        <View style={styles.durationPickerContainer}>
                            <View style={styles.calendarHeader}>
                                <Text style={styles.calendarTitle}>Pin Duration</Text>
                                <TouchableOpacity onPress={() => setShowDurationPicker(false)}>
                                    <Feather name="x" size={24} color="#1a1a1a" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.durationHint}>How long should this pin be visible?</Text>

                            {DURATION_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.label}
                                    style={[
                                        styles.durationOption,
                                        selectedDuration.label === option.label && styles.durationOptionSelected
                                    ]}
                                    onPress={() => {
                                        setSelectedDuration(option);
                                        setShowDurationPicker(false);
                                    }}
                                >
                                    <Feather
                                        name={option.value === null ? "disc" : "clock"}
                                        size={20}
                                        color={selectedDuration.label === option.label ? "white" : "#1a1a1a"}
                                    />
                                    <Text style={[
                                        styles.durationOptionText,
                                        selectedDuration.label === option.label && styles.durationOptionTextSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                    {selectedDuration.label === option.label && (
                                        <Feather name="check" size={20} color="white" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
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
    },
    keyboardView: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '90%',
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 20,
    },
    form: {
        paddingBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
        marginBottom: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#1a1a1a',
        fontSize: 16,
        borderWidth: 0,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        padding: 16,
    },
    settingRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingRowText: {
        fontSize: 16,
        color: '#1a1a1a',
        marginLeft: 12,
    },
    uploadPlaceholder: {
        height: 150,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.15)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    uploadText: {
        color: 'rgba(0,0,0,0.6)',
        marginTop: 8,
    },
    previewContainer: {
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    editOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
    },
    editBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    editText: {
        color: 'black',
        fontSize: 12,
        marginLeft: 6,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#000000',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    searchContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        zIndex: 5000,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    foundLocationText: {
        color: '#00AA00',
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
    },
    suggestionsList: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 12,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    suggestionText: {
        color: 'black',
        fontSize: 14,
    },
    // Calendar Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    calendarContainer: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    calendarTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    externalNavigationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
        zIndex: 9999,
        elevation: 10,
        height: 60, // Force height
    },
    navArrow: {
        padding: 8,
    },
    customHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
        marginRight: 8,
    },
    confirmButton: {
        backgroundColor: '#000000',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    confirmButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    // Year/Month Picker Styles
    yearPickerContainer: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        maxHeight: '70%',
    },
    yearPickerContent: {
        flexDirection: 'row',
        height: 300,
    },
    yearColumn: {
        flex: 1,
        marginRight: 8,
    },
    monthColumn: {
        flex: 1,
        marginLeft: 8,
    },
    pickerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(0,0,0,0.5)',
        textTransform: 'uppercase',
        marginBottom: 8,
        textAlign: 'center',
    },
    pickerItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginVertical: 2,
    },
    pickerItemSelected: {
        backgroundColor: '#000000',
    },
    pickerItemText: {
        fontSize: 16,
        color: '#1a1a1a',
        textAlign: 'center',
    },
    pickerItemTextSelected: {
        color: 'white',
        fontWeight: 'bold',
    },
    // Duration Picker Styles
    durationPickerContainer: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
    },
    durationHint: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
        marginBottom: 16,
        textAlign: 'center',
    },
    durationOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.05)',
        gap: 12,
    },
    durationOptionSelected: {
        backgroundColor: '#000000',
    },
    durationOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    durationOptionTextSelected: {
        color: 'white',
    },
});
