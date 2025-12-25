import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, FlatList, Image, Dimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Memory } from '../store/useMemoryStore';

import { formatMemoryDate } from '../utils/dateFormatter';

const { width, height } = Dimensions.get('window');

interface ClusterListModalProps {
    visible: boolean;
    onClose: () => void;
    leaves: any[]; // GeoJSON points
    onSelectMemory: (memory: Memory) => void;
    authorAvatars: Record<string, string>;
    currentUserId?: string | null;
    currentUserAvatar?: string | null;
}

export const ClusterListModal: React.FC<ClusterListModalProps> = ({
    visible,
    onClose,
    leaves,
    onSelectMemory,
    authorAvatars,
    currentUserId,
    currentUserAvatar
}) => {
    if (!visible) return null;

    const renderItem = ({ item }: { item: any }) => {
        const memory = item.properties.memory as Memory;

        // Resolve Avatar: Check map first, then fallback to current user prop if ID matches
        let avatarUrl = authorAvatars[memory.creatorId];
        if (!avatarUrl && currentUserId && memory.creatorId === currentUserId) {
            avatarUrl = currentUserAvatar || "";
        }

        const dateStr = formatMemoryDate(memory.date);

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                    onClose();
                    onSelectMemory(memory);
                }}
            >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: '#ddd' }]} />
                    )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title} numberOfLines={1}>
                        {memory.title || "Untitled Journey"}
                    </Text>
                    <Text style={styles.subtitle}>{dateStr}</Text>
                </View>

                {/* Thumbnail (if exists) */}
                {memory.imageUris && memory.imageUris.length > 0 && (
                    <Image source={{ uri: memory.imageUris[0] }} style={styles.thumbnail} />
                )}

                {/* Chevron */}
                <Feather name="chevron-right" size={20} color="#1a1a1a" style={{ marginLeft: 12, opacity: 0.3 }} />
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                {/* Modal Content */}
                <View style={styles.modalContainer}>
                    {/* Handle Bar */}
                    <View style={styles.handleBar} />

                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Memories Here</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={20} color="#1a1a1a" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={leaves}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.properties.memory.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)', // Lighter overlay
        justifyContent: 'flex-end',
    },
    modalContainer: {
        width: '100%',
        maxHeight: '60%',
        minHeight: '30%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#FFFFFF', // White background like Settings
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.1)', // Darker handle for white bg
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a', // Dark title
        letterSpacing: 0.5,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        marginBottom: 12,
        borderRadius: 20,
        backgroundColor: '#F5F5F5', // Light grey card background
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#1a1a1a', // Dark border for avatar
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a', // Dark text
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#666', // Grey subtitle
    },
    thumbnail: {
        width: 44,
        height: 44,
        borderRadius: 12,
        marginLeft: 12,
        backgroundColor: '#ddd',
    },
});
