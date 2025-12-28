/**
 * Check friend_requests between hackneymanlee and mscita99
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

    console.log('=== Checking friend_requests ===');

    // Query for any friend_request involving both users
    const queryUrl = `${baseUrl}:runQuery`;

    // Check requests from user1 to user2
    const query1 = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: 'friend_requests' }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            { fieldFilter: { field: { fieldPath: 'fromUid' }, op: 'EQUAL', value: { stringValue: uid1 } } },
                            { fieldFilter: { field: { fieldPath: 'toUid' }, op: 'EQUAL', value: { stringValue: uid2 } } }
                        ]
                    }
                }
            }
        })
    });

    const results1 = await query1.json();
    console.log('Requests from hackneymanlee to mscita99:');
    if (results1[0]?.document) {
        results1.forEach(r => {
            if (r.document) {
                console.log('  ID:', r.document.name.split('/').pop());
                console.log('  Status:', r.document.fields?.status?.stringValue);
                console.log('  Full:', JSON.stringify(r.document.fields, null, 2));
            }
        });
    } else {
        console.log('  None found');
    }

    // Check requests from user2 to user1
    const query2 = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: 'friend_requests' }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            { fieldFilter: { field: { fieldPath: 'fromUid' }, op: 'EQUAL', value: { stringValue: uid2 } } },
                            { fieldFilter: { field: { fieldPath: 'toUid' }, op: 'EQUAL', value: { stringValue: uid1 } } }
                        ]
                    }
                }
            }
        })
    });

    const results2 = await query2.json();
    console.log('\nRequests from mscita99 to hackneymanlee:');
    if (results2[0]?.document) {
        results2.forEach(r => {
            if (r.document) {
                console.log('  ID:', r.document.name.split('/').pop());
                console.log('  Status:', r.document.fields?.status?.stringValue);
            }
        });
    } else {
        console.log('  None found');
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
