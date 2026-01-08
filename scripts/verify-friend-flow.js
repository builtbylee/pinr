/**
 * Verify Friend Request Flow (Send -> Accept -> Verify)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

const PROJECT_ID = 'days-c4ad4';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTION = 'friend_requests';

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

// --- AUTH HELPERS ---
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

function toFirestore(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'number') fields[k] = { integerValue: v.toString() };
        else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(str => ({ stringValue: str })) } };
        // Add timestamp support if needed
    }
    return fields;
}

async function main() {
    console.log('\n=== FRIEND FLOW VERIFICATION ===\n');
    const token = await getAccessToken();

    const USER_A = `user_a_${Date.now()}`;
    const USER_B = `user_b_${Date.now()}`;
    console.log(`User A: ${USER_A}`);
    console.log(`User B: ${USER_B}`);

    // 1. Send Friend Request (A -> B)
    console.log('\n--- Step 1: Sending Request ---');
    const requestData = {
        fromUid: USER_A,
        fromUsername: 'User A',
        toUid: USER_B,
        status: 'pending',
        participants: [USER_A, USER_B],
        createdAt: new Date().toISOString() // Simpler for test
    };

    const createResp = await fetchWithTimeout(`${BASE_URL}/${COLLECTION}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestore(requestData) })
    });
    const createJson = await createResp.json();
    if (createJson.error) {
        console.error('❌ Send Failed:', createJson.error); process.exit(1);
    }
    const requestId = createJson.name.split('/').pop();
    console.log(`✅ Request Sent! ID: ${requestId}`);

    // 2. Verify Pending State
    console.log('\n--- Step 2: Verifying Pending State ---');
    const getResp = await fetchWithTimeout(`${BASE_URL}/${COLLECTION}/${requestId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const getJson = await getResp.json();
    const status = getJson.fields.status.stringValue;
    if (status === 'pending') {
        console.log('✅ Request is PENDING as expected.');
    } else {
        console.error(`❌ Unexpected Status: ${status}`); process.exit(1);
    }

    // 3. Accept Request (Update Status)
    console.log('\n--- Step 3: Accepting Request ---');
    const updateResp = await fetchWithTimeout(`${BASE_URL}/${COLLECTION}/${requestId}?updateMask.fieldPaths=status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: {
                status: { stringValue: 'accepted' }
            }
        })
    });
    const updateJson = await updateResp.json();
    if (updateJson.error) {
        console.error('❌ Accept Failed:', updateJson.error); process.exit(1);
    }
    console.log('✅ Request Accepted!');

    // 4. Verify Friendship (Simulate getFriends)
    console.log('\n--- Step 4: Verifying Friendship ---');
    // Query: fromUid == USER_A && status == accepted
    const queryResp = await fetchWithTimeout(`${BASE_URL}:runQuery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: COLLECTION }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            { fieldFilter: { field: { fieldPath: 'fromUid' }, op: 'EQUAL', value: { stringValue: USER_A } } },
                            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'accepted' } } }
                        ]
                    }
                }
            }
        })
    });
    const queryJson = await queryResp.json();
    // Assuming queryJson result format
    const hasFriend = queryJson.some(d => d.document && d.document.fields.toUid.stringValue === USER_B);

    if (hasFriend) {
        console.log('✅ User A has User B in friends list (via sent query).');
    } else {
        console.error('❌ User A does NOT see User B.');
    }

    // 5. Cleanup
    console.log('\n--- Cleanup ---');
    await fetchWithTimeout(`${BASE_URL}/${COLLECTION}/${requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test Data Deleted');
}

main().catch(console.error);
