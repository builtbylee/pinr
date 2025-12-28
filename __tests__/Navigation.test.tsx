
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FabMenu } from '../src/components/FabMenu';
import { ExploreSearchBar } from '../src/components/ExploreSearchBar';
import { searchPlaces } from '../src/services/geocodingService';

// --- Mocks ---

// Mock Geocoding Service
jest.mock('../src/services/geocodingService', () => ({
    searchPlaces: jest.fn(),
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.useSharedValue = jest.fn((initialValue) => ({ value: initialValue }));
    Reanimated.useAnimatedStyle = jest.fn(() => ({}));
    Reanimated.withTiming = jest.fn((toValue) => toValue);
    Reanimated.withSpring = jest.fn((toValue) => toValue);
    Reanimated.withSequence = jest.fn((...args) => args[args.length - 1]);
    Reanimated.withRepeat = jest.fn((animation) => animation);
    Reanimated.Easing = {
        in: jest.fn(),
        out: jest.fn(),
        ease: jest.fn(),
    };
    return Reanimated;
});

// Mock Vector Icons
jest.mock('@expo/vector-icons', () => ({
    Feather: 'Feather',
}));

// Mock Expo Image
jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: any) => <View {...props} /> };
});

// Mock SafeArea
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 20, top: 20 }),
}));


describe('Navigation & Menu Flow', () => {

    describe('FabMenu Component', () => {
        it('renders correctly and handles button presses', async () => {
            const onPressExploreMock = jest.fn();
            const onPressProfileMock = jest.fn();
            const onPressFriendsMock = jest.fn();
            const onPressAddPinMock = jest.fn();

            const { getByTestId, getAllByTestId } = render(
                <FabMenu
                    avatarUri={null}
                    onPressExplore={onPressExploreMock}
                    onPressProfile={onPressProfileMock}
                    onPressFriends={onPressFriendsMock}
                    onPressAddPin={onPressAddPinMock}
                />
            );

            // 1. Expand Menu via Toggle to make buttons interactive
            const toggleBtn = getByTestId('fab-menu-toggle');
            fireEvent.press(toggleBtn);

            // 2. Press Search (Now interactive)
            const searchBtn = getByTestId('fab-search-button');
            fireEvent.press(searchBtn);
            expect(onPressExploreMock).toHaveBeenCalled();

            // 3. Press Profile
            // Re-open menu if checking interactivity again or just press
            fireEvent.press(toggleBtn);
            const profileBtn = getByTestId('fab-profile-button');
            fireEvent.press(profileBtn);
            expect(onPressProfileMock).toHaveBeenCalled();
        });
    });

    describe('ExploreSearchBar Component', () => {
        it('searches for places and selects a location', async () => {
            const onSelectLocationMock = jest.fn();
            const onCloseMock = jest.fn();

            // Setup mock response
            const mockPlaces = [
                { id: '1', text: 'Paris', place_name: 'Paris, France', center: [2.35, 48.85], place_type: ['city'] }
            ];
            (searchPlaces as jest.Mock).mockResolvedValue(mockPlaces);

            const { getByTestId, getByPlaceholderText, findByText } = render(
                <ExploreSearchBar
                    visible={true}
                    onClose={onCloseMock}
                    onSelectLocation={onSelectLocationMock}
                />
            );

            // 1. Type in search
            const input = getByTestId('explore-search-input');
            fireEvent.changeText(input, 'Par');

            // 2. Wait for debounce & results
            await act(async () => {
                await new Promise((r) => setTimeout(r, 600));
            });

            expect(searchPlaces).toHaveBeenCalledWith('Par');

            // 3. Verify result appears
            const resultItem = await findByText('Paris, France');
            expect(resultItem).toBeTruthy();

            // 4. Select Result
            fireEvent.press(resultItem);

            // 5. Verify callback
            expect(onSelectLocationMock).toHaveBeenCalledWith(mockPlaces[0]);
        });
    });

});
