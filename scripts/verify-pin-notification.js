process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetch = require('node-fetch');

// Configuration
const ONE_SIGNAL_APP_ID = '5998e50e-ec2e-49fa-9d3f-9639168487ac';
const ONE_SIGNAL_REST_API_KEY = 'os_v2_app_lgmokdxmfze7vhj7sy4rnbehvsajdjhgufbegzfkoyeuqj7txtsyebzctnwo577asbhicpokkrh5plskt3kx2zmrvjanqtsumxn22oi';

// Test Data
// Sender: hackneymanlee
const SENDER_NAME = 'hackneymanlee';
// Receiver: leetestprofile
const RECEIVER_UID = 'CtPYJl250UPImOMjMaVQ5US6krM2';

async function sendPinNotification() {
    console.log(`Using App ID: ${ONE_SIGNAL_APP_ID}`);
    console.log(`Sending notification to External ID: ${RECEIVER_UID}`);

    const payload = {
        app_id: ONE_SIGNAL_APP_ID,
        include_aliases: {
            external_id: [RECEIVER_UID]
        },
        target_channel: "push",
        headings: {
            en: "New Memory! 📍"
        },
        contents: {
            en: `${SENDER_NAME} added a new pin to the map.`
        },
        data: {
            type: 'new_pin',
            creatorName: SENDER_NAME
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

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (data.id && !data.errors) {
            console.log('TEST PASSED: Notification accepted by OneSignal.');
        } else {
            console.log('TEST FAILED: OneSignal returned an error.');
        }

    } catch (error) {
        console.error('TEST FAILED: Exception during fetch:', error);
    }
}

sendPinNotification();
