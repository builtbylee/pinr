
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PinContextMenuProps {
    visible: boolean;
    onClose: () => void;
    pinId: string;
    pinTitle: string;
    locationName: string;
    isOwner: boolean;
    creatorName: string;
    onViewProfile: () => void;
    onShare?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onHidePin?: () => void;
    onHideUser?: () => void;
}

export const PinContextMenu: React.FC<PinContextMenuProps> = ({
    visible,
    onClose,
    pinTitle,
    locationName,
    isOwner,
    creatorName,
    onViewProfile,
    onShare,
    onEdit,
    onDelete,
    onHidePin,
    onHideUser,
}) => {

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.menuContainer}>
                            {/* Header Removed as per request */}

                            <View style={styles.actions}>
                                {/* Common Actions */}
                                <TouchableOpacity style={styles.actionItem} onPress={onViewProfile}>
                                    <Feather name="user" size={20} color="#1a1a1a" />
                                    <Text style={styles.actionText}>View Profile</Text>
                                </TouchableOpacity>

                                {/* Share option - always visible */}
                                <TouchableOpacity style={styles.actionItem} onPress={onShare}>
                                    <Feather name="share" size={20} color="#34C759" />
                                    <Text style={styles.actionText}>Share</Text>
                                </TouchableOpacity>

                                {isOwner ? (
                                    <>
                                        {/* Owner Actions */}
                                        <TouchableOpacity style={styles.actionItem} onPress={onEdit}>
                                            <Feather name="edit-2" size={20} color="#007AFF" />
                                            <Text style={styles.actionText}>Edit Journey</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionItem, styles.destructiveAction]} onPress={onDelete}>
                                            <Feather name="trash-2" size={20} color="#FF3B30" />
                                            <Text style={[styles.actionText, styles.destructiveText]}>Delete Journey</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        {/* Friend Actions */}
                                        <TouchableOpacity style={styles.actionItem} onPress={onHidePin}>
                                            <Feather name="eye-off" size={20} color="#6B7280" />
                                            <Text style={styles.actionText}>Hide This Pin</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionItem, styles.destructiveAction]} onPress={onHideUser}>
                                            <Feather name="slash" size={20} color="#FF3B30" />
                                            <Text style={[styles.actionText, styles.destructiveText]}>
                                                Hide All
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    menuContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
        marginTop: 4,
    },
    actions: {
        marginBottom: 16,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 16,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
    destructiveAction: {
        borderBottomWidth: 0,
    },
    destructiveText: {
        color: '#FF3B30',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
});
