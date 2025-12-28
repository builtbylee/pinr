/**
 * Expert Panel Verification Script
 * Tests the full notification pipeline using REST API
 */

// Bypass TLS for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fetch = require('node-fetch');

// Firebase REST API configuration
const PROJECT_ID = 'days-c4ad4';
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

// Generate JWT for Firebase REST API
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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

    const data = await response.json();
    return data.access_token;
}

async function getFirestoreDocument(accessToken, collection, docId) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.json();
}

async function listCollection(accessToken, collection) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.json();
}

function extractFieldValue(field) {
    if (!field) return null;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.arrayValue) return (field.arrayValue.values || []).map(v => extractFieldValue(v));
    if (field.mapValue) {
        const result = {};
        for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
            result[k] = extractFieldValue(v);
        }
        return result;
    }
    return null;
}

async function verifyNotificationSystem() {
    console.log('\n=== EXPERT PANEL: NOTIFICATION SYSTEM VERIFICATION ===\n');

    // Step 1: Get access token
    console.log('Step 1: Authenticating with Firebase...');
    const accessToken = await getAccessToken();
    console.log('  ✓ Access token obtained');

    // Step 2: Get all users
    console.log('\nStep 2: Fetching users from Firestore...');
    const usersData = await listCollection(accessToken, 'users');

    if (!usersData.documents) {
        console.log('  ❌ No users found in Firestore!');
        return;
    }

    const usersWithTokens = [];
    const usersWithoutTokens = [];

    for (const doc of usersData.documents) {
        const fields = doc.fields || {};
        const pathParts = doc.name.split('/');
        const uid = pathParts[pathParts.length - 1];

        const user = {
            uid,
            username: extractFieldValue(fields.username) || '[no username]',
            pushToken: extractFieldValue(fields.pushToken),
            friends: extractFieldValue(fields.friends) || []
        };

        if (user.pushToken) {
            usersWithTokens.push(user);
        } else {
            usersWithoutTokens.push(user);
        }
    }

    console.log('  ✓ Users WITH push tokens:', usersWithTokens.length);
    console.log('  ✗ Users WITHOUT push tokens:', usersWithoutTokens.length);

    if (usersWithoutTokens.length > 0) {
        console.log('    Missing tokens for:', usersWithoutTokens.map(u => u.username).join(', '));
    }

    // Step 3: Show friend relationships
    console.log('\nStep 3: Checking friend relationships...');
    const allUsers = [...usersWithTokens, ...usersWithoutTokens];
    for (const user of usersWithTokens) {
        const friendNames = [];
        for (const friendUid of user.friends) {
            const friendUser = allUsers.find(u => u.uid === friendUid);
            if (friendUser) {
                const hasToken = friendUser.pushToken ? '✓' : '✗';
                friendNames.push(`${friendUser.username} [token: ${hasToken}]`);
            } else {
                friendNames.push(`[Unknown: ${friendUid.substring(0, 8)}...]`);
            }
        }
        console.log(`  User: ${user.username}`);
        console.log(`    Token: ${user.pushToken ? user.pushToken.substring(0, 40) + '...' : 'MISSING'}`);
        console.log(`    Friends: ${friendNames.length > 0 ? friendNames.join(', ') : 'NONE'}`);
    }

    // Step 4: Send test notification
    if (usersWithTokens.length >= 1) {
        console.log('\nStep 4: Testing notification delivery...');
        const testUser = usersWithTokens[0];
        console.log(`  Sending test notification to: ${testUser.username}`);

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: testUser.pushToken,
                title: '🔬 Expert Panel Verification',
                body: 'If you see this, notifications are working!',
                sound: 'default',
                data: { type: 'verification_test' }
            })
        });

        const result = await response.json();
        console.log('  API Response:', JSON.stringify(result, null, 2));

        if (result.data) {
            const status = Array.isArray(result.data) ? result.data[0]?.status : result.data.status;
            const message = Array.isArray(result.data) ? result.data[0]?.message : result.data.message;

            if (status === 'ok') {
                console.log('  ✅ NOTIFICATION SENT SUCCESSFULLY');
                console.log('  📱 Check device for:', testUser.username);
            } else if (status === 'error') {
                console.log('  ❌ NOTIFICATION FAILED');
                console.log('  Error:', message);
            } else {
                console.log('  ⚠️ UNEXPECTED RESPONSE:', JSON.stringify(result.data));
            }
        } else {
            console.log('  ⚠️ UNEXPECTED RESPONSE (No data field):', JSON.stringify(result));
        }
    }

    // Step 5: Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Users with tokens: ${usersWithTokens.length}`);
    console.log(`Users without tokens: ${usersWithoutTokens.length}`);

    const usersWithFriends = usersWithTokens.filter(u => u.friends.length > 0);
    console.log(`Users with friends who have tokens: ${usersWithFriends.length}`);

    if (usersWithTokens.length === 0) {
        console.log('\n🚨 CRITICAL: No users have push tokens!');
    }

    if (usersWithFriends.length === 0) {
        console.log('\n🚨 CRITICAL: No users have friends with tokens!');
    }

    console.log('\n=== VERIFICATION COMPLETE ===\n');
}

verifyNotificationSystem()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Verification failed:', e);
        process.exit(1);
    });
