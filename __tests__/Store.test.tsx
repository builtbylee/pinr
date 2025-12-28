
import { renderHook, act } from '@testing-library/react-native';
import { useMemoryStore } from '../src/store/useMemoryStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
}));

describe('Data Services: Store (Zustand)', () => {

    beforeEach(() => {
        // Reset store state
        const { result } = renderHook(() => useMemoryStore());
        act(() => {
            result.current.resetUser();
        });
    });

    it('manages memories (add, delete, select)', () => {
        const { result } = renderHook(() => useMemoryStore());

        const mockMemory = {
            id: 'm1',
            title: 'Mem',
            date: '2025-01-01',
            location: [0, 0] as [number, number],
            locationName: 'Loc',
            imageUris: [],
            creatorId: 'u1',
            pinColor: 'red' as const,
            expiresAt: null
        };

        // 1. Add
        act(() => {
            result.current.addMemory(mockMemory);
        });
        expect(result.current.memories).toHaveLength(1);
        expect(result.current.memories[0].id).toBe('m1');

        // 2. Select
        act(() => {
            result.current.selectMemory('m1');
        });
        expect(result.current.selectedMemoryId).toBe('m1');

        // 3. Delete
        act(() => {
            result.current.deleteMemory('m1');
        });
        expect(result.current.memories).toHaveLength(0);
    });

    it('toggles hidden friends correctly', () => {
        const { result } = renderHook(() => useMemoryStore());

        // Initial State
        expect(result.current.hiddenFriendIds).toHaveLength(0);

        // Hide a friend
        act(() => {
            result.current.toggleHiddenFriend('friend1');
        });
        expect(result.current.hiddenFriendIds).toContain('friend1');

        // Unhide
        act(() => {
            result.current.toggleHiddenFriend('friend1');
        });
        expect(result.current.hiddenFriendIds).not.toContain('friend1');
    });

    it('handles photo addition and removal', () => {
        const { result } = renderHook(() => useMemoryStore());

        const mockMemory = {
            id: 'm1',
            title: 'Mem',
            date: '2025-01-01',
            location: [0, 0] as [number, number],
            locationName: 'Loc',
            imageUris: [],
            creatorId: 'u1',
            pinColor: 'red' as const,
            expiresAt: null
        };

        act(() => result.current.addMemory(mockMemory));

        // Add Photo
        act(() => {
            result.current.addPhotoToMemory('m1', 'img1.jpg');
        });
        expect(result.current.memories[0].imageUris).toContain('img1.jpg');

        // Remove Photo
        act(() => {
            result.current.removePhotoFromMemory('m1', 'img1.jpg');
        });
        expect(result.current.memories[0].imageUris).toHaveLength(0);
    });

});
