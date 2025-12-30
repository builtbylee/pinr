
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const emailToTest = process.argv[2];

if (!emailToTest) {
    console.error('Please provide an email address as an argument.');
    process.exit(1);
}

async function testPasswordResetLink() {
    try {
        const link = await admin.auth().generatePasswordResetLink(emailToTest);
        console.log(`Successfully generated password reset link for ${emailToTest}`);
        console.log(`Link: ${link}`);
        console.log('\nNOTE: This script generates a link directly using Admin SDK.');
        console.log('The client-side app uses sendPasswordResetEmail() which triggers the email template.');
        console.log('If you see this link, it means the Auth service is correctly configured for this user.');
    } catch (error) {
        console.error('Error generating reset link:', error);
    }
}

testPasswordResetLink();
