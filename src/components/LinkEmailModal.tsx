import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { linkEmailPassword } from '../services/authService';

interface LinkEmailModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const { width, height } = Dimensions.get('window');

export const LinkEmailModal: React.FC<LinkEmailModalProps> = ({
    visible,
    onClose,
    onSuccess
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible) return null;

    const handleLink = async () => {
        if (!email.includes('@')) {
            setError('Please enter a valid email');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await linkEmailPassword(email, password);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to link account');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Feather name="x" size={28} color="#1a1a1a" />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <Feather name="shield" size={60} color="#1a1a1a" />
                    </View>

                    <Text style={styles.title}>Secure Your Account</Text>
                    <Text style={styles.subtitle}>
                        Link an email to ensure you never lose your travel memories.
                    </Text>

                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholder="Email"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            setError(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholder="Password (min 6 chars)"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            setError(null);
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholder="Confirm Password"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={confirmPassword}
                        onChangeText={(text) => {
                            setConfirmPassword(text);
                            setError(null);
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleLink}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.saveButtonText}>Link Account</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
        zIndex: 250, // Higher than SettingsModal
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    content: {
        width: '85%',
        backgroundColor: 'rgba(240, 245, 250, 1)',
        borderRadius: 30,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0, 150, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        width: '100%',
        height: 56,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 18,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        marginBottom: 12,
    },
    saveButton: {
        width: '100%',
        height: 56,
        backgroundColor: '#007AFF', // Blue for security actions
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    saveButtonDisabled: {
        backgroundColor: 'rgba(0, 122, 255, 0.4)',
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    inputError: {
        borderColor: '#FF4444',
    },
    errorText: {
        alignSelf: 'flex-start',
        fontSize: 12,
        color: '#FF4444',
        marginBottom: 16,
    },
});
