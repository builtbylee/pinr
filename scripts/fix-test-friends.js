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

    const targetUser_uid = 'Klr9s2JqPPYEGqpHeotKUS1PUvn1'; // leetest2

    // Friends to add
    const friendsToAdd = [
        'FVgteJzI1VTVSSQIfNXk5I85Zpj1', // hackneymanlee
        'CtPYJl250UPImOMjMaVQ5US6krM2', // leetestprofile
        'c18tTNHWUkdF9K9kVLcM8UOxLD82'  // mscita99
    ];

    console.log(`Updating friends list for leetest2 (${targetUser_uid})...`);

    const values = friendsToAdd.map(uid => ({ stringValue: uid }));

    const url = `https://firestore.googleapis.com/v1/projects/days-c4ad4/databases/(default)/documents/users/${targetUser_uid}?updateMask.fieldPaths=friends`;

    const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: {
                friends: {
                    arrayValue: {
                        values: values
                    }
                }
            }
        })
    });

    const result = await resp.json();

    if (result.error) {
        console.error('Error:', result.error);
    } else {
        console.log('✅ Successfully updated friends list for leetest2!');
        console.log('Friends now:', result.fields?.friends?.arrayValue?.values?.map(v => v.stringValue));
    }
}

main().catch(console.error);
