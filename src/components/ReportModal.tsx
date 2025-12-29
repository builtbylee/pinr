import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useMemoryStore } from '../store/useMemoryStore';

export type ReportType = 'pin' | 'user';
export type ReportReason = 'inappropriate' | 'spam' | 'harassment' | 'other';

interface ReportModalProps {
    visible: boolean;
    onClose: () => void;
    reportType: ReportType;
    targetId: string; // pinId or userId
    targetName?: string; // pin title or username
}

const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
    { value: 'inappropriate', label: 'Inappropriate Content', icon: 'alert-triangle' },
    { value: 'spam', label: 'Spam', icon: 'mail' },
    { value: 'harassment', label: 'Harassment or Bullying', icon: 'user-x' },
    { value: 'other', label: 'Other', icon: 'more-horizontal' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
    visible,
    onClose,
    reportType,
    targetId,
    targetName,
}) => {
    const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert('Select Reason', 'Please select a reason for your report.');
            return;
        }

        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Error', 'You must be logged in to report content.');
            return;
        }

        setIsSubmitting(true);

        try {
            const reportData: any = {
                reporterId: currentUser.uid,
                reason: selectedReason,
                description: description.trim() || null,
                status: 'pending',
                createdAt: firestore.FieldValue.serverTimestamp(),
            };

            if (reportType === 'pin') {
                reportData.reportedPinId = targetId;
                // Optimistically hide the pin locally
                useMemoryStore.getState().toggleHiddenPin(targetId);
            } else {
                reportData.reportedUserId = targetId;
            }

            await firestore().collection('reports').add(reportData);

            Alert.alert(
                'Report Submitted',
                'Thank you for reporting. We will review this content and take appropriate action.',
                [{ text: 'OK', onPress: onClose }]
            );

            // Reset form
            setSelectedReason(null);
            setDescription('');
        } catch (error) {
            console.error('Error submitting report:', error);
            Alert.alert('Error', 'Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedReason(null);
        setDescription('');
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.container}>
                            <View style={styles.header}>
                                <Text style={styles.title}>
                                    Report {reportType === 'pin' ? 'Pin' : 'User'}
                                </Text>
                                {targetName && (
                                    <Text style={styles.subtitle} numberOfLines={1}>
                                        {targetName}
                                    </Text>
                                )}
                            </View>

                            <ScrollView
                                style={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                            >
                                <Text style={styles.sectionLabel}>Why are you reporting this?</Text>

                                <View style={styles.reasonsContainer}>
                                    {REPORT_REASONS.map((reason) => (
                                        <TouchableOpacity
                                            key={reason.value}
                                            style={[
                                                styles.reasonItem,
                                                selectedReason === reason.value && styles.reasonItemSelected,
                                            ]}
                                            onPress={() => setSelectedReason(reason.value)}
                                        >
                                            <Feather
                                                name={reason.icon as any}
                                                size={20}
                                                color={selectedReason === reason.value ? '#FF3B30' : '#6B7280'}
                                            />
                                            <Text
                                                style={[
                                                    styles.reasonText,
                                                    selectedReason === reason.value && styles.reasonTextSelected,
                                                ]}
                                            >
                                                {reason.label}
                                            </Text>
                                            {selectedReason === reason.value && (
                                                <Feather name="check" size={20} color="#FF3B30" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.sectionLabel}>Additional details (optional)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Provide more context..."
                                    placeholderTextColor="#9CA3AF"
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    maxLength={500}
                                />
                            </ScrollView>

                            <View style={styles.buttons}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleClose}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.submitButton,
                                        !selectedReason && styles.submitButtonDisabled,
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={!selectedReason || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Submit Report</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    scrollContent: {
        flexGrow: 0,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 12,
        marginTop: 8,
    },
    reasonsContainer: {
        marginBottom: 16,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        marginBottom: 8,
        gap: 12,
    },
    reasonItemSelected: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    reasonText: {
        flex: 1,
        fontSize: 15,
        color: '#374151',
    },
    reasonTextSelected: {
        color: '#FF3B30',
        fontWeight: '500',
    },
    textInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#1a1a1a',
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    submitButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: '#FCA5A5',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
});
