/**
 * Reset explore streak for user leetest2
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

    // Query for user with username 'leetest2'
    const queryUrl = `${baseUrl}:runQuery`;
    const queryResp = await fetch(queryUrl, {
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
                        field: { fieldPath: 'usernameLower' },
                        op: 'EQUAL',
                        value: { stringValue: 'leetest2' }
                    }
                },
                limit: 1
            }
        })
    });

    const results = await queryResp.json();
    if (!results[0]?.document) {
        console.log('User leetest2 not found');
        return;
    }

    const docPath = results[0].document.name;
    const uid = docPath.split('/').pop();
    console.log('Found user UID:', uid);

    // Reset streak
    const updateUrl = `${baseUrl}/users/${uid}?updateMask.fieldPaths=streak`;
    const updateResp = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: {
                streak: {
                    mapValue: {
                        fields: {
                            current: { integerValue: '0' },
                            lastExploredDate: { stringValue: '' },
                            max: { integerValue: '0' }
                        }
                    }
                }
            }
        })
    });

    if (updateResp.ok) {
        console.log('✅ Streak reset for leetest2!');
    } else {
        console.log('Failed:', await updateResp.text());
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
