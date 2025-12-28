import firestore from '@react-native-firebase/firestore';
import { getCurrentUser } from './authService';
import { getUserProfile, getFriends } from './userService';
import { Difficulty } from './GameService';

export type GameType = 'flagdash' | 'pindrop';

export interface LeaderboardEntry {
    odUid: string;
    username: string;
    photoURL?: string;
    score: number;
    difficulty: Difficulty;  // The difficulty where best score was achieved
    gameType?: GameType;     // Which game: 'flagdash' or 'pindrop'
    timestamp: number;
}

const LEADERBOARD_COLLECTION = 'game_leaderboard';

class LeaderboardService {
    // NOTE: saveScore() has been removed - scores are now submitted via
    // the submitGameScore Cloud Function for server-side validation.
    // See: functions/src/index.ts

    /**
     * Get leaderboard for friends only - shows best score across all difficulties
     * @param limit Maximum number of entries to return (default 50)
     */
    async getFriendsLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
        try {
            const user = getCurrentUser();
            if (!user) return [];

            // SECURE: Use getFriends() instead of profile.friends
            const friendIds = await getFriends(user.uid);

            // Include self in the leaderboard
            const allIds = [user.uid, ...friendIds];

            if (allIds.length === 0) return [];

            const entries: LeaderboardEntry[] = [];

            // Split into chunks of 10 (Firestore "in" query limit)
            const chunks: string[][] = [];
            for (let i = 0; i < allIds.length; i += 10) {
                chunks.push(allIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                // Note: Removed .orderBy() to avoid needing a composite index
                // Sorting is done client-side after fetching all results
                const snapshot = await firestore()
                    .collection(LEADERBOARD_COLLECTION)
                    .where('odUid', 'in', chunk)
                    .get();

                snapshot.docs.forEach(doc => {
                    entries.push(doc.data() as LeaderboardEntry);
                });
            }

            // Sort by score descending and limit results
            entries.sort((a, b) => b.score - a.score);
            return entries.slice(0, limit);
        } catch (error) {
            console.error('[LeaderboardService] Failed to get friends leaderboard:', error);
            return [];
        }
    }

    /**
     * Get global top scores (for future use)
     */
    async getGlobalLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
        try {
            const snapshot = await firestore()
                .collection(LEADERBOARD_COLLECTION)
                .orderBy('score', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => doc.data() as LeaderboardEntry);
        } catch (error) {
            console.error('[LeaderboardService] Failed to get global leaderboard:', error);
            return [];
        }
    }
}

export const leaderboardService = new LeaderboardService();

