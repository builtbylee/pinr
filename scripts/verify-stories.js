/**
 * Custom Stories Feature Verification Script (REST API)
 * Simulates backend logic and verifies data integrity.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

const PROJECT_ID = 'days-c4ad4';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const STORIES_COLLECTION = 'stories';

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

// --- HELPERS (Reused from simulate-gameplay.js) ---
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
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
        else if (Array.isArray(v)) {
            fields[k] = { arrayValue: { values: v.map(str => ({ stringValue: str })) } };
        }
    }
    return fields;
}

function fromFirestore(doc) {
    const fields = doc.fields || {};
    const data = {};
    for (const [k, v] of Object.entries(fields)) {
        if (v.stringValue) data[k] = v.stringValue;
        if (v.integerValue) data[k] = parseInt(v.integerValue);
        if (v.booleanValue) data[k] = v.booleanValue;
        if (v.arrayValue && v.arrayValue.values) {
            data[k] = v.arrayValue.values.map(val => val.stringValue);
        } else if (v.arrayValue && !v.arrayValue.values) {
            data[k] = []; // Empty array
        }
    }
    return data;
}

// --- LOGIC VALIDATION ---
function validateStoryLimit(currentStories, maxLimit = 5) {
    if (currentStories.length >= maxLimit) {
        return { allowed: false, error: `Limit reached (${currentStories.length}/${maxLimit})` };
    }
    return { allowed: true };
}

function validatePinCount(pinIds, maxLimit = 10) {
    if (pinIds.length > maxLimit) {
        return { allowed: false, error: `Pin limit exceeded (${pinIds.length}/${maxLimit})` };
    }
    return { allowed: true };
}

// --- MAIN TEST ---
async function main() {
    console.log('\n=== CUSTOM STORIES VERIFICATION (REST API) ===\n');
    const token = await getAccessToken();

    // 1. Simulating User
    // We'll use a random dummy user ID to avoid messing with real data
    const TEST_USER_ID = `test_user_${Date.now()}`;
    console.log(`Step 1: Using Test User: ${TEST_USER_ID}`);

    // 2. Scenario: Create Story 1
    console.log('\n--- SCENARIO 1: CREATE STORY ---');
    const story1Data = {
        creatorId: TEST_USER_ID,
        title: 'My First Story',
        description: 'Testing creation',
        pinIds: ['pin_1', 'pin_2'],
        coverPinId: 'pin_1',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Verify Pin Logic locally
    const pinCheck = validatePinCount(story1Data.pinIds);
    if (!pinCheck.allowed) {
        console.error('❌ Client Logic Failed: ' + pinCheck.error); process.exit(1);
    }

    const createResp = await fetchWithTimeout(`${BASE_URL}/${STORIES_COLLECTION}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestore(story1Data) })
    });
    const createJson = await createResp.json();
    if (createJson.error) {
        console.error('❌ Firestore Create Failed:', createJson.error); process.exit(1);
    }
    const story1Id = createJson.name.split('/').pop();
    console.log(`✅ Story Created: ${story1Id}`);

    // 3. Scenario: Read & Verify
    console.log('\n--- SCENARIO 2: READ & VERIFY ---');
    const readResp = await fetchWithTimeout(`${BASE_URL}/${STORIES_COLLECTION}/${story1Id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const readDoc = await readResp.json();
    const readData = fromFirestore(readDoc);

    if (readData.title === story1Data.title && readData.pinIds.length === 2) {
        console.log('✅ Data Integrity Verified (Title matching, Pin count correct)');
    } else {
        console.error('❌ Data Integrity Mismatch:', readData);
    }

    // 4. Scenario: Story Limit Logic
    console.log('\n--- SCENARIO 3: STORY LIMIT LOGIC (SIMULATION) ---');
    // We already have 1. Let's create 4 more to hit limit.
    console.log('Creating 4 shadow stories...');
    for (let i = 0; i < 4; i++) {
        await fetchWithTimeout(`${BASE_URL}/${STORIES_COLLECTION}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: toFirestore({ ...story1Data, title: `Shadow Info ${i}` }) })
        });
    }

    // Now query count
    const queryResp = await fetchWithTimeout(`${BASE_URL}:runQuery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: STORIES_COLLECTION }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'creatorId' },
                        op: 'EQUAL',
                        value: { stringValue: TEST_USER_ID }
                    }
                }
            }
        })
    });
    const queryJson = await queryResp.json();
    // queryJson is array of { document: {}, readTime: {} }
    // Filter out empties? No, if empty result it might return empty array or one obj?
    const validDocs = queryJson.filter(d => d.document);
    const count = validDocs.length;
    console.log(`Current Story Count: ${count}`);

    // Validate Limit
    const limitCheck = validateStoryLimit(validDocs);
    if (!limitCheck.allowed) {
        console.log(`✅ Logic Correctly Rejects New Story found: ${limitCheck.error}`);
    } else {
        console.error(`❌ Logic Failed: Should reject but allowed. Count: ${count}`);
    }

    // 5. Cleanup
    console.log('\n--- CLEANUP ---');
    for (const d of validDocs) {
        const id = d.document.name.split('/').pop();
        await fetchWithTimeout(`${BASE_URL}/${STORIES_COLLECTION}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Deleted ${id}`);
    }
    console.log('✅ Cleanup Complete');
}

main().catch(console.error);
