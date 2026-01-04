import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Instrumentation: Track cold start time
const COLD_START_TIME = Date.now();
const log = (msg: string) => {
    const elapsed = Date.now() - COLD_START_TIME;
    console.log(`[Perf +${elapsed}ms] [Store] ${msg}`);
};
log('Store module loaded');

// Available pin colors - add more as you create new pin icons
export const PIN_COLORS = ['magenta', 'orange', 'green', 'blue', 'cyan', 'red', 'black', 'purple', 'silver', 'white'] as const;
export type PinColor = typeof PIN_COLORS[number];

export interface Memory {
    id: string;
    title: string;
    date: string;
    location: [number, number]; // [longitude, latitude]
    locationName: string; // Human-readable location name
    imageUris: string[];
    creatorId: string; // ID of the user who created this memory
    pinColor: PinColor; // Color of the pin icon
    expiresAt: number | null; // Unix timestamp when pin expires, null = permanent
}

interface MemoryStore {
    memories: Memory[];
    exploredPath: number[][]; // Array of [lon, lat] coordinates
    selectedMemoryId: string | null;
    currentUserId: string | null; // Firebase UID (null until authenticated)
    isAuthenticated: boolean;
    username: string | null; // User's display name
    avatarUri: string | null; // User's avatar URL
    bio: string | null; // User's bio/tagline
    pinColor: string; // User's pin ring color (hex)

    // Actions
    setCurrentUserId: (userId: string | null) => void;
    setUsername: (username: string | null) => void;
    setAvatarUri: (uri: string | null) => void;
    setBio: (bio: string | null) => void;
    setPinColor: (color: string) => void;
    setMemories: (memories: Memory[]) => void;
    addMemory: (memory: Memory) => void;
    deleteMemory: (memoryId: string) => void;
    addToExploredPath: (coordinate: [number, number]) => void;
    addPhotoToMemory: (memoryId: string, uri: string) => void;
    removePhotoFromMemory: (memoryId: string, uri: string) => void;
    selectMemory: (id: string | null) => void;
    setExploredPath: (path: number[][]) => void;
    friends: string[];
    setFriends: (friends: string[]) => void;

    // Bucket List
    bucketList: any[]; // Ideally import BucketListItem, but using any[] to avoid circular deps for now (or I will try to import it if I can find it)
    setBucketList: (list: any[]) => void;

    // Game State Persistence
    activeGameId: string | null;
    setActiveGameId: (id: string | null) => void;

    // Hidden Friends (pins hidden but still friends)
    hiddenFriendIds: string[];
    setHiddenFriendIds: (ids: string[]) => void;
    toggleHiddenFriend: (friendUid: string) => void;

    // Stories (Journeys)
    stories: any[]; // User's created journeys
    setStories: (stories: any[]) => void;

    // Local User Cache (for faster map load)
    userCache: Record<string, { username: string; avatarUrl: string | null; pinColor: string; updatedAt: number }>;
    setUserCache: (userId: string, data: { username: string; avatarUrl: string | null; pinColor: string }) => void;
    setMultipleUserCache: (data: Record<string, { username: string; avatarUrl: string | null; pinColor: string }>) => void;

    // Hidden Pins (Specific pins hidden from map)
    hiddenPinIds: string[];
    setHiddenPinIds: (ids: string[]) => void;
    toggleHiddenPin: (pinId: string) => void;

    resetUser: () => void;

