const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Manually read .env file
function getEnvValue(key) {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(new RegExp(`${key}=(.*)`));
        if (match && match[1]) {
            return match[1].trim();
        }
    } catch (e) {
        console.warn('Could not read .env file:', e.message);
    }
    return null;
}

const ONE_SIGNAL_APP_ID = getEnvValue('EXPO_PUBLIC_ONESIGNAL_APP_ID') || '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONE_SIGNAL_REST_API_KEY = getEnvValue('EXPO_PUBLIC_ONESIGNAL_REST_API_KEY');

const MOCK_FRIEND_UID = 'test_friend_uid_123';
const MOCK_CREATOR_NAME = 'Simulated User';

async function notifyNewPin(friendUid, creatorName) {
    console.log(`[Simulation] Preparing to send notification to ${friendUid}...`);

    if (!ONE_SIGNAL_REST_API_KEY) {
        console.error('❌ Error: EXPO_PUBLIC_ONESIGNAL_REST_API_KEY not found in .env');
        return false;
    }

    const payload = {
        app_id: ONE_SIGNAL_APP_ID,
        include_aliases: { external_id: [friendUid] },
        target_channel: "push",
        headings: { en: "New Memory! 📍" },
        contents: { en: `${creatorName} added a new pin to the map.` },
        data: {
            type: 'new_pin',
            creatorName: creatorName
        }
    };

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[Simulation] OneSignal API Response:', JSON.stringify(result, null, 2));

        if (result.errors) {
            // Check specifically for "All included players are not subscribed" which is technically a "Success" in terms of API call working, 
            // just no user found.
            if (Array.isArray(result.errors) && result.errors[0].includes('All included players are not subscribed')) {
                console.log('✅ [Simulation] API Call Successful (No subscribed users found, which is expected for mock UID).');
                return true;
            }
            console.error('❌ [Simulation] Failed: OneSignal returned errors.');
            return false;
        }

        if (result.id) {
            console.log('✅ [Simulation] Success: Notification sent with ID:', result.id);
            return true;
        } else {
            console.warn('⚠️ [Simulation] Warning: No notification ID returned.');
            return false;
        }

    } catch (error) {
        console.error('❌ [Simulation] Exception during fetch:', error.message);
        return false;
    }
}

async function runSimulation() {
    console.log('=== Starting Pin Notification Simulation ===');
    const success = await notifyNewPin(MOCK_FRIEND_UID, MOCK_CREATOR_NAME);
    if (success) {
        console.log('\n=== Simulation PASSED ===');
    } else {
        console.log('\n=== Simulation FAILED ===');
        process.exit(1);
    }
}

runSimulation();
