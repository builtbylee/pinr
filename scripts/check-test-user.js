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
    console.log('🔍 Fetching leetest2 profile...\n');
    const token = await getAccessToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    // Fetch all users and filter locally (simplest with REST API structure)
    // Firestore REST API allows filtering but the syntax is complex for structured queries. 
    // Since get-uids.js worked by listing, we'll do the same.
    const url = 'https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/users?pageSize=300';
    const resp = await fetch(url, { headers });
    const data = await resp.json();

    if (!data.documents) {
        console.log('No documents found or permission denied.');
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    const userDoc = data.documents.find(doc => {
        const fields = doc.fields;
        return fields.username && fields.username.stringValue === 'leetest2';
    });

    if (userDoc) {
        const fields = userDoc.fields;
        console.log('✅ User Found!');
        console.log(`UID: ${userDoc.name.split('/').pop()}`);

        console.log('\n⚙️ Notification Settings:');
        if (fields.notificationSettings) {
            // Firestore REST returns nested objects differently (mapValue)
            const map = fields.notificationSettings.mapValue.fields;
            const simplified = {};
            for (const [key, val] of Object.entries(map)) {
                simplified[key] = val.booleanValue;
            }
            console.log(JSON.stringify(simplified, null, 2));
        } else {
            console.log('⚠️ No notificationSettings object found');
        }

        console.log('\n📱 Push Token:');
        if (fields.pushToken) {
            console.log(`✅ Present: ${fields.pushToken.stringValue.substring(0, 15)}...`);
        } else {
            console.log('❌ MISSING: No pushToken found.');
        }

    } else {
        console.log('❌ User leetest2 not found in the list.');
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
