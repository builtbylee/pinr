import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { getCurrentUser } from './authService';
import { getUserProfile } from './userService';
import { notificationService } from './NotificationService';
import { Difficulty } from './GameService';
import logger from '../utils/logger';

export type ChallengeStatus = 'pending' | 'accepted' | 'completed' | 'expired';

export interface GameChallenge {
    id: string;
    challengerId: string;
    challengerUsername: string;
    challengerAvatarUrl?: string;
    opponentId: string;
    opponentUsername: string;
    opponentAvatarUrl?: string;
    difficulty: Difficulty;
    gameType?: 'flagdash' | 'pindrop' | 'travelbattle'; // Which game the challenge is for
    status: ChallengeStatus;
    challengerScore?: number;
    opponentScore?: number;
    winnerId?: string;
    createdAt: number;
    expiresAt: number;
    completedAt?: number;
    challengerStartedAt?: number;
    opponentStartedAt?: number;
}

const CHALLENGES_COLLECTION = 'game_challenges';
const CHALLENGE_EXPIRY_HOURS = 24;

class ChallengeService {
    /**
     * Create a new challenge and send invite notification
     */
    async createChallenge(opponentId: string, difficulty: Difficulty, gameType: 'flagdash' | 'pindrop' | 'travelbattle' = 'flagdash'): Promise<GameChallenge | null> {
        try {
            const user = getCurrentUser();
            if (!user) {
                console.error('[ChallengeService] No user logged in');
                return null;
            }

            const [challengerProfile, opponentProfile] = await Promise.all([
                getUserProfile(user.uid),
                getUserProfile(opponentId)
            ]);

            if (!challengerProfile || !opponentProfile) {
                console.error('[ChallengeService] Could not load profiles');
                return null;
            }

            const now = Date.now();
            const challengeData: Omit<GameChallenge, 'id'> = {
                challengerId: user.uid,
                challengerUsername: challengerProfile.username,
                challengerAvatarUrl: challengerProfile.avatarUrl,
                opponentId,
                opponentUsername: opponentProfile.username,
                opponentAvatarUrl: opponentProfile.avatarUrl,
                difficulty,
                gameType,
                status: 'pending',
                createdAt: now,
                expiresAt: now + (CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000),
            };

            // Create in Firestore
            const docRef = await firestore()
                .collection(CHALLENGES_COLLECTION)
                .add(challengeData);

            const challenge: GameChallenge = {
                id: docRef.id,
                ...challengeData
            };

            // Send push notification to opponent
            console.log('[ChallengeService] About to call sendGameInvite for opponent:', opponentId);
            console.log('[ChallengeService] notificationService exists:', !!notificationService);
            console.log('[ChallengeService] sendGameInvite function exists:', typeof notificationService?.sendGameInvite);
            const notifResult = await notificationService.sendGameInvite(opponentId, 'Flag Dash');
            console.log('[ChallengeService] sendGameInvite result:', JSON.stringify(notifResult, null, 2));
            for (const step of notifResult.steps) {
                console.log('[ChallengeService] Step:', step);
            }
            if (!notifResult.success) {
                console.warn('[ChallengeService] Notification failed:', notifResult.error);
            }

            logger.log('[ChallengeService] Challenge created:', challenge.id);
            return challenge;
        } catch (error) {
            console.error('[ChallengeService] Failed to create challenge:', error);
            return null;
        }
    }

    /**
     * Accept a challenge and mark it as active
     */
    async acceptChallenge(challengeId: string): Promise<boolean> {
        try {
            await firestore()
                .collection(CHALLENGES_COLLECTION)
                .doc(challengeId)
                .update({
                    status: 'accepted',
                });
            return true;
        } catch (error) {
            console.error('[ChallengeService] Failed to accept challenge:', error);
            return false;
        }
    }

    /**
     * Submit a score for a challenge
     */
    /**
     * Mark a challenge as "started" by the current user (Anti-Cheat)
     */
    async startChallengeAttempt(challengeId: string): Promise<boolean> {
        try {
            const user = getCurrentUser();
            if (!user) return false;

            const docRef = firestore().collection(CHALLENGES_COLLECTION).doc(challengeId);
            const doc = await docRef.get();
            if (!doc.exists) return false;

            const data = doc.data() as GameChallenge;
            const isChallenger = data.challengerId === user.uid;
            const field = isChallenger ? 'challengerStartedAt' : 'opponentStartedAt';

            // Only set if not already set (preserve original start time)
            if (!data[field]) {
                await docRef.update({
                    [field]: Date.now()
                });
            }
            return true;
        } catch (error) {
            console.error('[ChallengeService] Failed to start challenge attempt:', error);
            return false;
        }
    }

