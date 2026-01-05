import auth from '@react-native-firebase/auth';
import { GameChallenge, ChallengeStatus } from './ChallengeService';

const PROJECT_ID = 'days-c4ad4';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

export const RestService = {
    /**
     * Fetch active games using raw REST API to bypass gRPC hang
     */
    async fetchActiveGames(uid: string): Promise<{ active: GameChallenge[], pending: GameChallenge[] }> {
        try {
            console.log('[RestService] Fetching games via REST for:', uid);
            const token = await auth().currentUser?.getIdToken();
            if (!token) {
                console.warn('[RestService] No auth token available');
                return [];
            }

            // Query: status IN ['accepted'] AND (challengerId == uid OR opponentId == uid)
            // Firestore REST RunQuery is complex, so we'll do two simpler queries and merge
            // 1. Where challengerId == uid AND status == accepted
            // 2. Where opponentId == uid AND status == accepted

            const games1 = await runQuery(token, {
                structuredQuery: {
                    from: [{ collectionId: 'game_challenges' }],
                    where: {
                        compositeFilter: {
                            op: 'AND',
                            filters: [
                                { fieldFilter: { field: { fieldPath: 'challengerId' }, op: 'EQUAL', value: { stringValue: uid } } },
                                { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'accepted' } } }
                            ]
                        }
                    }
                }
            });

            const games2 = await runQuery(token, {
                structuredQuery: {
                    from: [{ collectionId: 'game_challenges' }],
                    where: {
                        compositeFilter: {
                            op: 'AND',
                            filters: [
                                { fieldFilter: { field: { fieldPath: 'opponentId' }, op: 'EQUAL', value: { stringValue: uid } } },
                                { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'accepted' } } }
                            ]
                        }
                    }
                }
            });

            // 3. Pending Challenges (For badges)
            const pending = await runQuery(token, {
                structuredQuery: {
                    from: [{ collectionId: 'game_challenges' }],
                    where: {
                        compositeFilter: {
                            op: 'AND',
                            filters: [
                                { fieldFilter: { field: { fieldPath: 'opponentId' }, op: 'EQUAL', value: { stringValue: uid } } },
                                { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } }
                            ]
                        }
                    }
                }
            });

            const merged = [...games1, ...games2];
            // Deduplicate by ID just in case
            const unique = new Map();
            merged.forEach(g => unique.set(g.id, g));

            const results = Array.from(unique.values());
            console.log(`[RestService] Found ${results.length} active and ${pending.length} pending games via REST`);

            return {
                active: results,
                pending: pending
            };

        } catch (error) {
            console.error('[RestService] REST fetch failed:', error);
            return [];
        }
    }
};

async function runQuery(token: string, queryBody: any): Promise<GameChallenge[]> {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[RestService] Query failed: ${response.status} ${text}`);
        return [];
    }

    const json = await response.json();
    // json is array of { document: { name, fields: {...}, createTime, updateTime } }

    return json.map((item: any) => {
        if (!item.document) return null; // Some responses are just metadata
        const doc = item.document;
        const id = doc.name.split('/').pop();
        const fields = doc.fields || {};

        // Helper to extract value from Firestore REST format
        // { stringValue: "foo" } -> "foo"
        // { integerValue: "123" } -> 123
        const getVal = (key: string, type: 'string' | 'number' = 'string') => {
            if (!fields[key]) return undefined;
            const valObj = fields[key];
            if (valObj.stringValue !== undefined) return valObj.stringValue;
            if (valObj.integerValue !== undefined) return parseInt(valObj.integerValue);
            if (valObj.doubleValue !== undefined) return parseFloat(valObj.doubleValue);
            if (valObj.booleanValue !== undefined) return valObj.booleanValue;
            return undefined;
        };

        return {
            id: id,
            challengerId: getVal('challengerId'),
            challengerUsername: getVal('challengerUsername'),
            challengerAvatarUrl: getVal('challengerAvatarUrl'),
            opponentId: getVal('opponentId'),
            opponentUsername: getVal('opponentUsername'),
            opponentAvatarUrl: getVal('opponentAvatarUrl'),
            difficulty: getVal('difficulty'),
            gameType: getVal('gameType') || 'flagdash',
            status: getVal('status'),
            challengerScore: getVal('challengerScore', 'number'),
            opponentScore: getVal('opponentScore', 'number'),
            winnerId: getVal('winnerId'),
            createdAt: getVal('createdAt', 'number') || Date.now(),
            expiresAt: getVal('expiresAt', 'number') || Date.now(),
            completedAt: getVal('completedAt', 'number'),
            challengerStartedAt: getVal('challengerStartedAt', 'number'),
            opponentStartedAt: getVal('opponentStartedAt', 'number'),
        } as GameChallenge;
    }).filter((g: any) => g !== null);
}
