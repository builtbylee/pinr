import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { isUsernameTaken, recoverAccount } from '../services/userService';
import { linkEmailPassword } from '../services/authService';

interface UsernameModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (username: string) => void;
    currentUsername?: string | null;
    currentUserId?: string | null;
    isFirstTime?: boolean;
}

const { width, height } = Dimensions.get('window');

export const UsernameModal: React.FC<UsernameModalProps> = ({
    visible,
    onClose,
    onSave,
    currentUsername,
    currentUserId,
    isFirstTime = false
}) => {
    const [username, setUsername] = useState(currentUsername || '');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);

    if (!visible) return null;

    const handleSave = async () => {
        if (username.trim().length < 2) {
            setError('Username must be at least 2 characters');
            return;
        }

        setIsChecking(true);
        setError(null);

        try {
            if (isRecovering) {
                // Recovery Mode
                if (!currentUserId) {
                    setError('Error: No active user session');
                    setIsChecking(false);
                    return;
                }
                const success = await recoverAccount(currentUserId, username.trim());
                if (success) {
                    onSave(username.trim());
                } else {
                    setError('Username not found or cannot be recovered');
                    setIsChecking(false);
                }
            } else {
                // Creation Mode
                const taken = await isUsernameTaken(username.trim(), currentUserId || undefined);

                if (taken) {
                    setError('Username is already taken');
                    setIsChecking(false);
                    return;
                }

                onSave(username.trim());
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            setIsChecking(false);
        }
    };

    const toggleMode = () => {
        setIsRecovering(!isRecovering);
        setError(null);
        setUsername('');
    };

    return (
        <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Close button (hidden on first time unless manual close allowed) */}
                    {!isFirstTime && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={28} color="#1a1a1a" />
                        </TouchableOpacity>
                    )}

                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Feather
                            name={isRecovering ? "key" : "user"}
                            size={80}
                            color="rgba(0, 0, 0, 0.5)"
                        />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        {isRecovering
                            ? 'Recover Account'
                            : (isFirstTime ? 'Welcome!' : 'Edit Username')}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isRecovering
                            ? 'Enter your previous username'
                            : (isFirstTime ? 'Choose your username' : 'Update your display name')}
                    </Text>

                    {/* Input */}
                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholder={isRecovering ? "Enter old username" : "Enter username"}
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={username}
                        onChangeText={(text) => {
                            setUsername(text);
                            setError(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                    />

                    {/* Error or character count */}
                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : (
                        <Text style={styles.charCount}>{username.length}/20</Text>
                    )}

                    {/* Save/Recover button */}
                    <TouchableOpacity
                        style={[styles.saveButton, (username.trim().length < 2 || isChecking) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={username.trim().length < 2 || isChecking}
                    >
                        {isChecking ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.saveButtonText}>
                                {isRecovering ? 'Recover' : (isFirstTime ? 'Get Started' : 'Save')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Mode Switcher (link) */}
                    {isFirstTime && (
                        <TouchableOpacity onPress={toggleMode} style={styles.switchModeButton}>
                            <Text style={styles.switchModeText}>
                                {isRecovering ? "New user? Create account" : "Already have an account? Recover"}
                            </Text>
                        </TouchableOpacity>
                    )}
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
        zIndex: 200,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    content: {
        width: '85%',
        backgroundColor: 'rgba(240, 245, 250, 0.98)',
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
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 12,
        color: 'rgba(0, 0, 0, 0.4)',
        marginTop: 8,
        marginBottom: 24,
    },
    saveButton: {
        width: '100%',
        height: 56,
        backgroundColor: '#FF00FF',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: 'rgba(255, 0, 255, 0.4)',
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
        marginTop: 8,
        marginBottom: 24,
    },
    switchModeButton: {
        marginTop: 20,
        padding: 10,
    },
    switchModeText: {
        color: '#666',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
});
