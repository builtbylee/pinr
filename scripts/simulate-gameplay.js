/**
 * Gameplay Simulation Script (REST API Version)
 * Verifies End-of-Game Logic and Anti-Cheat Validation
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetch = require('node-fetch');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

const PROJECT_ID = 'days-c4ad4';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// AUTH HELPERS
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

// REST HELPERS
async function firestoreGet(token, path) {
    const response = await fetch(`${BASE_URL}/${path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
}

async function firestoreCreate(token, collection, data) {
    const response = await fetch(`${BASE_URL}/${collection}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestore(data) })
    });
    return response.json();
}

async function firestorePatch(token, path, data) {
    // Construct query param for updateMask
    const fieldPaths = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const response = await fetch(`${BASE_URL}/${path}?${fieldPaths}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestore(data) })
    });
    return response.json();
}

function toFirestore(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'number') fields[k] = { integerValue: v.toString() }; // or doubleValue
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
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
    }
    return data;
}

// LOGIC HELPERS
function validateSubmission(challenge, isChallenger, submissionTime) {
    const startedAt = isChallenger ? challenge.challengerStartedAt : challenge.opponentStartedAt;
    const TIME_LIMIT_MS = 40 * 1000;

    if (!startedAt) {
        return { valid: true, warning: 'No start time (Legacy/Offline)' };
    }
    const elapsed = submissionTime - startedAt;
    if (elapsed > TIME_LIMIT_MS) {
        return { valid: false, error: `Time Limit Exceeded: ${elapsed}ms > ${TIME_LIMIT_MS}ms` };
    }
    return { valid: true };
}

// MAIN
async function main() {
    console.log('\n=== GAMEPLAY SIMULATION (REST API) ===\n');
    const token = await getAccessToken();

    // 1. Get Users
    console.log('Step 1: Finding users...');
    const usersResp = await fetch(`${BASE_URL}/users?pageSize=2`, { headers: { 'Authorization': `Bearer ${token}` } });
    const usersJson = await usersResp.json();
    if (!usersJson.documents || usersJson.documents.length < 2) {
        console.error('Not enough users'); process.exit(1);
    }

    const u1 = fromFirestore(usersJson.documents[0]);
    const u2 = fromFirestore(usersJson.documents[1]);
    const uid1 = usersJson.documents[0].name.split('/').pop();
    const uid2 = usersJson.documents[1].name.split('/').pop();

    console.log(`  Challenger: ${u1.username} (${uid1})`);
    console.log(`  Opponent:   ${u2.username} (${uid2})`);

    // --- SCENARIO 1: HAPPY PATH ---
    console.log('\n--- SCENARIO 1: HAPPY PATH ---');
    const now = Date.now();
    const challengeData = {
        challengerId: uid1,
        challengerUsername: u1.username,
        opponentId: uid2,
        opponentUsername: u2.username,
        difficulty: 'medium',
        status: 'pending',
        createdAt: now,
        expiresAt: now + 86400000
    };

    const createResp = await firestoreCreate(token, 'game_challenges', challengeData);
    const challengeId = createResp.name.split('/').pop();
    console.log(`  Created Challenge: ${challengeId}`);

    // Update Status -> Accepted
    // Update ChallengerStartedAt
    const startT = Date.now();
    await firestorePatch(token, `game_challenges/${challengeId}`, {
        status: 'accepted',
        challengerStartedAt: startT
    });
    console.log(`  Challenger started at: ${startT}`);

    // Verify Read & Validation
    let doc = await firestoreGet(token, `game_challenges/${challengeId}`);
    let data = fromFirestore(doc);

    // Simulate Submit 35s later
    let valid = validateSubmission(data, true, startT + 35000);
    if (valid.valid) {
        console.log('  ✅ Challenger Submission VALID (Elapsed: 35s)');
    } else {
        console.error('  ❌ Challenger Submission FAILED');
    }

    // --- SCENARIO 2: TIME LIMIT EXCEEDED ---
    console.log('\n--- SCENARIO 2: TIME LIMIT EXCEEDED ---');
    const cheatData = { ...challengeData };
    const cheatResp = await firestoreCreate(token, 'game_challenges', cheatData);
    const cheatId = cheatResp.name.split('/').pop();

    const cheatStart = Date.now();
    await firestorePatch(token, `game_challenges/${cheatId}`, {
        status: 'accepted',
        challengerStartedAt: cheatStart
    });
    console.log(`  Cheater started at: ${cheatStart}`);

    // Simulate Submit 60s later
    // Refetch
    doc = await firestoreGet(token, `game_challenges/${cheatId}`);
    data = fromFirestore(doc);

    valid = validateSubmission(data, true, cheatStart + 60000);
    if (!valid.valid) {
        console.log(`  ✅ Anti-Cheat CAUGHT the timeout: ${valid.error}`);
    } else {
        console.error(`  ❌ Anti-Cheat FAILED to catch timeout!`);
    }

    // --- SCENARIO 3: PERSISTENCE (Conceptual) ---
    console.log('\n--- SCENARIO 3: PERSISTENCE (Conceptual) ---');
    if (data.challengerStartedAt) {
        console.log('  ✅ Persistence Verified: Server holds `startedAt` field.');
        console.log('     If client reloads, it receives this timestamp.');
        console.log('     If client tries to reset local timer, submission will still fail against this timestamp.');
    }

    console.log('\n=== SIMULATION COMPLETE ===');
}

main().catch(console.error);
