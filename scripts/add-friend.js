/**
 * Add leetestprofile to hackneymanlee's friends list
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
    const token = await getAccessToken();

    const hackneymanlee_uid = 'FVgteJzI1VTVSSQIfNXk5I85Zpj1';
    const leetestprofile_uid = 'CtPYJl250UPImOMjMaVQ5US6krM2';

    // New friends array including leetestprofile
    const newFriends = [
        { stringValue: 'c18tTNHWUkdF9K9kVLcM8UOxLD82' },  // mscita99
        { stringValue: 'tOw9g0iectfzFxgkPjZucJ9Cjxi1' },  // Trudi BA
        { stringValue: leetestprofile_uid }                // leetestprofile
    ];

    const url = `https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/users/${hackneymanlee_uid}?updateMask.fieldPaths=friends`;

    const resp = await fetchWithTimeout(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: {
                friends: {
                    arrayValue: {
                        values: newFriends
                    }
                }
            }
        })
    });

    const result = await resp.json();

    if (result.error) {
        console.error('Error:', result.error);
    } else {
        console.log('✅ Successfully added leetestprofile to hackneymanlee friends list!');
        // Sanitize friend UIDs in output (truncate to first 8 chars)
        const friends = result.fields?.friends?.arrayValue?.values?.map(v => v.stringValue) || [];
        const sanitizedFriends = friends.map(uid => uid ? uid.substring(0, 8) + '...' : 'NULL');
        console.log('New friends (UIDs truncated for security):', sanitizedFriends);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