    /**
     * Submit a score for a challenge (now uses Cloud Function for validation)
     */
    async submitScore(
        challengeId: string,
        score: number,
        answers: Array<{ questionCode: string; selectedAnswer: string; isCorrect: boolean }>,
        gameTimeMs: number
    ): Promise<{ completed: boolean; won?: boolean; error?: string }> {
        try {
            const user = getCurrentUser();
            if (!user) return { completed: false, error: 'Not authenticated' };

            // Call Cloud Function for server-side validation
            const result = await functions().httpsCallable('submitChallengeScore')({
                challengeId,
                answers,
                clientScore: score,
                gameTimeMs,
            });

            const data = result.data as any;

            if (!data.success) {
                return { completed: false, error: data.error || 'Score submission failed' };
            }

            // If challenge is completed, send notification to other player
            if (data.completed) {
                const docRef = firestore().collection(CHALLENGES_COLLECTION).doc(challengeId);
                const doc = await docRef.get();
                const challenge = doc.data() as any;

                const isChallenger = challenge.challengerId === user.uid;
                const otherPlayerId = isChallenger ? challenge.opponentId : challenge.challengerId;
                const myName = isChallenger ? challenge.challengerUsername : challenge.opponentUsername;

                await notificationService.notifyChallengeComplete(
                    otherPlayerId,
                    'Flag Dash',
                    {
                        won: !data.won, // Tell them if THEY won
                        opponentName: myName,
                        challengeId: challengeId
                    }
                );
            }

            return {
                completed: data.completed,
                won: data.won,
            };
        } catch (error: any) {
            console.error('[ChallengeService] Failed to submit score:', error);
            // Handle specific Cloud Function errors
            if (error.code === 'functions/failed-precondition') {
                return { completed: false, error: 'Time limit exceeded' };
            }
            return { completed: false, error: error.message || 'Failed to submit score' };
        }
    }

    /**
     * Get a specific challenge by ID
     */
    async getChallenge(challengeId: string): Promise<GameChallenge | null> {
        try {
            const doc = await firestore().collection(CHALLENGES_COLLECTION).doc(challengeId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() } as GameChallenge;
        } catch (error) {
            console.error('[ChallengeService] Failed to get challenge:', error);
            return null;
        }
    }

    /**
     * Get pending challenges for the current user
     */
    async getPendingChallenges(): Promise<GameChallenge[]> {
        try {
            const user = getCurrentUser();
            if (!user) return [];

            const now = Date.now();

            // Get challenges where user is opponent and status is pending
            const snapshot = await firestore()
                .collection(CHALLENGES_COLLECTION)
                .where('opponentId', '==', user.uid)
                .where('status', '==', 'pending')
                // .orderBy('createdAt', 'desc') // Removed
                .limit(10)
                .get();

            return snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as GameChallenge))
                .filter(c => c.expiresAt > now)
                .sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.error('[ChallengeService] Failed to get pending challenges:', error);
            return [];
        }
    }

    /**
     * Subscribe to pending challenges for real-time updates
     */
    subscribeToPendingChallenges(userId: string, onUpdate: (challenges: GameChallenge[]) => void): () => void {
        console.log('[ChallengeService] Subscribing to game challenges for:', userId);
        const unsubscribe = firestore()
            .collection(CHALLENGES_COLLECTION)
            .where('opponentId', '==', userId)
            .where('status', '==', 'pending')
            // .orderBy('createdAt', 'desc') // Removed to avoid composite index requirement
            .onSnapshot(
                (snapshot) => {
                    const now = Date.now();
                    const challenges = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as GameChallenge))
                        .filter(c => c.expiresAt > now)
                        .sort((a, b) => b.createdAt - a.createdAt); // Client-side sort

                    onUpdate(challenges);
                },
                (error) => {
                    console.error('[ChallengeService] Subscription error:', error);
                }
            );
        return unsubscribe;
    }

    /**
     * Get active challenges (accepted but not completed)
     */
    async getActiveChallenges(): Promise<GameChallenge[]> {
        try {
            const user = getCurrentUser();
            if (!user) return [];

            const q1 = await firestore().collection(CHALLENGES_COLLECTION)
                .where('challengerId', '==', user.uid)
                .where('status', 'in', ['accepted', 'completed'])
                .get();

            const q2 = await firestore().collection(CHALLENGES_COLLECTION)
                .where('opponentId', '==', user.uid)
                .where('status', 'in', ['accepted', 'completed'])
                .get();

            const challenges = [...q1.docs, ...q2.docs].map(doc => ({ id: doc.id, ...doc.data() } as GameChallenge));

            // Deduplicate
            const unique = new Map();
            challenges.forEach(c => unique.set(c.id, c));
            return Array.from(unique.values()).sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.error('[ChallengeService] Failed to get active challenges:', error);
            return [];
        }
    }

    /**
     * Subscribe to active games (Real-time)
     */
    subscribeToActiveChallenges(uid: string, onUpdate: (challenges: GameChallenge[]) => void): () => void {
        let c1: GameChallenge[] = [];
        let c2: GameChallenge[] = [];

        const merge = () => {
            const map = new Map();
            [...c1, ...c2].forEach(c => map.set(c.id, c));
            const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            onUpdate(merged);
        };

        const unsub1 = firestore().collection(CHALLENGES_COLLECTION)
            .where('challengerId', '==', uid)
            .where('status', 'in', ['accepted', 'completed'])
            .onSnapshot(snap => {
                c1 = snap.docs.map(d => ({ id: d.id, ...d.data() } as GameChallenge));
                merge();
            }, e => console.log('Sub1 error', e));

        const unsub2 = firestore().collection(CHALLENGES_COLLECTION)
            .where('opponentId', '==', uid)
            .where('status', 'in', ['accepted', 'completed'])
            .onSnapshot(snap => {
                c2 = snap.docs.map(d => ({ id: d.id, ...d.data() } as GameChallenge));
                merge();
            }, e => console.log('Sub2 error', e));

        return () => {
            unsub1();
            unsub2();
        };
    }
}

export const challengeService = new ChallengeService();
