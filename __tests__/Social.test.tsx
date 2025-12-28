
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileModal } from '../src/components/ProfileModal';
import { getUserProfile } from '../src/services/userService';
import { storyService } from '../src/services/StoryService';
import { useMemoryStore } from '../src/store/useMemoryStore';

// --- Mocks ---

// Mock Services
jest.mock('../src/services/userService', () => ({
    getUserProfile: jest.fn(),
    toggleHiddenFriend: jest.fn(),
    addToBucketList: jest.fn(),
    removeFromBucketList: jest.fn(),
}));

jest.mock('../src/services/StoryService', () => ({
    storyService: {
        subscribeToUserStories: jest.fn(() => jest.fn()), // Returns unsubscribe fn
        deleteStory: jest.fn(),
    }
}));

// Mock Store
jest.mock('../src/store/useMemoryStore', () => ({
    useMemoryStore: jest.fn(),
}));

// Mock Reanimated & Vectors
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.useSharedValue = jest.fn((v) => ({ value: v }));
    Reanimated.useAnimatedStyle = jest.fn(() => ({}));
    Reanimated.withSpring = jest.fn((v) => v);
    return Reanimated;
});
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: any) => <View {...props} /> };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

// Helper to setup store state
const mockStore = (state: any) => {
    (useMemoryStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector ? selector(state) : state;
    });
    (useMemoryStore as unknown as jest.Mock).getState = () => state;
};

describe('Social Features: ProfileModal', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders MY profile correctly (Self View)', async () => {
        // 1. Setup Store for "Me"
        mockStore({
            currentUserId: 'my-uid',
            username: 'MyName',
            avatarUri: 'http://avatar.url/me.png',
            bio: 'My cool bio',
            pinColor: 'blue',
            memories: [
                { id: '1', creatorId: 'my-uid', locationName: 'Tokyo, Japan' }, // 1 Pin
                { id: '2', creatorId: 'my-uid', locationName: 'Kyoto, Japan' }  // 2 Pins
            ],
            hiddenFriendIds: [],
            setPinColor: jest.fn(),
        });

        // 2. Setup Service Mocks
        (getUserProfile as jest.Mock).mockResolvedValue({
            username: 'MyName',
            pinColor: 'blue',
            streak: { current: 5 },
            bucketList: []
        });

        const onClose = jest.fn();

        const { getByText, getByTestId } = render(
            <ProfileModal
                visible={true}
                userId="my-uid"
                onClose={onClose}
            />
        );

        // 3. Verify Static Details
        await waitFor(() => {
            expect(getByText('MyName')).toBeTruthy();
            expect(getByText('My cool bio')).toBeTruthy();
            expect(getByText('Pins')).toBeTruthy();
        });

        // 4. Verify Stats (2 Pins, 1 Country "Japan")
        // Note: The logic in ProfileModal splits locationName by comma. 
        // "Tokyo, Japan" -> "Japan". "Kyoto, Japan" -> "Japan". Unique = 1.
        expect(getByText('2')).toBeTruthy(); // Pin Count
        expect(getByText('1')).toBeTruthy(); // Country Count
        expect(getByText('5')).toBeTruthy(); // Streak (from fetched profile)

        // 5. Verify Close Button
        fireEvent.press(getByTestId('profile-close-button'));
        expect(onClose).toHaveBeenCalled();
    });


    it('renders FRIEND profile correctly (Visitor View)', async () => {
        // 1. Setup Store (I am 'my-uid', looking at 'friend-uid')
        mockStore({
            currentUserId: 'my-uid',
            memories: [
                { id: '10', creatorId: 'friend-uid', locationName: 'London, UK' }
            ],
            hiddenFriendIds: [],
        });

        // 2. Mock Friend Fetch
        (getUserProfile as jest.Mock).mockResolvedValue({
            username: 'FriendUser',
            avatarUrl: 'http://friend.png',
            bio: 'Hello World',
            pinColor: 'red',
            streak: { current: 10 },
            hidePinsFrom: []
        });

        const { getByText, findByText, getAllByText } = render(
            <ProfileModal
                visible={true}
                userId="friend-uid"
                onClose={jest.fn()}
            />
        );

        // 3. Verify Friend Data Loaded
        await findByText('FriendUser');
        expect(getByText('Hello World')).toBeTruthy();

        // 4. Verify Friend Stats (1 Pin, 1 Country)
        // Both are '1', so getAllByText should return at least 2 elements
        expect(getAllByText('1').length).toBeGreaterThanOrEqual(2);
        expect(getByText('10')).toBeTruthy(); // Streak (from fetched profile)
    });

});
