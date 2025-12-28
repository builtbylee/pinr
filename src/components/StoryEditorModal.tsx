import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Memory } from '../store/useMemoryStore';
import { storyService, Story, MAX_PINS_PER_STORY } from '../services/StoryService';
import * as Haptics from 'expo-haptics';

interface StoryEditorModalProps {
    visible: boolean;
    onClose: () => void;
    currentUserId: string;
    existingStory?: Story | null;
    initialPinId?: string; // If coming from CreationModal
    userPins: Memory[]; // All available pins to choose from
}

export const StoryEditorModal: React.FC<StoryEditorModalProps> = ({
    visible,
    onClose,
    currentUserId,
    existingStory,
    initialPinId,
    userPins
}) => {
    const [title, setTitle] = useState('');
    const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'select' | 'reorder'>('select');

    // Reset or Initialize State
    useEffect(() => {
        if (visible) {
            if (existingStory) {
                setTitle(existingStory.title);
                setDescription(existingStory.description || '');
                // Filter out any pins that might have been deleted
                const validPinIds = existingStory.pinIds.filter(id => userPins.some(p => p.id === id));
                setSelectedPinIds(validPinIds);
                setViewMode('reorder'); // Start in reorder if editing
            } else {
                setTitle('');
                setDescription('');
                // If initializing with a specific pin
                if (initialPinId) {
                    setSelectedPinIds([initialPinId]);
                    setViewMode('reorder'); // Assume they want to build around this pin
                } else {
                    setSelectedPinIds([]);
                    setViewMode('select');
                }
            }
        }
    }, [visible, existingStory, initialPinId]);

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Missing Title', 'Please give your story a name.');
            return;
        }
        if (selectedPinIds.length === 0) {
            Alert.alert('Empty Story', 'Please select at least one pin.');
            return;
        }

        setIsSaving(true);
        try {
            if (existingStory) {
                const result = await storyService.updateStory(existingStory.id, {
                    title,
                    description,
                    pinIds: selectedPinIds,
                    coverPinId: selectedPinIds[0] // Default cover to first pin for now
                });
                if (result.success) {
                    onClose();
                    Alert.alert('Success', 'Story updated!');
                } else {
                    Alert.alert('Error', result.error || 'Failed to update story.');
                }
            } else {
                const result = await storyService.createStory(currentUserId, {
                    title,
                    description,
                    pinIds: selectedPinIds,
                    coverPinId: selectedPinIds[0]
                });
                if (result.success) {
                    onClose();
                    Alert.alert('Success', 'Story created!');
                } else {
                    Alert.alert('Error', result.error || 'Failed to create story.');
                }
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    const togglePinSelection = (pinId: string) => {
        if (selectedPinIds.includes(pinId)) {
            setSelectedPinIds(prev => prev.filter(id => id !== pinId));
        } else {
            if (selectedPinIds.length >= MAX_PINS_PER_STORY) {
                Alert.alert('Limit Reached', `You can only add up to ${MAX_PINS_PER_STORY} pins per story.`);
                return;
            }
            setSelectedPinIds(prev => [...prev, pinId]);
            Haptics.selectionAsync();
        }
    };

    const movePin = (fromIndex: number, toIndex: number) => {
        const newOrder = [...selectedPinIds];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        setSelectedPinIds(newOrder);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const renderPinItem = ({ item }: { item: Memory }) => {
        const isSelected = selectedPinIds.includes(item.id);
        const selectionIndex = selectedPinIds.indexOf(item.id); // 0-based index if selected

        return (
            <TouchableOpacity
                style={[styles.pinItem, isSelected && styles.pinItemSelected]}
                onPress={() => togglePinSelection(item.id)}
            >
                <Image
                    source={{ uri: item.imageUris?.[0] || 'https://via.placeholder.com/100' }}
                    style={styles.pinThumb}
                />
                <View style={styles.pinInfo}>
                    <Text style={styles.pinLocation} numberOfLines={1}>
                        {item.locationName || 'Unknown Location'}
                    </Text>
                    <Text style={styles.pinDate}>
                        {new Date(item.date).toLocaleDateString()}
                    </Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkboxIndex}>{selectionIndex + 1}</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const renderReorderItem = ({ item, index }: { item: string, index: number }) => {
        const pin = userPins.find(p => p.id === item);
        if (!pin) return null;

        return (
            <View style={styles.reorderItem}>
                <View style={styles.reorderIndex}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <Image
                    source={{ uri: pin.imageUris?.[0] || 'https://via.placeholder.com/100' }}
                    style={styles.reorderThumb}
                />
                <View style={styles.reorderInfo}>
                    <Text style={styles.reorderTitle} numberOfLines={1}>{pin.locationName}</Text>
                </View>

                <View style={styles.reorderControls}>
                    <TouchableOpacity
                        onPress={() => index > 0 && movePin(index, index - 1)}
                        disabled={index === 0}
                        style={[styles.controlBtn, index === 0 && styles.controlBtnDisabled]}
                    >
                        <Feather name="chevron-up" size={20} color={index === 0 ? "#ccc" : "#000"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => index < selectedPinIds.length - 1 && movePin(index, index + 1)}
                        disabled={index === selectedPinIds.length - 1}
                        style={[styles.controlBtn, index === selectedPinIds.length - 1 && styles.controlBtnDisabled]}
                    >
                        <Feather name="chevron-down" size={20} color={index === selectedPinIds.length - 1 ? "#ccc" : "#000"} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <BlurView intensity={20} style={styles.container}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Feather name="x" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {existingStory ? 'Edit Story' : 'New Story'}
                        </Text>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSaving}
                            style={styles.saveBtn}
                        >
                            {isSaving ? <ActivityIndicator color="#4F46E5" /> : (
                                <Text style={styles.saveText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Metadata Inputs */}
                    <View style={styles.metaSection}>
                        <TextInput
                            style={styles.titleInput}
                            placeholder="Story Title (e.g., Summer Trip 2024)"
                            value={title}
                            onChangeText={setTitle}
                            maxLength={50}
                        />
                        <TextInput
                            style={styles.descInput}
                            placeholder="Optional Description..."
                            value={description}
                            onChangeText={setDescription}
                            maxLength={140}
                        />
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, viewMode === 'select' && styles.activeTab]}
                            onPress={() => setViewMode('select')}
                        >
                            <Text style={[styles.tabText, viewMode === 'select' && styles.activeTabText]}>
                                Select Pins ({selectedPinIds.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, viewMode === 'reorder' && styles.activeTab]}
                            onPress={() => setViewMode('reorder')}
                        >
                            <Text style={[styles.tabText, viewMode === 'reorder' && styles.activeTabText]}>
                                Order
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Main Content Area */}
                    <View style={styles.listContainer}>
                        {viewMode === 'select' ? (
                            <FlatList
                                data={userPins}
                                renderItem={renderPinItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>You haven't dropped any pins yet.</Text>
                                }
                            />
                        ) : (
                            <FlatList
                                data={selectedPinIds}
                                renderItem={renderReorderItem}
                                keyExtractor={item => item}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>Select pins first.</Text>
                                }
                            />
                        )}
                    </View>

                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    content: {
        height: '90%',
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 8,
    },
    saveBtn: {
        padding: 8,
    },
    saveText: {
        color: '#4F46E5',
        fontWeight: 'bold',
        fontSize: 16,
    },
    metaSection: {
        padding: 16,
        backgroundColor: '#f9fafb',
    },
    titleInput: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    descInput: {
        fontSize: 14,
        color: '#666',
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#4F46E5',
    },
    tabText: {
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#4F46E5',
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    listContent: {
        padding: 16,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#999',
    },
    // Selector Styles
    pinItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginBottom: 8,
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    pinItemSelected: {
        borderColor: '#4F46E5',
        backgroundColor: '#eef2ff',
    },
    pinThumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#eee',
    },
    pinInfo: {
        flex: 1,
        marginLeft: 12,
    },
    pinLocation: {
        fontWeight: '600',
        fontSize: 16,
    },
    pinDate: {
        fontSize: 12,
        color: '#888',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    checkboxSelected: {
        borderColor: '#4F46E5',
        backgroundColor: '#4F46E5',
    },
    checkboxIndex: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Reorder Styles
    reorderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginBottom: 8,
        borderRadius: 12,
        padding: 8,
        // shadow for drag effect could go here
    },
    reorderIndex: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indexText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ccc',
    },
    reorderThumb: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#eee',
        marginLeft: 4,
    },
    reorderInfo: {
        flex: 1,
        marginLeft: 12,
    },
    reorderTitle: {
        fontWeight: '600',
    },
    reorderControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlBtn: {
        padding: 8,
    },
    controlBtnDisabled: {
        opacity: 0.3,
    },
});
