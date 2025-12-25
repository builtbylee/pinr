import firestore from '@react-native-firebase/firestore';
import { getCurrentUser } from './authService';
import { getUserProfile } from './userService';
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
    /**
     * Save a score to the leaderboard
     * Now tracks best score per game type (flagdash vs pindrop)
     */
    async saveScore(score: number, difficulty: Difficulty, gameType: GameType = 'flagdash'): Promise<boolean> {
        try {
            const user = getCurrentUser();
            if (!user) {
                console.error('[LeaderboardService] No user logged in');
                return false;
            }

            // Skip saving 0 scores
            if (score <= 0) {
                console.log('[LeaderboardService] Score is 0, not saving');
                return false;
            }

            const profile = await getUserProfile(user.uid);
            // Use user.uid + gameType as docId (one entry per user per game)
            const docId = `${user.uid}_${gameType}`;

            // Check if this beats their existing BEST score for this game type
            const existingDoc = await firestore()
                .collection(LEADERBOARD_COLLECTION)
                .doc(docId)
                .get();

            if (existingDoc.exists()) {
                const existingScore = existingDoc.data()?.score || 0;
                if (score <= existingScore) {
                    console.log('[LeaderboardService] Score not higher than existing best:', existingScore);
                    return false;
                }
            }

            // Save the new best score
            await firestore()
                .collection(LEADERBOARD_COLLECTION)
                .doc(docId)
                .set({
                    odUid: user.uid,
                    username: profile?.username || 'Traveller',
                    photoURL: profile?.avatarUrl || null,
                    score,
                    difficulty,  // Store which difficulty the best score was achieved on
                    gameType,    // Store which game
                    timestamp: Date.now(),
                });

            console.log('[LeaderboardService] New best score saved:', score, 'on', difficulty, 'for', gameType);
            return true;
        } catch (error) {
            console.error('[LeaderboardService] Failed to save score:', error);
            return false;
        }
    }

    /**
     * Get leaderboard for friends only - shows best score across all difficulties
     * @param limit Maximum number of entries to return (default 50)
     */
    async getFriendsLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
        try {
            const user = getCurrentUser();
            if (!user) return [];

            const profile = await getUserProfile(user.uid);
            const friendIds = profile?.friends || [];

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

