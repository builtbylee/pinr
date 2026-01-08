/**
 * Quick script to get UIDs for all users
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

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

async function main() {
    console.log('Fetching user UIDs from Firestore...\n');
    const token = await getAccessToken();
    const url = 'https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/users';
    const resp = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await resp.json();

    for (const doc of data.documents || []) {
        const parts = doc.name.split('/');
        const uid = parts[parts.length - 1];
        const username = doc.fields?.username?.stringValue || '[no username]';
        // Truncate UID for security (first 8 chars only)
        const truncatedUid = uid ? uid.substring(0, 8) + '...' : 'NULL';
        console.log(`${username}: ${truncatedUid}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
