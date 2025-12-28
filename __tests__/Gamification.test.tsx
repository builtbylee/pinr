
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChallengeFriendModal } from '../src/components/ChallengeFriendModal';

// --- Mocks ---
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: any) => <View {...props} /> };
});
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
    NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.useSharedValue = jest.fn((v) => ({ value: v }));
    Reanimated.useAnimatedStyle = jest.fn(() => ({}));
    Reanimated.withSpring = jest.fn((v) => v);
    return Reanimated;
});

describe('Gamification: Challenge Flow', () => {

    const mockFriends = [
        { uid: 'f1', username: 'Rival1', avatarUrl: 'http://img.com/1' },
        { uid: 'f2', username: 'Rival2' },
    ];

    it('renders and allows sending a challenge', async () => {
        const onSendMock = jest.fn().mockResolvedValue(true);
        const onCloseMock = jest.fn();

        const { getByText, getAllByText } = render(
            <ChallengeFriendModal
                visible={true}
                onClose={onCloseMock}
                friends={mockFriends}
                difficulty="medium"
                onSendChallenge={onSendMock}
            />
        );

        // 1. Verify Friends Listed
        expect(getByText('Rival1')).toBeTruthy();
        expect(getByText('Rival2')).toBeTruthy();

        // 2. Select Game Type (Default is Flag Dash, let's switch to Pin Drop)
        // Find by text "Pin Drop"
        const pinDropOption = getByText('Pin Drop');
        fireEvent.press(pinDropOption);

        // 3. Send Invite to Rival1
        // There are multiple "Invite" buttons. Let's get them.
        const inviteButtons = getAllByText('Invite');
        fireEvent.press(inviteButtons[0]); // Invite first friend

        // 4. Verify Call
        await waitFor(() => {
            expect(onSendMock).toHaveBeenCalledWith(
                mockFriends[0],
                'pindrop', // Selected game
                'medium'   // Default difficulty
            );
        });

        // 5. Verify UI Update (Button changes to "Sent")
        expect(getByText('Sent')).toBeTruthy();
    });

    it('filters friends by search', () => {
        const { getByText, queryByText, getByPlaceholderText } = render(
            <ChallengeFriendModal
                visible={true}
                onClose={jest.fn()}
                friends={mockFriends}
                difficulty="medium"
                onSendChallenge={jest.fn()}
            />
        );

        const input = getByPlaceholderText('Search friends...');
        fireEvent.changeText(input, 'Rival2');

        expect(getByText('Rival2')).toBeTruthy();
        expect(queryByText('Rival1')).toBeNull();
    });

});
