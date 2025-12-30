import firestore from '@react-native-firebase/firestore';
import { getCurrentUser } from './authService';
import { getUserProfile, getFriends } from './userService';
import { Difficulty } from './GameService';

export type GameType = 'flagdash' | 'pindrop' | 'travelbattle';

export interface LeaderboardEntry {
    odUid: string;
    username: string;
    photoURL?: string;
    pinColor?: string;  // User's avatar ring color
    score: number;
    difficulty: Difficulty;  // The difficulty where best score was achieved
    gameType?: GameType;     // Which game: 'flagdash', 'pindrop', or 'travelbattle'
    timestamp: number;
}

const LEADERBOARD_COLLECTION = 'game_leaderboard';

class LeaderboardService {
    // NOTE: saveScore() has been removed - scores are now submitted via
    // the submitGameScore Cloud Function for server-side validation.
    // See: functions/src/index.ts

    /**
     * Get leaderboard for friends only - shows best score across all difficulties
     * @param gameType Optional filter by game type (flagdash, pindrop, travelbattle)
     * @param limit Maximum number of entries to return (default 50)
     */
    async getFriendsLeaderboard(gameType?: GameType, limit: number = 50): Promise<LeaderboardEntry[]> {
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
                let query = firestore()
                    .collection(LEADERBOARD_COLLECTION)
                    .where('odUid', 'in', chunk);

                // Filter by game type if specified
                if (gameType) {
                    query = query.where('gameType', '==', gameType);
                }

                const snapshot = await query.get();

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
     * Get total leaderboard - combines best scores from all games for each user
     * @param limit Maximum number of entries to return (default 50)
     */
    async getTotalLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
        try {
            const user = getCurrentUser();
            if (!user) return [];

            const friendIds = await getFriends(user.uid);
            const allIds = [user.uid, ...friendIds];

            if (allIds.length === 0) return [];

            const allEntries: LeaderboardEntry[] = [];

            // Split into chunks of 10 (Firestore "in" query limit)
            const chunks: string[][] = [];
            for (let i = 0; i < allIds.length; i += 10) {
                chunks.push(allIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                const snapshot = await firestore()
                    .collection(LEADERBOARD_COLLECTION)
                    .where('odUid', 'in', chunk)
                    .get();

                snapshot.docs.forEach(doc => {
                    allEntries.push(doc.data() as LeaderboardEntry);
                });
            }

            // Group by user and sum their best score from each game type
            const userTotals: Record<string, { entry: LeaderboardEntry; total: number; games: Set<string> }> = {};

            for (const entry of allEntries) {
                const uid = entry.odUid;
                const gameType = entry.gameType || 'flagdash';

                if (!userTotals[uid]) {
                    userTotals[uid] = {
                        entry: { ...entry, score: 0 },
                        total: 0,
                        games: new Set()
                    };
                }

                // Only count best score per game type
                if (!userTotals[uid].games.has(gameType)) {
                    // Find best score for this user in this game type
                    const bestInGame = allEntries
                        .filter(e => e.odUid === uid && (e.gameType || 'flagdash') === gameType)
                        .reduce((max, e) => e.score > max ? e.score : max, 0);

                    userTotals[uid].total += bestInGame;
                    userTotals[uid].games.add(gameType);
                }
            }

            // Convert to array and sort
            const totals = Object.values(userTotals).map(({ entry, total }) => ({
                ...entry,
                score: total,
                gameType: undefined // Total across all games
            }));

            totals.sort((a, b) => b.score - a.score);
            return totals.slice(0, limit);
        } catch (error) {
            console.error('[LeaderboardService] Failed to get total leaderboard:', error);
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
