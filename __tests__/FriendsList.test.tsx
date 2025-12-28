
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FriendsModal } from '../src/components/FriendsModal';
import { getFriendRequests, getFriends, searchUsers, sendFriendRequest, getUserProfile } from '../src/services/userService';
import { useMemoryStore } from '../src/store/useMemoryStore';

// --- Mocks ---
jest.mock('../src/services/userService', () => ({
    getFriendRequests: jest.fn(),
    getFriends: jest.fn(),
    searchUsers: jest.fn(),
    sendFriendRequest: jest.fn(),
    getUserProfile: jest.fn(),
    getUsername: jest.fn(),
    getUserByUsername: jest.fn(),
    toggleHiddenFriend: jest.fn(),
}));

jest.mock('../src/store/useMemoryStore', () => ({
    useMemoryStore: jest.fn(),
}));

jest.mock('expo-camera', () => ({
    CameraView: 'CameraView',
    useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.useSharedValue = jest.fn((v) => ({ value: v }));
    Reanimated.useAnimatedStyle = jest.fn(() => ({}));
    return Reanimated;
});

// Helper
const mockStore = (state: any) => {
    (useMemoryStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector ? selector(state) : state;
    });
};

describe('Social Features: Friends List', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Default Store
        mockStore({
            currentUserId: 'my-uid',
            username: 'MyName',
            hiddenFriendIds: [],
            toggleHiddenFriend: jest.fn(),
        });
    });

    it('renders Friends List and Pending Requests', async () => {
        // 1. Mock Data
        (getFriendRequests as jest.Mock).mockResolvedValue([
            { id: 'req1', fromUid: 'p1', fromUsername: 'PendingUser' }
        ]);
        (getFriends as jest.Mock).mockResolvedValue(['f1']);
        (getUserProfile as jest.Mock).mockImplementation((uid) => {
            if (uid === 'f1') return Promise.resolve({ username: 'Friend1', pinColor: 'green' });
            return Promise.resolve(null);
        });

        const { getByText, findByText } = render(
            <FriendsModal visible={true} onClose={jest.fn()} onSelectUser={jest.fn()} />
        );

        // 2. Verify Pending Request
        await findByText('PendingUser');

        // 3. Verify Friend List
        await findByText('Friend1');
        expect(getByText('Your Friends (1)')).toBeTruthy();
    });

    it('allows searching and adding a new friend', async () => {
        // 1. Mock No Friends
        (getFriendRequests as jest.Mock).mockResolvedValue([]);
        (getFriends as jest.Mock).mockResolvedValue([]);

        // 2. Mock Search
        (searchUsers as jest.Mock).mockResolvedValue([
            { uid: 'new1', username: 'NewUser' }
        ]);
        (sendFriendRequest as jest.Mock).mockResolvedValue({ success: true, message: 'Sent!' });

        const { getByText, getByPlaceholderText, findByText, getAllByText } = render(
            <FriendsModal visible={true} onClose={jest.fn()} onSelectUser={jest.fn()} />
        );

        // 3. Switch to Add Tab
        const addTab = getByText('Add');
        fireEvent.press(addTab);

        // 4. Search
        const input = getByPlaceholderText('Search by username...');
        fireEvent.changeText(input, 'New');

        // Trigger submit (onSubmitEditing or search button)
        // Finding search button might be tricky without testID, but onSubmitEditing is standard
        fireEvent(input, 'submitEditing');

        // 5. Verify Result
        await findByText('NewUser');

        // 6. Add Friend
        // 6. Add Friend (Target the button, not the tab)
        const addButtons = getAllByText('Add');
        const actionButton = addButtons[addButtons.length - 1];
        fireEvent.press(actionButton);

        await waitFor(() => {
            expect(sendFriendRequest).toHaveBeenCalledWith('my-uid', 'MyName', 'new1');
        });
    });

});
