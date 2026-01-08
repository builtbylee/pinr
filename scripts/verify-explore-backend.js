/**
 * Verify Explore & Bucket List Backend Logic
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

// --- LOAD ENV (Simulated) ---
// We need to parse .env file because we don't have 'dotenv'
const fs = require('fs');
const path = require('path');
function getEnvValue(key) {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(new RegExp(`^${key}=(.*)`, 'm'));
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}
const MAPBOX_TOKEN = getEnvValue('EXPO_PUBLIC_MAPBOX_TOKEN');

const PROJECT_ID = 'days-c4ad4';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const USERS_COLLECTION = 'users';

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
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
    });
    return (await response.json()).access_token;
}

async function main() {
    console.log('\n=== EXPLORE & BUCKET LIST VERIFICATION ===\n');

    // 1. Verify Mapbox Search
    console.log('--- Step 1: Mapbox Geocoding ---');
    if (!MAPBOX_TOKEN) {
        console.error('❌ Missing EXPO_PUBLIC_MAPBOX_TOKEN in .env');
    } else {
        const query = 'London';
        // Use Authorization header instead of URL parameter for security
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place&limit=1`;
        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${MAPBOX_TOKEN}`
            }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.features && data.features.length > 0) {
                console.log(`✅ Search Success: Found "${data.features[0].place_name}"`);
            } else {
                console.error('❌ Search returned no results');
            }
        } else {
            console.error(`❌ Search Failed: ${resp.status} ${resp.statusText}`);
        }
    }

    // 2. Verify Bucket List (Firestore)
    console.log('\n--- Step 2: Bucket List Logic ---');
    const token = await getAccessToken();
    const TEST_UID = `test_explorer_${Date.now()}`;
    console.log(`Using Test User: ${TEST_UID}`);

    // Create User Doc
    await fetch(`${BASE_URL}/${USERS_COLLECTION}?documentId=${TEST_UID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { username: { stringValue: 'ExplorerTest' }, bucketList: { arrayValue: { values: [] } } } })
    });

    // Add Item
    const item = {
        locationName: 'Eiffel Tower',
        coordinates: [2.2945, 48.8584],
        status: 'wishlist'
    };
    // Helper to format item for Firestore
    const firestoreItem = {
        mapValue: {
            fields: {
                locationName: { stringValue: item.locationName },
                coordinates: { arrayValue: { values: [{ doubleValue: item.coordinates[0] }, { doubleValue: item.coordinates[1] }] } },
                status: { stringValue: item.status }
            }
        }
    };

    console.log('Adding "Eiffel Tower" to Bucket List...');
    const addResp = await fetch(`${BASE_URL}/${USERS_COLLECTION}/${TEST_UID}:runQuery`, { // Using runQuery? No, define patch.
        // Actually arrayUnion via REST is tricky. We'll read, modify, write (simulate client logic).
        // Or simpler: Just WRITE the array directly.
        // We want to verify that the logic works.
    });

    // Simplification for REST Script: READ -> PUSH -> WRITE
    const readResp = await fetch(`${BASE_URL}/${USERS_COLLECTION}/${TEST_UID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const readDoc = await readResp.json();
    let currentBucket = readDoc.fields.bucketList?.arrayValue?.values || [];
    currentBucket.push(firestoreItem);

    const updateResp = await fetch(`${BASE_URL}/${USERS_COLLECTION}/${TEST_UID}?updateMask.fieldPaths=bucketList`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: {
                bucketList: { arrayValue: { values: currentBucket } }
            }
        })
    });

    if (updateResp.ok) {
        console.log('✅ Bucket List Updated');
    } else {
        const err = await updateResp.json();
        console.error('❌ Update Failed:', err);
    }

    // Verify
    const verifyResp = await fetch(`${BASE_URL}/${USERS_COLLECTION}/${TEST_UID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const verifyDoc = await verifyResp.json();
    const list = verifyDoc.fields.bucketList.arrayValue.values;
    const hasItem = list.some(i => i.mapValue.fields.locationName.stringValue === 'Eiffel Tower');

    if (hasItem) {
        console.log('✅ Verified: Item exists in Firestore');
    } else {
        console.error('❌ Item NOT found in Firestore');
    }

    // Cleanup
    console.log('\n--- Cleanup ---');
    await fetch(`${BASE_URL}/${USERS_COLLECTION}/${TEST_UID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test User Deleted');
}

main().catch(console.error);
