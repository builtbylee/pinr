import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { isUsernameTaken } from '../services/userService';
import { linkEmailPassword } from '../services/authService';

interface UsernameModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (username: string) => void | Promise<void>;
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

    if (!visible) return null;

    const handleSave = async () => {
        if (username.trim().length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setIsChecking(true);
        setError(null);

        try {
            // Check if username is taken
            const taken = await isUsernameTaken(username.trim(), currentUserId || undefined);

            if (taken) {
                setError('Username is already taken');
                setIsChecking(false);
                return;
            }

            // Call the save callback (await it in case it's async)
            await onSave(username.trim());

            // Reset loading state after save completes
            setIsChecking(false);

        } catch (err) {
            console.error('[UsernameModal] Save error:', err);
            setError('An error occurred. Please try again.');
            setIsChecking(false);
        }
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
                            name="user"
                            size={80}
                            color="rgba(0, 0, 0, 0.5)"
                        />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        {isFirstTime ? 'Welcome!' : 'Edit Username'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isFirstTime ? 'Choose your username' : 'Update your display name'}
                    </Text>

                    {/* Input */}
                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholder="Enter username"
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
                        style={[styles.saveButton, (username.trim().length < 3 || isChecking) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={username.trim().length < 3 || isChecking}
                    >
                        {isChecking ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.saveButtonText}>
                                {isFirstTime ? 'Get Started' : 'Save'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Mode Switcher (link) */}

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
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    content: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
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
        backgroundColor: '#F8F8F8',
        borderRadius: 14,
        paddingHorizontal: 18,
        fontSize: 17,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 12,
        color: 'rgba(0, 0, 0, 0.4)',
        marginTop: 8,
        marginBottom: 20,
    },
    saveButton: {
        width: '100%',
        height: 52,
        backgroundColor: '#1a1a1a',
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: 'rgba(26, 26, 26, 0.3)',
    },
    saveButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: 'white',
    },
    inputError: {
        borderColor: '#FF3B30',
    },
    errorText: {
        alignSelf: 'flex-start',
        fontSize: 12,
        color: '#FF3B30',
        marginTop: 8,
        marginBottom: 20,
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
