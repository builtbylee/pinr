
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StoryEditorModal } from '../src/components/StoryEditorModal';
import { storyService } from '../src/services/StoryService';

// --- Mocks ---
jest.mock('../src/services/StoryService', () => ({
    storyService: {
        createStory: jest.fn(),
        updateStory: jest.fn(),
    },
    MAX_PINS_PER_STORY: 5,
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.useSharedValue = jest.fn((v) => ({ value: v }));
    Reanimated.useAnimatedStyle = jest.fn(() => ({}));
    return Reanimated;
});

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather', MaterialIcons: 'MaterialIcons' }));
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: any) => <View {...props} /> };
});
jest.mock('expo-haptics', () => ({
    selectionAsync: jest.fn(),
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light' },
}));


describe('Content: Story Creation Flow', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockPins = [
        { id: 'pin1', creatorId: 'my-uid', locationName: 'Paris', date: new Date().toISOString(), location: [0, 0] },
        { id: 'pin2', creatorId: 'my-uid', locationName: 'London', date: new Date().toISOString(), location: [0, 0] },
    ];

    it('allows selecting pins and creating a new story', async () => {
        (storyService.createStory as jest.Mock).mockResolvedValue({ success: true, id: 'new-story-id' });
        const onCloseMock = jest.fn();

        const { getByText, getByPlaceholderText, getAllByText } = render(
            <StoryEditorModal
                visible={true}
                onClose={onCloseMock}
                currentUserId="my-uid"
                userPins={mockPins}
            />
        );

        // 1. Verify Pin List
        expect(getByText('Paris')).toBeTruthy();
        expect(getByText('London')).toBeTruthy();

        // 2. Select a Pin (Paris)
        // Locate touchable wrapping "Paris" or use a testID if available. 
        // Logic: Find the element with "Paris", then find its parent touchable.
        // Easier: Just firePress on the text, it propagates.
        fireEvent.press(getByText('Paris'));

        // 3. Enter Metadata
        const titleInput = getByPlaceholderText('Story Title (e.g., Summer Trip 2024)');
        fireEvent.changeText(titleInput, 'My Euro Trip');

        // 4. Save
        const saveBtn = getByText('Save');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(storyService.createStory).toHaveBeenCalledWith('my-uid', expect.objectContaining({
                title: 'My Euro Trip',
                pinIds: ['pin1'],
                coverPinId: 'pin1'
            }));
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('enforces validation (title and pin selection)', async () => {
        const { getByText } = render(
            <StoryEditorModal
                visible={true}
                onClose={jest.fn()}
                currentUserId="my-uid"
                userPins={mockPins}
            />
        );

        const saveBtn = getByText('Save');

        // 1. Try Save Empty
        // Alert.alert is not mocked by default in RNTL, but we can catch the implementation logic 
        // or check mocked Alert. But usually logic returns early.
        // We can spy on Alert.alert
        jest.spyOn(require('react-native').Alert, 'alert');

        fireEvent.press(saveBtn);
        expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Missing Title', expect.any(String));
    });

});
