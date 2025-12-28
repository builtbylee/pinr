/**
 * Create an accepted friend_request document between hackneymanlee and mscita99
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

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
    const token = await getAccessToken();
    const projectId = 'days-c4ad4';
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const uid1 = 'FVgteJzI1VTVSSQIfNXk5I85Zpj1'; // hackneymanlee
    const uid2 = 'c18tTNHWUkdF9K9kVLcM8UOxLD82'; // mscita99

    // Create a friend_request document with accepted status
    // Using a deterministic ID so we don't create duplicates
    const requestId = `${uid1}_${uid2}`;
    const docUrl = `${baseUrl}/friend_requests/${requestId}`;

    const now = new Date().toISOString();

    const resp = await fetch(docUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: {
                fromUid: { stringValue: uid1 },
                toUid: { stringValue: uid2 },
                status: { stringValue: 'accepted' },
                participants: {
                    arrayValue: {
                        values: [
                            { stringValue: uid1 },
                            { stringValue: uid2 }
                        ]
                    }
                },
                createdAt: { timestampValue: now },
                acceptedAt: { timestampValue: now }
            }
        })
    });

    if (resp.ok) {
        console.log('✅ Created friend_request document between hackneymanlee and mscita99');
        console.log('Document ID:', requestId);
    } else {
        console.log('Failed:', await resp.text());
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
