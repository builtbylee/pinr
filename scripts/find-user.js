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
    const username = 'leetest2';

    console.log(`Searching for username: ${username}...`);

    const url = `https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents:runQuery`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: 'users' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'username' },
                        op: 'EQUAL',
                        value: { stringValue: username }
                    }
                }
            }
        })
    });

    const data = await resp.json();

    if (data[0] && data[0].document) {
        const doc = data[0].document;
        console.log('FOUND USER!');
        console.log('Name:', doc.name); // projects/.../databases/(default)/documents/users/UID
        console.log('UID:', doc.name.split('/').pop());
        console.log('Current Friends:', JSON.stringify(doc.fields.friends, null, 2));
    } else {
        console.log('User not found or no documents returned.');
        console.log(JSON.stringify(data, null, 2));
    }
}

main().catch(console.error);
