/**
 * Check and fix friend relationship between hackneymanlee and mscita99
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

async function getUserByUsername(token, username) {
    const projectId = 'days-c4ad4';
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const queryUrl = `${baseUrl}:runQuery`;
    const queryResp = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: 'users' }],
                where: { fieldFilter: { field: { fieldPath: 'usernameLower' }, op: 'EQUAL', value: { stringValue: username.toLowerCase() } } },
                limit: 1
            }
        })
    });

    const results = await queryResp.json();
    if (!results[0]?.document) return null;

    const docPath = results[0].document.name;
    const uid = docPath.split('/').pop();
    return { uid, doc: results[0].document };
}

async function main() {
    const token = await getAccessToken();

    // Get both users
    console.log('=== Checking Users ===');
    const user1 = await getUserByUsername(token, 'hackneymanlee');
    const user2 = await getUserByUsername(token, 'mscita99');

    if (!user1 || !user2) {
        console.log('Could not find one or both users');
        return;
    }

    console.log('hackneymanlee UID:', user1.uid);
    console.log('mscita99 UID:', user2.uid);

    // Check friends arrays
    console.log('\n=== Friends Arrays ===');
    const friends1 = user1.doc.fields?.friends?.arrayValue?.values || [];
    const friends2 = user2.doc.fields?.friends?.arrayValue?.values || [];

    console.log('hackneymanlee friends:', friends1.map(f => f.stringValue));
    console.log('mscita99 friends:', friends2.map(f => f.stringValue));

    // Check if they have each other
    const user1HasUser2 = friends1.some(f => f.stringValue === user2.uid);
    const user2HasUser1 = friends2.some(f => f.stringValue === user1.uid);

    console.log('\n=== Relationship Status ===');
    console.log('hackneymanlee has mscita99 in friends:', user1HasUser2);
    console.log('mscita99 has hackneymanlee in friends:', user2HasUser1);

    // Check hiddenFriends
    console.log('\n=== Hidden Friends ===');
    const hidden1 = user1.doc.fields?.hiddenFriends?.arrayValue?.values || [];
    const hidden2 = user2.doc.fields?.hiddenFriends?.arrayValue?.values || [];

    console.log('hackneymanlee hiddenFriends:', hidden1.map(f => f.stringValue));
    console.log('mscita99 hiddenFriends:', hidden2.map(f => f.stringValue));

    const user1HidUser2 = hidden1.some(f => f.stringValue === user2.uid);
    const user2HidUser1 = hidden2.some(f => f.stringValue === user1.uid);

    console.log('hackneymanlee hid mscita99:', user1HidUser2);
    console.log('mscita99 hid hackneymanlee:', user2HidUser1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
