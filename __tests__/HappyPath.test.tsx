
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthScreen } from '../src/components/AuthScreen';

// Mock the services to avoid native dependencies and network calls
jest.mock('../src/services/authService', () => ({
    signInEmailPassword: jest.fn(() => Promise.resolve({ uid: 'test-uid' })),
    signUpWithEmail: jest.fn(),
    signInWithGoogle: jest.fn(),
    deleteCurrentUser: jest.fn(),
    getCurrentUser: jest.fn(() => ({ uid: 'test-uid' })),
}));

jest.mock('../src/services/userService', () => ({
    getUserProfile: jest.fn(() => Promise.resolve({ username: 'testuser' })),
    saveUserProfile: jest.fn(),
    isUsernameTaken: jest.fn(),
    getEmailByUsername: jest.fn(),
}));

jest.mock('../src/services/biometricService', () => ({
    biometricService: {
        checkAvailability: jest.fn(() => Promise.resolve({ available: false, type: 'FaceID' })),
        getCredentials: jest.fn(() => Promise.resolve(null)),
        authenticate: jest.fn(),
    },
}));

// Mock native modules that might cause render issues in Jest
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: any) => <View {...props} /> };
});

jest.mock('expo-splash-screen', () => ({
    hideAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
    Feather: 'Feather',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-svg', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: (props: any) => <View {...props} />,
        Path: (props: any) => <View {...props} />,
    };
});

describe('Happy Path: Authentication Flow', () => {
    it('allows a user to log in with valid credentials', async () => {
        const onAuthenticatedMock = jest.fn();

        const { getByTestId, getByText } = render(
            <AuthScreen onAuthenticated={onAuthenticatedMock} />
        );

        // 1. Enter Credentials
        const emailInput = getByTestId('auth-email-input');
        const passwordInput = getByTestId('auth-password-input');
        const submitButton = getByTestId('auth-submit-button');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, 'password123');

        // 2. Submit
        fireEvent.press(submitButton);

        // 3. Verify onAuthenticated is called
        // We expect the authService.signInEmailPassword to be called (mocked above)
        // and then userService.getUserProfile to provide the username 'testuser'.
        await waitFor(() => {
            expect(onAuthenticatedMock).toHaveBeenCalledWith('testuser');
        });
    });

    it('displays an error if login fails', async () => {
        // Override the mock to fail once
        const authService = require('../src/services/authService');
        authService.signInEmailPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

        const onAuthenticatedMock = jest.fn();
        const { getByTestId, findByText } = render(
            <AuthScreen onAuthenticated={onAuthenticatedMock} />
        );

        fireEvent.changeText(getByTestId('auth-email-input'), 'wrong@example.com');
        fireEvent.changeText(getByTestId('auth-password-input'), 'wrongpass');
        fireEvent.press(getByTestId('auth-submit-button'));

        // Wait for error message
        const errorMessage = await findByText('Invalid credentials');
        expect(errorMessage).toBeTruthy();
        expect(onAuthenticatedMock).not.toHaveBeenCalled();
    });
});
