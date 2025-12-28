import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface StreakData {
    currentStreak: number;
    lastPlayedDate: string; // ISO date string (YYYY-MM-DD)
    longestStreak: number;
}

export interface StreakResult {
    streak: number;
    increased: boolean; // true if streak went up (continued or started)
    isNew: boolean; // true if this is day 1 (new streak)
}

class StreakService {
    private streakData: StreakData | null = null;

    /**
     * Get the current streak count
     */
    public async getCurrentStreak(): Promise<number> {
        await this.loadStreakData();
        return this.streakData?.currentStreak || 0;
    }

    /**
     * Get the longest streak ever achieved
     */
    public async getLongestStreak(): Promise<number> {
        await this.loadStreakData();
        return this.streakData?.longestStreak || 0;
    }

    /**
     * Record that a game was played today.
     * Updates streak based on last played date.
     * Returns info about the new streak state.
     */
    public async recordGamePlayed(): Promise<StreakResult> {
        const userId = auth().currentUser?.uid;
        if (!userId) {
            console.log('[StreakService] No user logged in');
            return { streak: 0, increased: false, isNew: false };
        }

        await this.loadStreakData();

        const today = this.getTodayString();
        const yesterday = this.getYesterdayString();

        let increased = false;
        let isNew = false;

        if (!this.streakData) {
            // First time playing
            this.streakData = {
                currentStreak: 1,
                lastPlayedDate: today,
                longestStreak: 1,
            };
            increased = true;
            isNew = true;
        } else if (this.streakData.lastPlayedDate === today) {
            // Already played today, no change
            console.log('[StreakService] Already played today, streak remains:', this.streakData.currentStreak);
            return { streak: this.streakData.currentStreak, increased: false, isNew: false };
        } else if (this.streakData.lastPlayedDate === yesterday) {
            // Played yesterday, increment streak
            this.streakData.currentStreak += 1;
            this.streakData.lastPlayedDate = today;
            if (this.streakData.currentStreak > this.streakData.longestStreak) {
                this.streakData.longestStreak = this.streakData.currentStreak;
            }
            console.log('[StreakService] Streak continued:', this.streakData.currentStreak);
            increased = true;
        } else {
            // Missed a day (or more), reset streak to 1
            console.log('[StreakService] Streak broken, resetting to 1');
            this.streakData.currentStreak = 1;
            this.streakData.lastPlayedDate = today;
            increased = true;
            isNew = true;
        }

        // Save to Firestore
        await this.saveStreakData();

        return { streak: this.streakData.currentStreak, increased, isNew };
    }

    /**
     * Check if streak is still active (played yesterday or today)
     */
    public async isStreakActive(): Promise<boolean> {
        await this.loadStreakData();
        if (!this.streakData) return false;

        const today = this.getTodayString();
        const yesterday = this.getYesterdayString();

        return this.streakData.lastPlayedDate === today || this.streakData.lastPlayedDate === yesterday;
    }

    private async loadStreakData(): Promise<void> {
        const userId = auth().currentUser?.uid;
        if (!userId || this.streakData) return;

        try {
            const docRef = firestore().collection('users').doc(userId).collection('gameData').doc('streak');
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                this.streakData = docSnap.data() as StreakData;
            }
        } catch (e) {
            console.error('[StreakService] Failed to load streak data:', e);
        }
    }

    private async saveStreakData(): Promise<void> {
        const userId = auth().currentUser?.uid;
        if (!userId || !this.streakData) return;

        try {
            const docRef = firestore().collection('users').doc(userId).collection('gameData').doc('streak');
            await docRef.set(this.streakData);
            console.log('[StreakService] Streak data saved');
        } catch (e) {
            console.error('[StreakService] Failed to save streak data:', e);
        }
    }

    private getTodayString(): string {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    private getYesterdayString(): string {
        const now = new Date();
        now.setDate(now.getDate() - 1);
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Reset cached data (useful for logout)
     */
    public clearCache(): void {
        this.streakData = null;
    }
}

export const streakService = new StreakService();
