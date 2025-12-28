
import { streakService } from '../src/services/StreakService';
import { updateNotificationSettings } from '../src/services/userService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// --- Mocks ---
jest.mock('@react-native-firebase/auth', () => {
    return jest.fn(() => ({
        currentUser: { uid: 'user123' }
    }));
});

jest.mock('@react-native-firebase/storage', () => {
    return jest.fn(() => ({
        ref: jest.fn(() => ({
            getDownloadURL: jest.fn(),
            putFile: jest.fn(),
        }))
    }));
});

jest.mock('@react-native-firebase/firestore', () => {
    const mockUpdate = jest.fn();
    const mockSet = jest.fn();
    const mockGet = jest.fn();
    const mockDoc = jest.fn(() => ({
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: mockGet,
                set: mockSet
            }))
        }))
    }));
    const mockCollection = jest.fn(() => ({
        doc: mockDoc,
    }));
    const mockFirestore = () => ({
        collection: mockCollection,
    });
    mockFirestore.Timestamp = {
        now: jest.fn(() => ({ seconds: 1234567890 })),
    };
    mockFirestore.FieldValue = {
        arrayUnion: jest.fn(),
        arrayRemove: jest.fn(),
    };
    return mockFirestore;
});

describe('Data Services: Core Logic', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        streakService.clearCache();
    });

    describe('StreakService', () => {
        it('starts a new streak if no previous data', async () => {
            // Mock Firestore return empty
            const mockGet = firestore().collection('x').doc('x').collection('x').doc('x').get as jest.Mock;
            mockGet.mockResolvedValue({ exists: false });

            const streak = await streakService.recordGamePlayed();
            expect(streak).toBe(1);
        });

        it('increments streak if played yesterday', async () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const yesterday = d.toISOString().split('T')[0];

            // Mock Firestore return yesterday data
            const mockGet = firestore().collection('x').doc('x').collection('x').doc('x').get as jest.Mock;
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    currentStreak: 5,
                    lastPlayedDate: yesterday,
                    longestStreak: 5
                })
            });

            const streak = await streakService.recordGamePlayed();
            expect(streak).toBe(6);
        });

        it('resets streak if missed a day', async () => {
            const d = new Date();
            d.setDate(d.getDate() - 2);
            const twoDaysAgo = d.toISOString().split('T')[0];

            // Mock Firestore return old data
            const mockGet = firestore().collection('x').doc('x').collection('x').doc('x').get as jest.Mock;
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    currentStreak: 10,
                    lastPlayedDate: twoDaysAgo,
                    longestStreak: 10
                })
            });

            const streak = await streakService.recordGamePlayed();
            expect(streak).toBe(1);
        });
    });

    describe('UserService: Notification Settings', () => {
        it('updates specific notification preferences', async () => {
            const uid = 'user123';

            // Mock fetching existing profile
            // We need to target the specific mock call for getUserProfile
            // But since firestore() mock is global, we can just ensure the return value aligns
            const mockGet = firestore().collection('x').doc('x').get as jest.Mock;
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    notificationSettings: {
                        globalEnabled: true,
                        mutedFriendIds: [],
                        pinNotifications: true,
                    }
                })
            });

            await updateNotificationSettings(uid, {
                pinNotifications: false,
                gameInvites: true
            });

            const mockUpdate = firestore().collection('x').doc('x').update as jest.Mock;
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                notificationSettings: expect.objectContaining({
                    globalEnabled: true,
                    pinNotifications: false,
                    gameInvites: true,
                })
            }));
        });
    });

});
