import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ImageCropPicker from 'react-native-image-crop-picker';
import { MAPBOX_TOKEN } from '../constants/Config';
import { searchPlaces, GeocodingResult } from '../services/geocodingService';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import { Calendar, LocaleConfig } from 'react-native-calendars';

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


import { Story } from '../services/StoryService';
import { Memory } from '../store/useMemoryStore';

// Types - exported for StoryService
export interface PinDraft {
    tempId: string;
    localImageUri: string;
    title: string;
    location: { lat: number; lon: number; name: string } | null;
    visitDate: number | null;
    visitEndDate?: number | null;
}

interface StoryCreationFlowProps {
    visible: boolean;
    onClose: () => void;
    onComplete: (storyTitle: string, pinDrafts: PinDraft[]) => Promise<void>; // For 2+ photos
    onCreateSinglePin?: (pinDraft: PinDraft) => Promise<void>; // For 1 photo
    initialStory?: Story;
    initialPins?: Memory[];
}

type Step = 'photos' | 'details' | 'reorder';

const MAX_PHOTOS = 10;

export const StoryCreationFlow: React.FC<StoryCreationFlowProps> = ({
    visible,
    onClose,
    onComplete,
    onCreateSinglePin,
    initialStory,
    initialPins
}) => {
    // State
    const [step, setStep] = useState<Step>('photos');
    const [selectedPhotos, setSelectedPhotos] = useState<{ uri: string; tempId: string }[]>([]);
    const [pinDrafts, setPinDrafts] = useState<PinDraft[]>([]);
    const [currentDetailIndex, setCurrentDetailIndex] = useState(0);
    const [storyTitle, setStoryTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Location autocomplete state
    const [locationSearchQuery, setLocationSearchQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<GeocodingResult[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const [isLocationFocused, setIsLocationFocused] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // Calendar state for date range selection
    const [showCalendar, setShowCalendar] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [calendarCurrentDate, setCalendarCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [tempStartDate, setTempStartDate] = useState<string | null>(null);
    const [tempEndDate, setTempEndDate] = useState<string | null>(null);

    // Temp state for Year/Month picker
    const [tempPickerYear, setTempPickerYear] = useState<number>(dayjs().year());
    const [tempPickerMonth, setTempPickerMonth] = useState<number>(dayjs().month());

    // Back Handler - handle back gesture throughout flow
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            if (step === 'reorder' && !initialStory) { // Only allow back to details if not editing an existing story (or handle differently)
                setStep('details');
                return true;
            }
            if (step === 'details') {
                setStep('photos');
                return true;
            }
            // At photos step, close the modal
            handleClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [visible, step, initialStory]);

    // Initialize Edit Mode
    useEffect(() => {
        if (visible && initialStory && initialPins && initialPins.length > 0) {
            console.log('[StoryCreation] Initializing Edit Mode for:', initialStory.title);

            // Map existing pins to PinDrafts
            const drafts: PinDraft[] = initialPins.map(pin => ({
                tempId: pin.id, // Use actual ID as tempId
                localImageUri: pin.imageUris[0] || '', // Use first image
                title: pin.title || '',
                location: {
                    lat: pin.location[1],
                    lon: pin.location[0],
                    name: pin.locationName || 'Unknown'
                },
                visitDate: pin.date ? new Date(pin.date).getTime() : null,
                // visitEndDate is not standard on Memory yet, but could be added if needed
            }));

            // Hydrate state
            setPinDrafts(drafts);
            setSelectedPhotos(drafts.map(d => ({ uri: d.localImageUri, tempId: d.tempId })));
            setStoryTitle(initialStory.title);

            // Jump directly to Reorder (Review) step as requested
            setStep('reorder');
        }
    }, [visible, initialStory, initialPins]);

    // Reset on close
    const handleClose = () => {
        Keyboard.dismiss();
        setStep('photos');
        setSelectedPhotos([]);
        setPinDrafts([]);
        setCurrentDetailIndex(0);
        setStoryTitle('');
        setIsSubmitting(false);
        setLocationSearchQuery('');
        setLocationSuggestions([]);
        setIsLocationFocused(false);
        onClose();
    };

    // Handle back navigation (for Modal onRequestClose)
    const handleBackNavigation = () => {
        Keyboard.dismiss();
        if (step === 'reorder') {
            setStep('details');
            return;
        }
        if (step === 'details') {
            setStep('photos');
            return;
        }
        handleClose();
    };

    // Step 1: Photo Selection
    const handlePickPhotos = async () => {
        try {
            // Calculate how many more photos can be added
            const remainingSlots = MAX_PHOTOS - selectedPhotos.length;
            if (remainingSlots <= 0) {
                Alert.alert('Limit Reached', `You can only select up to ${MAX_PHOTOS} photos.`);
                return;
            }

            const images = await ImageCropPicker.openPicker({
                multiple: true,
                maxFiles: remainingSlots,
                mediaType: 'photo',
                cropping: false,
                compressImageQuality: 0.8,
                compressImageMaxWidth: 1200,
                compressImageMaxHeight: 1200,
            });

            if (images && images.length > 0) {
                const newPhotos = images.slice(0, remainingSlots).map((img, idx) => ({
                    uri: img.path,
                    tempId: `temp_${Date.now()}_${idx}`,
                }));
                // APPEND to existing photos instead of replacing
                setSelectedPhotos(prev => [...prev, ...newPhotos]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error: any) {
            if (error.code !== 'E_PICKER_CANCELLED') {
                console.error('[StoryCreation] Photo picker error:', error);
                Alert.alert('Error', 'Failed to select photos');
            }
        }
    };

    const removePhoto = (tempId: string) => {
        setSelectedPhotos(prev => prev.filter(p => p.tempId !== tempId));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const proceedToDetails = () => {
        if (selectedPhotos.length === 0) {
            Alert.alert('No Photos', 'Please select at least one photo');
            return;
        }

        // Initialize pin drafts from selected photos, preserving existing data
        const drafts: PinDraft[] = selectedPhotos.map(photo => {
            const existing = pinDrafts.find(d => d.tempId === photo.tempId);
            return existing || {
                tempId: photo.tempId,
                localImageUri: photo.uri,
                title: '',
                location: null,
                visitDate: null,
            };
        });
        setPinDrafts(drafts);
        setCurrentDetailIndex(0);
        setStep('details');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // Step 2: Pin Details
    const updatePinDraft = (tempId: string, field: keyof PinDraft, value: any) => {
        setPinDrafts(prev =>
            prev.map(p => (p.tempId === tempId ? { ...p, [field]: value } : p))
        );
    };

    // Location autocomplete
    const fetchLocationSuggestions = async (query: string) => {
        if (query.length < 3) {
            setLocationSuggestions([]);
            return;
        }

        setIsSearchingLocation(true);
        try {
            const results = await searchPlaces(query);
            setLocationSuggestions(results);
        } catch (error) {
            console.error('[StoryCreation] Location search error:', error);
        } finally {
            setIsSearchingLocation(false);
        }
    };

    const handleSelectLocation = (item: any) => {
        const [lon, lat] = item.center;
        const parts = item.place_name.split(', ');
        let displayName = item.place_name;
        if (parts.length >= 2) {
            displayName = `${parts[0]}, ${parts[parts.length - 1]}`;
        }

        const currentDraft = pinDrafts[currentDetailIndex];
        if (currentDraft) {
            updatePinDraft(currentDraft.tempId, 'location', { lat, lon, name: displayName });
        }
        setLocationSearchQuery('');
        setLocationSuggestions([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Debounced location search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (locationSearchQuery) {
                fetchLocationSuggestions(locationSearchQuery);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [locationSearchQuery]);

    const nextPin = () => {
        if (currentDetailIndex < pinDrafts.length - 1) {
            setCurrentDetailIndex(prev => prev + 1);
            setLocationSearchQuery('');
            setLocationSuggestions([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const prevPin = () => {
        if (currentDetailIndex > 0) {
            setCurrentDetailIndex(prev => prev - 1);
            setLocationSearchQuery('');
            setLocationSuggestions([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const proceedToReorder = async () => {
        // Validate titles and locations are filled
        const incomplete = pinDrafts.filter(p => !p.title.trim() || !p.location);
        if (incomplete.length > 0) {
            Alert.alert(
                'Missing Details',
                `${incomplete.length} pin(s) need both a title and location.`
            );
            return;
        }

        // Single photo = create pin directly (skip reorder step)
        if (pinDrafts.length === 1 && onCreateSinglePin) {
            setIsSubmitting(true);
            try {
                await onCreateSinglePin(pinDrafts[0]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                handleClose();
            } catch (error) {
                console.error('[StoryCreation] Single pin error:', error);
                Alert.alert('Error', 'Failed to create pin. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // 2+ photos = go to reorder step
        setStep('reorder');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // --- Calendar Logic ---
    const openCalendarForPin = () => {
        const currentDraft = pinDrafts[currentDetailIndex];
        if (currentDraft?.visitDate) {
            // If there's an existing date, set it as the temp start/end
            const startStr = dayjs(currentDraft.visitDate).format('YYYY-MM-DD');
            setTempStartDate(startStr);
            if (currentDraft.visitEndDate) {
                const endStr = dayjs(currentDraft.visitEndDate).format('YYYY-MM-DD');
                setTempEndDate(endStr);
            } else {
                setTempEndDate(null);
            }
            setCalendarCurrentDate(startStr);
        } else {
            setTempStartDate(null);
            setTempEndDate(null);
            setCalendarCurrentDate(dayjs().format('YYYY-MM-DD'));
        }
        setShowCalendar(true);
    };

    const onDayPress = useCallback((day: any) => {
        if (!tempStartDate || (tempStartDate && tempEndDate)) {
            // Start fresh selection
            setTempStartDate(day.dateString);
            setTempEndDate(null);
        } else {
            // Selecting end date
            if (day.dateString < tempStartDate) {
                setTempStartDate(day.dateString);
                setTempEndDate(tempStartDate);
            } else {
                setTempEndDate(day.dateString);
            }
        }
    }, [tempStartDate, tempEndDate]);

    const getMarkedDates = useCallback(() => {
        const marked: any = {};

        if (tempStartDate && tempEndDate) {
            // Range selection
            let start = dayjs(tempStartDate);
            const end = dayjs(tempEndDate);

            marked[tempStartDate] = { startingDay: true, color: '#000000', textColor: 'white' };
            marked[tempEndDate] = { endingDay: true, color: '#000000', textColor: 'white' };

            let current = start.add(1, 'day');
            while (current.isBefore(end)) {
                marked[current.format('YYYY-MM-DD')] = { color: '#E5E7EB', textColor: '#1a1a1a' };
                current = current.add(1, 'day');
            }
        } else if (tempStartDate) {
            // Single date selection
            marked[tempStartDate] = { selected: true, selectedColor: '#000000', selectedTextColor: 'white' };
        }

        return marked;
    }, [tempStartDate, tempEndDate]);

    const confirmDateSelection = () => {
        const currentDraft = pinDrafts[currentDetailIndex];
        if (currentDraft && tempStartDate) {
            // Store start date as timestamp
            const startTimestamp = dayjs(tempStartDate).valueOf();
            updatePinDraft(currentDraft.tempId, 'visitDate', startTimestamp);

            // Store end date if selected (and different from start)
            if (tempEndDate && tempEndDate !== tempStartDate) {
                const endTimestamp = dayjs(tempEndDate).valueOf();
                updatePinDraft(currentDraft.tempId, 'visitEndDate', endTimestamp);
            } else {
                updatePinDraft(currentDraft.tempId, 'visitEndDate', null);
            }
        }
        setShowCalendar(false);
    };

    // Helper for ordinal suffix
    const getOrdinalSuffix = (day: number): string => {
        if (day >= 11 && day <= 13) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const getDateDisplayText = (visitDate: number | null, visitEndDate?: number | null) => {
        if (!visitDate) return 'Tap to select date';

        const startDay = dayjs(visitDate);
        const startDayNum = startDay.date();
        const startFormatted = `${startDayNum}${getOrdinalSuffix(startDayNum)} ${startDay.format('MMMM YYYY')}`;

        if (visitEndDate && visitEndDate !== visitDate) {
            const endDay = dayjs(visitEndDate);
            const endDayNum = endDay.date();

            // If same month and year, show "1st - 11th December 2025"
            if (startDay.month() === endDay.month() && startDay.year() === endDay.year()) {
                return `${startDayNum}${getOrdinalSuffix(startDayNum)} - ${endDayNum}${getOrdinalSuffix(endDayNum)} ${endDay.format('MMMM YYYY')}`;
            }
            // Different months: "1st December - 5th January 2026"
            return `${startFormatted} - ${endDayNum}${getOrdinalSuffix(endDayNum)} ${endDay.format('MMMM YYYY')}`;
        }

        return startFormatted;
    };

    const openYearPicker = () => {
        setTempPickerYear(dayjs(calendarCurrentDate).year());
        setTempPickerMonth(dayjs(calendarCurrentDate).month());
        setShowYearPicker(true);
    };

    const handleYearSelect = (year: number) => {
        setTempPickerYear(year);
    };

    const handleMonthSelect = (monthIndex: number) => {
        setTempPickerMonth(monthIndex);
    };

    const confirmYearMonthSelection = () => {
        const newDate = dayjs().year(tempPickerYear).month(tempPickerMonth).date(1).format('YYYY-MM-DD');
        setCalendarCurrentDate(newDate);
        setShowYearPicker(false);
    };

    const calendarCurrentYear = dayjs(calendarCurrentDate).year();

    const calendarCurrentMonthIndex = dayjs(calendarCurrentDate).month();

    const handlePrevMonth = () => {
        const newDate = dayjs(calendarCurrentDate).subtract(1, 'month').format('YYYY-MM-DD');
        setCalendarCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = dayjs(calendarCurrentDate).add(1, 'month').format('YYYY-MM-DD');
        setCalendarCurrentDate(newDate);
    };

    // Step 3: Reorder & Submit
    const movePin = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= pinDrafts.length) return;
        const newOrder = [...pinDrafts];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        setPinDrafts(newOrder);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleSubmit = async () => {
        if (!storyTitle.trim()) {
            Alert.alert('Journey Title', 'Please add a title for your journey');
            return;
        }

        setIsSubmitting(true);
        try {
            await onComplete(storyTitle.trim(), pinDrafts);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleClose();
        } catch (error) {
            console.error('[StoryCreation] Submit error:', error);
            Alert.alert('Error', 'Failed to create journey. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render helpers
    const renderPhotoStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Photos</Text>
            <Text style={styles.stepSubtitle}>Choose one photo for a pin, or multiple for a journey (max {MAX_PHOTOS})</Text>

            {selectedPhotos.length === 0 ? (
                <TouchableOpacity style={styles.addPhotosButton} onPress={handlePickPhotos}>
                    <Feather name="image" size={48} color="#000000" />
                    <Text style={styles.addPhotosText}>Tap to select photos</Text>
                </TouchableOpacity>
            ) : (
                <>
                    <GestureHandlerRootView style={styles.photoRowContainer}>
                        <DraggableFlatList
                            data={selectedPhotos}
                            horizontal
                            keyExtractor={(item) => item.tempId}
                            onDragEnd={({ data }) => {
                                setSelectedPhotos(data);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                            renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<{ uri: string; tempId: string }>) => (
                                <ScaleDecorator activeScale={1.1}>
                                    <TouchableOpacity
                                        onLongPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                            drag();
                                        }}
                                        disabled={isActive}
                                        delayLongPress={150}
                                        style={[styles.photoThumb, isActive && styles.photoThumbActive]}
                                    >
                                        <Image source={{ uri: item.uri }} style={styles.thumbImage} contentFit="cover" />
                                        <View style={styles.photoNumber}>
                                            <Text style={styles.photoNumberText}>{(getIndex() ?? 0) + 1}</Text>
                                        </View>
                                        {!isActive && (
                                            <TouchableOpacity
                                                style={styles.removePhotoBtn}
                                                onPress={() => removePhoto(item.tempId)}
                                            >
                                                <Feather name="x" size={14} color="white" />
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
                                </ScaleDecorator>
                            )}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.photoRow}
                            ListFooterComponent={
                                selectedPhotos.length < MAX_PHOTOS ? (
                                    <TouchableOpacity style={styles.addMoreBtn} onPress={handlePickPhotos}>
                                        <Feather name="plus" size={24} color="#000000" />
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    </GestureHandlerRootView>

                    <Text style={styles.photoCount}>
                        {selectedPhotos.length} of {MAX_PHOTOS} photos selected
                    </Text>
                </>
            )}

            <View style={styles.bottomActions}>
                <TouchableOpacity testID="story-cancel-button" style={styles.cancelBtn} onPress={handleClose}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    testID="story-next-button"
                    style={[styles.nextBtn, selectedPhotos.length === 0 && styles.disabledBtn]}
                    onPress={proceedToDetails}
                    disabled={selectedPhotos.length === 0}
                >
                    <Text style={styles.nextBtnText}>Next</Text>
                    <Feather name="arrow-right" size={18} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderDetailsStep = () => {
        const currentDraft = pinDrafts[currentDetailIndex];
        if (!currentDraft) return null;

        return (
            <View style={styles.stepWrapper}>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.stepContainerScroll}
                    contentContainerStyle={styles.stepContainerScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.detailsHeader}>
                        <Text style={styles.stepTitle}>Add Details</Text>
                        <Text style={styles.progressText}>
                            {currentDetailIndex + 1} of {pinDrafts.length}
                        </Text>
                    </View>

                    <View style={styles.detailCard}>
                        <Image
                            source={{ uri: currentDraft.localImageUri }}
                            style={styles.detailCardImage}
                            contentFit="cover"
                        />

                        <View style={styles.detailFields}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Title *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Give this pin a name"
                                    placeholderTextColor="#9CA3AF"
                                    value={currentDraft.title}
                                    onChangeText={text => updatePinDraft(currentDraft.tempId, 'title', text)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Location *</Text>
                                {currentDraft.location ? (
                                    <TouchableOpacity
                                        style={styles.locationSelected}
                                        onPress={() => updatePinDraft(currentDraft.tempId, 'location', null)}
                                    >
                                        <Feather name="check-circle" size={18} color="#10B981" />
                                        <Text style={styles.locationSelectedText} numberOfLines={1}>
                                            {currentDraft.location.name}
                                        </Text>
                                        <Feather name="x" size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.locationSearchRow}>
                                        <Feather name="map-pin" size={18} color="#6B7280" />
                                        <TextInput
                                            style={styles.locationSearchInput}
                                            placeholder="Search for a location..."
                                            placeholderTextColor="#9CA3AF"
                                            value={locationSearchQuery}
                                            onChangeText={setLocationSearchQuery}
                                            onFocus={() => {
                                                setIsLocationFocused(true);
                                                // Scroll to make room for suggestions
                                                setTimeout(() => {
                                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                                }, 300);
                                            }}
                                            onBlur={() => setIsLocationFocused(false)}
                                        />
                                        {isSearchingLocation && (
                                            <ActivityIndicator size="small" color="#000000" />
                                        )}
                                    </View>
                                )}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>When were you there?</Text>
                                <TouchableOpacity
                                    style={styles.datePickerRow}
                                    onPress={openCalendarForPin}
                                >
                                    <Feather name="calendar" size={18} color="#6B7280" />
                                    <Text style={styles.datePickerText}>
                                        {getDateDisplayText(currentDraft.visitDate, currentDraft.visitEndDate)}
                                    </Text>
                                    {currentDraft.visitDate && (
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                updatePinDraft(currentDraft.tempId, 'visitDate', null);
                                                updatePinDraft(currentDraft.tempId, 'visitEndDate', null);
                                            }}
                                            style={styles.clearDateBtn}
                                        >
                                            <Feather name="x" size={16} color="#6B7280" />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Location suggestions - show outside card for better visibility */}
                    {locationSuggestions.length > 0 && !currentDraft.location && (
                        <View style={styles.suggestionsContainer}>
                            {locationSuggestions.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectLocation(item)}
                                >
                                    <Feather name="map-pin" size={14} color="#000000" style={{ marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.suggestionText} numberOfLines={1}>
                                            {item.text}
                                        </Text>
                                        <Text style={[styles.suggestionText, { fontSize: 12, color: 'gray', marginTop: 2 }]} numberOfLines={1}>
                                            {item.place_name}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Navigation dots */}
                    <View style={styles.dotsRow}>
                        {pinDrafts.map((_, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.dot, idx === currentDetailIndex && styles.dotActive]}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setCurrentDetailIndex(idx);
                                    setLocationSearchQuery('');
                                    setLocationSuggestions([]);
                                }}
                            />
                        ))}
                    </View>

                    {/* Navigation arrows - centered */}
                    <View style={styles.navArrowsCenter}>
                        <TouchableOpacity
                            style={[styles.navArrowColored, currentDetailIndex === 0 && styles.navArrowDisabled]}
                            onPress={prevPin}
                            disabled={currentDetailIndex === 0}
                        >
                            <Feather name="chevron-left" size={24} color="white" />
                        </TouchableOpacity>

                        <Text style={styles.navCounter}>
                            {currentDetailIndex + 1} of {pinDrafts.length}
                        </Text>

                        <TouchableOpacity
                            style={[styles.navArrowColored, currentDetailIndex === pinDrafts.length - 1 && styles.navArrowDisabled]}
                            onPress={nextPin}
                            disabled={currentDetailIndex === pinDrafts.length - 1}
                        >
                            <Feather name="chevron-right" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Bottom actions - fixed at bottom */}
                <View style={styles.bottomActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('photos')}>
                        <Text style={styles.cancelBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.nextBtn}
                        onPress={proceedToReorder}
                    >
                        <Text style={styles.nextBtnText}>
                            {pinDrafts.length === 1 ? 'Create Pin' : 'Next'}
                        </Text>
                        <Feather name="arrow-right" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderReorderStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review</Text>
            <Text style={styles.stepSubtitle}>Ready to post your story?</Text>

            <View style={styles.storyTitleInput}>
                <Text style={styles.inputLabel}>Journey Title *</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder="My Amazing Trip"
                    placeholderTextColor="#9CA3AF"
                    value={storyTitle}
                    onChangeText={setStoryTitle}
                />
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reorderRow}
            >
                {pinDrafts.map((draft, index) => (
                    <View key={draft.tempId} style={styles.reorderItem}>
                        <Image source={{ uri: draft.localImageUri }} style={styles.reorderImage} contentFit="cover" />
                        <View style={styles.reorderNumber}>
                            <Text style={styles.reorderNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.reorderTitle} numberOfLines={1}>{draft.title}</Text>
                        <Text style={styles.reorderLocation} numberOfLines={1}>{draft.location?.name}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('details')}>
                    <Feather name="arrow-left" size={18} color="#374151" />
                    <Text style={styles.cancelBtnText}>Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.postBtn, isSubmitting && styles.disabledBtn]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <>
                            <Feather name="check" size={18} color="white" />
                            <Text style={styles.postBtnText}>Post Journey</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleBackNavigation}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {/* Step content - no header */}
                {step === 'photos' && renderPhotoStep()}
                {step === 'details' && renderDetailsStep()}
                {step === 'reorder' && renderReorderStep()}
            </KeyboardAvoidingView>

            {/* Calendar Modal */}
            <Modal
                visible={showCalendar}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.calendarModalOverlay}>
                    <View style={styles.calendarModalBlur} />
                    <View style={styles.calendarContainer}>
                        <View style={styles.calendarHeader}>
                            <Text style={styles.calendarTitle}>Select Dates</Text>
                            <TouchableOpacity onPress={() => setShowCalendar(false)}>
                                <Feather name="x" size={24} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        {/* External Custom Header for Navigation */}
                        <View style={styles.externalNavigationHeader}>
                            <Text style={{ position: 'absolute', top: -20, color: 'red', fontWeight: 'bold' }}>DEBUG MODE ACTIVE (STORY)</Text>
                            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
                                <Feather name="chevron-left" size={24} color="#1a1a1a" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={openYearPicker}
                                style={styles.customHeader}
                            >
                                <Text style={styles.customHeaderText}>
                                    {dayjs(calendarCurrentDate).format('MMMM YYYY')}
                                </Text>
                                <Feather name="chevron-down" size={18} color="#000000" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
                                <Feather name="chevron-right" size={24} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        <Calendar
                            key={calendarCurrentDate}
                            current={calendarCurrentDate}
                            onDayPress={onDayPress}
                            markingType={'period'}
                            markedDates={getMarkedDates()}
                            hideArrows={true}
                            renderHeader={() => null}
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

                        <TouchableOpacity style={styles.calendarConfirmBtn} onPress={confirmDateSelection}>
                            <Text style={styles.calendarConfirmText}>Confirm</Text>
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
                <View style={styles.calendarModalOverlay}>
                    <View style={styles.calendarModalBlur} />
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
                        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                            <TouchableOpacity
                                style={{ backgroundColor: 'black', borderRadius: 25, paddingVertical: 12, alignItems: 'center' }}
                                onPress={confirmYearMonthSelection}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    navArrowsCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        marginVertical: 16,
    },
    navCounter: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 8,
        backgroundColor: 'white',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    headerSpacer: {
        width: 40,
    },
    stepWrapper: {
        flex: 1,
    },
    stepContainer: {
        flex: 1,
        padding: 20,
        paddingBottom: 100,
    },
    stepContainerScroll: {
        flex: 1,
    },
    stepContainerScrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    suggestionsContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
    },
    addPhotosButton: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
        marginBottom: 24,
    },
    addPhotosText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
    },
    photoRowContainer: {
        height: 120,
    },
    photoRow: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        gap: 12,
    },
    photoThumb: {
        width: 100,
        height: 100,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
    },
    photoThumbActive: {
        opacity: 0.9,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 10,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    photoNumber: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoNumberText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
    },
    removePhotoBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addMoreBtn: {
        width: 100,
        height: 100,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    photoCount: {
        textAlign: 'center',
        fontSize: 13,
        color: '#6B7280',
        marginTop: 8,
    },
    bottomActions: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 34,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        paddingHorizontal: 24,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        gap: 6,
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000',
        height: 50,
        paddingHorizontal: 24,
        borderRadius: 25,
        gap: 8,
    },
    nextBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    disabledBtn: {
        opacity: 0.5,
    },
    // Details step
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000000',
    },
    detailCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    detailCardImage: {
        width: '100%',
        height: 140,
    },
    detailFields: {
        padding: 12,
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    locationSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 10,
    },
    locationSearchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        padding: 0,
    },
    locationSelected: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#10B981',
        gap: 10,
    },
    locationSelectedText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    suggestionsList: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 10,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D1D5DB',
    },
    dotActive: {
        backgroundColor: '#000000',
        width: 24,
    },
    navArrowColored: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navArrowDisabled: {
        opacity: 0.3,
    },
    reviewOrderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        gap: 8,
    },
    reviewOrderBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingTop: 16,
        gap: 6,
    },
    backLinkText: {
        fontSize: 14,
        color: '#6B7280',
    },
    // Reorder step
    storyTitleInput: {
        marginBottom: 20,
    },
    reorderRow: {
        paddingVertical: 12,
        gap: 16,
    },
    reorderItem: {
        width: 140,
        alignItems: 'center',
    },
    reorderImage: {
        width: 120,
        height: 120,
        borderRadius: 12,
    },
    reorderNumber: {
        position: 'absolute',
        top: 8,
        left: 14,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reorderNumberText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
    },
    reorderTitle: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    reorderLocation: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 4,
    },
    postBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        height: 50,
        paddingHorizontal: 24,
        borderRadius: 25,
        gap: 8,
    },
    postBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    datePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 10,
    },
    datePickerText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearDateBtn: {
        padding: 4,
    },
    // Calendar Modal Styles
    calendarModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarModalBlur: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
        fontWeight: '700',
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
        backgroundColor: 'red', // Debug: SOLID RED
        zIndex: 9999,
        elevation: 10,
        height: 60,
    },
    navArrow: {
        padding: 8,
    },
    customHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
        marginRight: 8,
    },
    calendarConfirmBtn: {
        backgroundColor: '#000000',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    calendarConfirmText: {
        color: 'white',
        fontWeight: '700',
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
        fontWeight: '700',
    },
});

export default StoryCreationFlow;
