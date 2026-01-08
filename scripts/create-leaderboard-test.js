process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60ee2a.json');

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// --- Helper: Get Access Token ---
async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/datastore'
    };
    const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });
    const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
    });
    return (await response.json()).access_token;
}

// --- Helper: Generate UUID ---
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- Main Script ---
async function main() {
    const token = await getAccessToken();
    const leetest2_uid = 'Klr9s2JqPPYEGqpHeotKUS1PUvn1';

    // 1. Define 4 Test Users
    const testUsers = [
        { name: 'DriftKing_Test', color: '#FF5733', score: 450, avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=drift' },
        { name: 'PixelPioneer', color: '#33FF57', score: 320, avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=pixel' },
        { name: 'GlobeTrotter_X', color: '#3357FF', score: 180, avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=globe' },
        { name: 'MapMaster_99', color: '#F333FF', score: 85, avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=map' }
    ];

    console.log('🚀 Creating 4 test users, scores, and friend requests...');

    for (const user of testUsers) {
        const uid = `test_user_${Math.floor(Math.random() * 100000)}`;

        // A. Create User Profile
        console.log(`\nProcessing ${user.name} (${uid})...`);
        await fetchWithTimeout(`https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/users/${uid}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    username: { stringValue: user.name },
                    usernameLower: { stringValue: user.name.toLowerCase() },
                    pinColor: { stringValue: user.color },
                    avatarUrl: { stringValue: user.avatar },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            })
        });

        // B. Add Score to Leaderboard
        await fetchWithTimeout(`https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/game_leaderboard`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    odUid: { stringValue: uid },
                    username: { stringValue: user.name },
                    score: { integerValue: user.score },
                    gameType: { stringValue: 'flagdash' },
                    difficulty: { stringValue: 'medium' },
                    timestamp: { integerValue: Date.now() }
                }
            })
        });

        // C. Send Friend Request to leetest2
        await fetchWithTimeout(`https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/friend_requests`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    fromUid: { stringValue: uid },
                    fromUsername: { stringValue: user.name },
                    toUid: { stringValue: leetest2_uid },
                    status: { stringValue: 'pending' },
                    participants: { arrayValue: { values: [{ stringValue: uid }, { stringValue: leetest2_uid }] } },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            })
        });
        console.log('   ✅ Profile, Score, and Request sent.');
    }

    console.log('\n✅ All Done! Check valid Friend Requests in the app.');
}

main().catch(console.error);
