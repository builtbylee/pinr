import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, BackHandler, Keyboard, Platform, FlatList } from 'react-native';
import { TextInput as GestureTextInput, ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useMemoryStore } from '../store/useMemoryStore';
import { saveUserBio, saveUserPinColor } from '../services/userService';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    username: string | null;
    avatarUri: string | null;
    bio: string | null;
    pinColor: string;
    onEditUsername: () => void;
    onEditAvatar: () => void;
}

// Available pin colors
const PIN_COLOR_OPTIONS = [
    { id: 'orange', color: '#FF8C00', name: 'Orange' },
    { id: 'green', color: '#22CC66', name: 'Green' },
    { id: 'blue', color: '#0066FF', name: 'Blue' },
    { id: 'cyan', color: '#00DDDD', name: 'Cyan' },
    { id: 'red', color: '#FF3333', name: 'Red' },
    { id: 'black', color: '#1A1A1A', name: 'Black' },
    { id: 'purple', color: '#8B5CF6', name: 'Purple' },
    { id: 'silver', color: '#C0C0C0', name: 'Silver' },
    { id: 'white', color: '#FFFFFF', name: 'White' },
];

const { width, height } = Dimensions.get('window');

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    visible,
    onClose,
    username,
    avatarUri,
    bio: initialBio,
    pinColor: initialPinColor,
    onEditUsername,
    onEditAvatar,
}) => {
    const [bioText, setBioText] = useState(initialBio || '');
    const [selectedColor, setSelectedColor] = useState(initialPinColor);
    const currentUserId = useMemoryStore(state => state.currentUserId);
    const setPinColor = useMemoryStore(state => state.setPinColor);
    const setBio = useMemoryStore(state => state.setBio);
    const bioInputRef = useRef<TextInput>(null);

    // Animation state
    const animation = useSharedValue(0);

    // Animated styles for drop-down effect
    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: withSpring(animation.value, { damping: 20, stiffness: 300 }),
        transform: [
            { translateY: withSpring((1 - animation.value) * -50, { damping: 18, stiffness: 180 }) },
            { scale: withSpring(0.95 + animation.value * 0.05, { damping: 15, stiffness: 200 }) }
        ]
    }));

    useEffect(() => {
        if (visible) {
            animation.value = 1;
            setBioText(initialBio || '');
            setSelectedColor(initialPinColor);
        } else {
            animation.value = 0;
        }
    }, [visible, initialBio, initialPinColor]);

    // Handle device back button
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            handleClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [visible]);

    // Handle Keyboard Dismissal - removed blur behavior that was interfering with cursor positioning
    // The blur was causing issues when tapping within the text to reposition cursor


    const handleClose = () => {
        // Discard changes
        onClose();
    };

    const handleSave = async () => {
        let hasChanges = false;

        // Save bio if changed
        if (currentUserId && bioText !== (initialBio || '')) {
            await saveUserBio(currentUserId, bioText);
            setBio(bioText);
            hasChanges = true;
        }

        // Save pin color if changed
        if (currentUserId && selectedColor !== initialPinColor) {
            await saveUserPinColor(currentUserId, selectedColor);
            setPinColor(selectedColor);
            hasChanges = true;
        }

        onClose();
    };

    const handleColorChange = (colorId: string) => {
        setSelectedColor(colorId);
        // Don't save yet, wait for Save button
    };

    if (!visible) return null;

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.content, animatedContentStyle]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Feather name="x" size={28} color="#1a1a1a" />
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1, overflow: 'hidden' }}>
                    <ScrollView
                        style={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Avatar Section */}
                        <View style={styles.section}>
                            <TouchableOpacity style={styles.avatarRow} onPress={onEditAvatar}>
                                <View style={[
                                    styles.avatarContainer,
                                    {
                                        borderWidth: 3,
                                        // Use white border if no avatar (placeholder), otherwise use selected color
                                        borderColor: avatarUri
                                            ? (PIN_COLOR_OPTIONS.find(c => c.id === selectedColor)?.color || '#FF00FF')
                                            : '#FFFFFF'
                                    }
                                ]}>
                                    {avatarUri ? (
                                        <Image
                                            source={{ uri: avatarUri }}
                                            style={styles.avatarImage}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <Feather name="user" size={60} color="rgba(0, 0, 0, 0.3)" />
                                    )}
                                    <View style={[styles.editBadge, { backgroundColor: '#1a1a1a' }]}>
                                        <Feather name="camera" size={14} color="white" />
                                    </View>
                                </View>
                                <View style={styles.avatarText}>
                                    <Text style={styles.settingLabel}>Profile Picture</Text>
                                    <Text style={styles.settingValue}>Tap to change</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Username Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Username</Text>
                            <TouchableOpacity style={styles.settingRow} onPress={onEditUsername}>
                                <View style={styles.settingInfo}>
                                    {/* Removed @ icon as requested */}
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingLabel}>{username || 'Not set'}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ marginRight: 8, color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>Edit</Text>
                                    <Feather name="chevron-right" size={22} color="rgba(0,0,0,0.3)" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Bio Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Bio</Text>
                            <View style={styles.bioContainer}>
                                <GestureTextInput
                                    ref={bioInputRef as any}
                                    style={styles.bioInput}
                                    placeholder="Tell us about yourself..."
                                    placeholderTextColor="rgba(0,0,0,0.4)"
                                    value={bioText}
                                    onChangeText={setBioText}
                                    maxLength={80}
                                    multiline={true}
                                    numberOfLines={2}
                                    scrollEnabled={false}
                                    blurOnSubmit={true}
                                    textAlignVertical="top"
                                    returnKeyType="done"
                                />
                                <Text style={styles.charCount}>{bioText.length}/80</Text>
                            </View>
                        </View>

                        {/* Pin Colour Section */}
                        <View style={[styles.section, { paddingBottom: 20 }]}>
                            <Text style={styles.sectionTitle}>Pin Colour</Text>
                            <Text style={styles.sectionSubtitle}>Choose the colour of your pins</Text>
                            <View style={{ height: 70, marginTop: 12 }}>
                                <GestureScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.colorOptionsScroll}
                                >
                                    {PIN_COLOR_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.colorOption,
                                                { backgroundColor: option.color },
                                                { borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1 },
                                                selectedColor === option.id && styles.colorOptionSelected,
                                                option.id === 'white' && styles.colorOptionWhite,
                                                option.id === 'silver' && styles.colorOptionSilver,
                                            ]}
                                            onPress={() => handleColorChange(option.id)}
                                        >
                                            {selectedColor === option.id && (
                                                <Feather
                                                    name="check"
                                                    size={18}
                                                    color={option.id === 'white' || option.id === 'silver' ? '#1a1a1a' : 'white'}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </GestureScrollView>
                            </View>
                        </View>

                    </ScrollView>

                    {/* Footer Buttons - Fixed at bottom */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
                            <Text style={styles.backButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: '#1a1a1a' }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </Animated.View >
        </View >
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
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    content: {
        width: '90%',
        maxHeight: '92%',
        minHeight: 720,
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
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
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 20,
        marginTop: 10,
    },
    backButton: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    saveButton: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.4)',
        marginBottom: 12,
        marginTop: -8,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 16,
        padding: 16,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    avatarText: {
        marginLeft: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        padding: 16,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        marginLeft: 0, // Reset margin since removed icon
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
    settingValue: {
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.4)',
        marginTop: 2,
    },
    bioContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        padding: 16,
    },
    bioInput: {
        fontSize: 16,
        color: '#1a1a1a',
        padding: 0,
        minHeight: 40,
    },
    charCount: {
        fontSize: 12,
        color: 'rgba(0, 0, 0, 0.3)',
        textAlign: 'right',
        marginTop: 8,
    },
    colorOptionsScroll: {
        flexDirection: 'row',
        gap: 12,
        paddingRight: 12,
    },
    colorOption: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorOptionWhite: {
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 2,
    },
    colorOptionSilver: {
        borderColor: 'rgba(0,0,0,0.15)',
        borderWidth: 2,
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
});