    // Toast Notification
    toast: {
        visible: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    };
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    hideToast: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
    persist(
        (set, get) => ({
            // Initial State
            memories: [],
            exploredPath: [],
            selectedMemoryId: null,
            currentUserId: null,
            isAuthenticated: false,
            username: null,
            avatarUri: null,
            bio: null,
            pinColor: 'magenta',
            friends: [],
            bucketList: [],
            stories: [],
            userCache: {},
            activeGameId: null,
            hiddenFriendIds: [],
            hiddenPinIds: [],
            toast: {
                visible: false,
                message: '',
                type: 'info',
            },

            // Actions
            setCurrentUserId: (id) => set({ currentUserId: id, isAuthenticated: !!id }),
            setUsername: (name) => set({ username: name }),
            setAvatarUri: (uri) => set({ avatarUri: uri }),
            setBio: (bio) => set({ bio }),
            setPinColor: (color) => set({ pinColor: color }),
            setUserCache: (userId, data) => set((state) => ({
                userCache: { ...state.userCache, [userId]: { ...data, updatedAt: Date.now() } }
            })),
            setMultipleUserCache: (data) => set((state) => {
                const newCache = { ...state.userCache };
                Object.entries(data).forEach(([id, val]) => {
                    newCache[id] = { ...val, updatedAt: Date.now() };
                });
                return { userCache: newCache };
            }),

            setMemories: (memories) => set({ memories }),
            addMemory: (memory) => set((state) => ({ memories: [...state.memories, memory] })),
            deleteMemory: (id) => set((state) => ({ memories: state.memories.filter((m) => m.id !== id) })),

            addToExploredPath: (coordinate) => set((state) => ({ exploredPath: [...state.exploredPath, coordinate] })),
            setExploredPath: (path) => set({ exploredPath: path }),

            addPhotoToMemory: (id, uri) => set((state) => ({
                memories: state.memories.map((m) =>
                    m.id === id ? { ...m, imageUris: [...m.imageUris, uri] } : m
                )
            })),
            removePhotoFromMemory: (id, uri) => set((state) => ({
                memories: state.memories.map((m) =>
                    m.id === id ? { ...m, imageUris: m.imageUris.filter((u) => u !== uri) } : m
                )
            })),

            selectMemory: (id) => set({ selectedMemoryId: id }),

            setFriends: (friends) => set({ friends }),

            // Bucket List & Stories
            setBucketList: (bucketList) => set({ bucketList }),
            setStories: (stories) => set({ stories }),

            setActiveGameId: (id) => set({ activeGameId: id }),

            setHiddenFriendIds: (ids) => set({ hiddenFriendIds: ids }),
            toggleHiddenFriend: (uid) => set((state) => {
                const isHidden = state.hiddenFriendIds.includes(uid);
                return {
                    hiddenFriendIds: isHidden
                        ? state.hiddenFriendIds.filter(id => id !== uid)
                        : [...state.hiddenFriendIds, uid]
                };
            }),

            setHiddenPinIds: (ids) => set({ hiddenPinIds: ids }),
            toggleHiddenPin: (pinId) => set((state) => {
                const isHidden = state.hiddenPinIds.includes(pinId);
                return {
                    hiddenPinIds: isHidden
                        ? state.hiddenPinIds.filter(id => id !== pinId)
                        : [...state.hiddenPinIds, pinId]
                };
            }),

            resetUser: () => set({
                memories: [],
                exploredPath: [],
                selectedMemoryId: null,
                // currentUserId: null, // Don't reset this here
                username: null,
                avatarUri: null,
                bio: null,
                pinColor: 'magenta',
                friends: [],
                activeGameId: null,
                hiddenFriendIds: [],
                hiddenPinIds: [],
                bucketList: [],
                bucketList: [],
                stories: [],
                userCache: {},
                toast: { visible: false, message: '', type: 'info' }
            }),

            showToast: (message, type = 'info') => set({ toast: { visible: true, message, type } }),
            hideToast: () => set((state) => ({ toast: { ...state.toast, visible: false } })),
        }),
        {
            name: 'memory-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                activeGameId: state.activeGameId,
                currentUserId: state.currentUserId,
                username: state.username,
                avatarUri: state.avatarUri,
                bio: state.bio,
                pinColor: state.pinColor,
                friends: state.friends,
                hiddenFriendIds: state.hiddenFriendIds,
                hiddenPinIds: state.hiddenPinIds,
                bucketList: state.bucketList,
                stories: state.stories,
                userCache: state.userCache,
                // Persist memories (pins) for instant map load
                memories: state.memories
            }),
            onRehydrateStorage: () => {
                log('⏳ AsyncStorage rehydration STARTING...');
                return (state, error) => {
                    if (error) {
                        log(`❌ Rehydration ERROR: ${error}`);
                    } else {
                        log(`✅ Rehydration COMPLETE - memories: ${state?.memories?.length ?? 0}, friends: ${state?.friends?.length ?? 0}`);
                    }
                };
            },
        }
    )
);

