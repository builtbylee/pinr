import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LiquidGlass } from './LiquidGlass';

interface TermsModalProps {
    visible: boolean;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const TermsModal: React.FC<TermsModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <LiquidGlass intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Code of Conduct</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color="#1a1a1a" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <Text style={styles.intro}>
                            Welcome to Pinr. Our mission is to help you explore and share the world. To ensure a safe and welcoming community, you agree to the following terms by using our app:
                        </Text>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="shield" size={20} color="#007AFF" />
                                <Text style={styles.sectionTitle}>Zero Tolerance Policy</Text>
                            </View>
                            <Text style={styles.text}>
                                We have a strict zero-tolerance policy against objectionable content and abusive users. Violations will result in immediate account termination.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="slash" size={20} color="#FF3B30" />
                                <Text style={styles.sectionTitle}>No NSFW Content</Text>
                            </View>
                            <Text style={styles.text}>
                                You may not post content that is pornographic, sexually explicit, or intended to disgust. This includes nudity and graphic violence.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="alert-circle" size={20} color="#FF9500" />
                                <Text style={styles.sectionTitle}>Content Moderation</Text>
                            </View>
                            <Text style={styles.text}>
                                All images are automatically screened before posting. Content that violates our guidelines will be blocked and cannot be uploaded. You will receive a notification explaining why your content was blocked.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="ban" size={20} color="#FF3B30" />
                                <Text style={styles.sectionTitle}>Repeated Violations</Text>
                            </View>
                            <Text style={styles.text}>
                                Attempting to upload violating content on multiple occasions will result in progressive enforcement:
                                {'\n\n'}
                                • <Text style={styles.boldText}>First violation:</Text> Content is blocked with a warning.
                                {'\n\n'}
                                • <Text style={styles.boldText}>Repeated violations (2-3 attempts):</Text> Your account may be temporarily suspended for 7-30 days.
                                {'\n\n'}
                                • <Text style={styles.boldText}>Continued violations:</Text> Your account will be permanently terminated.
                                {'\n\n'}
                                We reserve the right to immediately terminate accounts that repeatedly attempt to post clearly inappropriate content.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="message-circle" size={20} color="#FF9500" />
                                <Text style={styles.sectionTitle}>Respect Others</Text>
                            </View>
                            <Text style={styles.text}>
                                Harassment, bullying, hate speech, and discrimination are not tolerated. Treat fellow explorers with respect.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="user" size={20} color="#34C759" />
                                <Text style={styles.sectionTitle}>User Responsibility</Text>
                            </View>
                            <Text style={styles.text}>
                                You are responsible for the content you post. We do not claim ownership of your content, but you grant us a license to display it on the platform.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Feather name="flag" size={20} color="#5856D6" />
                                <Text style={styles.sectionTitle}>Reporting & Safety</Text>
                            </View>
                            <Text style={styles.text}>
                                If you see content that violates these rules, please use the Report feature (long-press on a pin). You can also block users. We review all reports within 24 hours.
                            </Text>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                By continuing to use Pinr, you acknowledge that you have read and agree to these terms.
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: height * 0.85,
        paddingHorizontal: 20,
        paddingTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    intro: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 24,
        lineHeight: 24,
    },
    section: {
        marginBottom: 24,
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 16,
        borderRadius: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    text: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 22,
        marginLeft: 30, // Indent to align with text start
    },
    boldText: {
        fontWeight: '600',
        color: '#1a1a1a',
    },
    footer: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 20,
    },
    footerText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
