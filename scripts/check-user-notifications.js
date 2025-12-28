process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const admin = require('firebase-admin');
const serviceAccount = require('/Users/lee/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUserProfile(username) {
    console.log(`\n🔍 Checking User: ${username}`);

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();

        if (snapshot.empty) {
            console.log('❌ User not found!');
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        console.log(`✅ User Found! (UID: ${doc.id})`);

        // Check Notification Settings
        console.log('\n⚙️ Notification Settings:');
        if (data.notificationSettings) {
            console.log(JSON.stringify(data.notificationSettings, null, 2));
        } else {
            console.log('⚠️ No notificationSettings object found (defaults should apply)');
        }

        // Check Push Token (Expo)
        console.log('\n📱 Push Token (Expo):');
        if (data.pushToken) {
            console.log(`✅ Present: ${data.pushToken.substring(0, 15)}...`);
        } else {
            console.log('⚠️ MISSING: No pushToken found in profile.');
        }

        // Check last login/update
        console.log('\n🕒 Activity:');
        console.log(`Updated At: ${data.updatedAt ? data.updatedAt.toDate().toISOString() : 'Unknown'}`);

    } catch (error) {
        console.error('Error checking user:', error);
    }
}

const username = 'leetest2';
checkUserProfile(username);
