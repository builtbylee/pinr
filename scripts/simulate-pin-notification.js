const fetch = require('node-fetch');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass local cert issues

// Configuration (Mirrors src/services/NotificationService.ts)
const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONE_SIGNAL_REST_API_KEY = 'os_v2_app_lgmokdxmfze7vhj7sy4rnbehvsajdjhgufbegzfkoyeuqj7txtsyebzctnwo577asbhicpokkrh5plskt3kx2zmrvjanqtsumxn22oi';

// Mock Data
const MOCK_FRIEND_UID = 'test_friend_uid_123'; // Matches 'external_id' in OneSignal
const MOCK_CREATOR_NAME = 'Simulated User';

async function notifyNewPin(friendUid, creatorName) {
    console.log(`[Simulation] Preparing to send notification to ${friendUid}...`);

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

    console.log('[Simulation] Payload:', JSON.stringify(payload, null, 2));

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
            console.error('❌ [Simulation] Failed: OneSignal returned errors.');
            return false;
        }

        if (result.id) {
            console.log('✅ [Simulation] Success: Notification sent with ID:', result.id);
            return true;
        } else {
            console.warn('⚠️ [Simulation] Warning: No notification ID returned, but no errors either.');
            return false;
        }

    } catch (error) {
        console.error('❌ [Simulation] Exception during fetch:', error.message);
        return false;
    }
}

async function runSimulation() {
    console.log('=== Starting Pin Notification Simulation ===');

    // 1. Simulate Notification Sending
    const success = await notifyNewPin(MOCK_FRIEND_UID, MOCK_CREATOR_NAME);

    if (success) {
        console.log('\n=== Simulation PASSED ===');
        console.log('The notification logic using OneSignal REST API is VALID.');
        console.log('Note: Since the target user is a mock UID, OneSignal might show typical "All included players are not subscribed" error if this UID is not actually registered in the App. This is EXPECTED behaviour for a fresh mock UID and confirms the API call reached OneSignal.');
    } else {
        console.log('\n=== Simulation FAILED ===');
        console.log('Check the error logs above.');
    }
}

runSimulation();
