#!/usr/bin/env node

/**
 * Generate Apple OAuth Client Secret for Sign in with Apple
 * 
 * Usage: node scripts/generate-apple-secret.js <key-file-path> <key-id> <team-id> <client-id>
 * 
 * Example: node scripts/generate-apple-secret.js AuthKey_8TV72LRP85.p8 8TV72LRP85 CMBSFLQ5V6 com.builtbylee.app80days.signin
 */

const fs = require('fs');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 4) {
    console.error('Usage: node generate-apple-secret.js <key-file-path> <key-id> <team-id> <client-id>');
    console.error('');
    console.error('Example:');
    console.error('  node generate-apple-secret.js AuthKey_8TV72LRP85.p8 8TV72LRP85 CMBSFLQ5V6 com.builtbylee.app80days.signin');
    process.exit(1);
}

const [keyFilePath, keyId, teamId, clientId] = args;

// Read the private key file
let privateKey;
try {
    privateKey = fs.readFileSync(keyFilePath, 'utf8');
} catch (error) {
    console.error(`Error reading key file: ${error.message}`);
    console.error(`File path: ${keyFilePath}`);
    process.exit(1);
}

// Create JWT header
const header = {
    alg: 'ES256',
    kid: keyId
};

// Create JWT payload
const now = Math.floor(Date.now() / 1000);
const payload = {
    iss: teamId,
    iat: now,
    exp: now + (180 * 24 * 60 * 60), // 180 days from now
    aud: 'https://appleid.apple.com',
    sub: clientId
};

// Convert to base64url
function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Sign JWT
function signJWT(header, payload, privateKey) {
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const sign = crypto.createSign('SHA256');
    sign.update(signatureInput);
    sign.end();
    
    const signature = sign.sign(privateKey, 'base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

try {
    const clientSecret = signJWT(header, payload, privateKey);
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ OAuth Client Secret Generated Successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Use these values in Firebase Console:');
    console.log('');
    console.log('OAuth Client ID:');
    console.log(`  ${clientId}`);
    console.log('');
    console.log('OAuth Client Secret:');
    console.log(`  ${clientSecret}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Next steps:');
    console.log('1. Go to Firebase Console → Authentication → Sign-in method');
    console.log('2. Click on "Apple"');
    console.log('3. Enable it');
    console.log('4. Enter the OAuth Client ID and Secret above');
    console.log('5. Click "Save"');
    console.log('');
    
} catch (error) {
    console.error('Error generating client secret:', error.message);
    process.exit(1);
}


