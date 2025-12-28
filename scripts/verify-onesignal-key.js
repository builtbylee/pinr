#!/usr/bin/env node

/**
 * Script to verify OneSignal REST API Key configuration
 * 
 * This script helps you:
 * 1. Check if the key is set in .env file
 * 2. Verify the key format
 * 3. Test the key against OneSignal API
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function readEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
        log('❌ .env file not found!', 'red');
        return null;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    const envVars = {};
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                envVars[key.trim()] = valueParts.join('=').trim();
            }
        }
    }
    
    return envVars;
}

function verifyKeyFormat(key) {
    const issues = [];
    
    if (!key) {
        issues.push('Key is empty');
        return { valid: false, issues };
    }
    
    // OneSignal REST API keys typically:
    // - Start with 'os_' (newer format)
    // - OR are long alphanumeric strings (50+ characters)
    // - OR are base64-like strings
    
    if (key.length < 30) {
        issues.push(`Key is too short (${key.length} chars). Expected 30+ characters.`);
    }
    
    if (key.includes(' ')) {
        issues.push('Key contains spaces (should be a single string)');
    }
    
    // Check if it looks like a placeholder
    if (key.includes('YOUR_') || key.includes('REPLACE') || key === 'os_v2_app_...') {
        issues.push('Key appears to be a placeholder value');
    }
    
    return {
        valid: issues.length === 0,
        issues,
        format: key.startsWith('os_') ? 'os_* format' : 'alphanumeric format',
        length: key.length,
    };
}

async function testKeyWithAPI(key, appId) {
    log('\n🧪 Testing key with OneSignal API...', 'cyan');
    
    try {
        const response = await fetch('https://onesignal.com/api/v1/players?app_id=' + appId, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${key}`,
                'Content-Type': 'application/json',
            },
        });
        
        const status = response.status;
        const result = await response.json();
        
        if (status === 200) {
            log('✅ Key is VALID! OneSignal API accepted the key.', 'green');
            return { valid: true, message: 'Key works correctly' };
        } else if (status === 401) {
            log('❌ Key is INVALID! OneSignal API rejected the key (401 Unauthorized).', 'red');
            log('   This means the key is wrong or expired.', 'yellow');
            return { valid: false, message: 'Invalid key (401 Unauthorized)' };
        } else if (status === 400) {
            log('⚠️  App ID might be incorrect (400 Bad Request).', 'yellow');
            return { valid: false, message: 'App ID issue (400)' };
        } else {
            log(`⚠️  Unexpected response: ${status}`, 'yellow');
            return { valid: false, message: `Unexpected status: ${status}` };
        }
    } catch (error) {
        log(`❌ Error testing key: ${error.message}`, 'red');
        return { valid: false, message: error.message };
    }
}

async function main() {
    log('\n🔍 OneSignal REST API Key Verification Tool\n', 'blue');
    
    // Step 1: Check .env file
    log('📁 Step 1: Checking .env file...', 'cyan');
    const envVars = readEnvFile();
    
    if (!envVars) {
        log('\n💡 To create a .env file:', 'yellow');
        log('   1. Create a file named .env in the project root', 'yellow');
        log('   2. Add: EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=your_key_here', 'yellow');
        return;
    }
    
    const restApiKey = envVars['EXPO_PUBLIC_ONESIGNAL_REST_API_KEY'];
    const appId = envVars['EXPO_PUBLIC_ONESIGNAL_APP_ID'] || '5998e50e-ec2e-49fa-9d3f-9639168487ac';
    
    if (!restApiKey) {
        log('❌ EXPO_PUBLIC_ONESIGNAL_REST_API_KEY not found in .env file!', 'red');
        log('\n💡 Add this line to your .env file:', 'yellow');
        log('   EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key', 'yellow');
        return;
    }
    
    log(`✅ Found key in .env file (length: ${restApiKey.length})`, 'green');
    
    // Step 2: Verify format
    log('\n🔎 Step 2: Verifying key format...', 'cyan');
    const formatCheck = verifyKeyFormat(restApiKey);
    
    if (formatCheck.valid) {
        log(`✅ Key format looks good (${formatCheck.format}, ${formatCheck.length} chars)`, 'green');
    } else {
        log('⚠️  Key format issues detected:', 'yellow');
        formatCheck.issues.forEach(issue => log(`   - ${issue}`, 'yellow'));
    }
    
    // Show preview (safe to show)
    const preview = restApiKey.length > 14
        ? `${restApiKey.substring(0, 10)}...${restApiKey.substring(restApiKey.length - 4)}`
        : '***';
    log(`   Preview: ${preview}`, 'cyan');
    
    // Step 3: Test with API
    log('\n📡 Step 3: Testing key with OneSignal API...', 'cyan');
    log(`   App ID: ${appId}`, 'cyan');
    
    const apiTest = await testKeyWithAPI(restApiKey, appId);
    
    // Summary
    log('\n📊 Summary:', 'blue');
    log(`   Key found: ✅`, 'green');
    log(`   Format check: ${formatCheck.valid ? '✅' : '⚠️'}`, formatCheck.valid ? 'green' : 'yellow');
    log(`   API test: ${apiTest.valid ? '✅' : '❌'}`, apiTest.valid ? 'green' : 'red');
    
    if (!apiTest.valid) {
        log('\n💡 How to get your OneSignal REST API Key:', 'yellow');
        log('   1. Go to https://onesignal.com/', 'yellow');
        log('   2. Log in to your account', 'yellow');
        log('   3. Select your app (App ID: ' + appId + ')', 'yellow');
        log('   4. Go to Settings → Keys & IDs', 'yellow');
        log('   5. Copy the "REST API Key" (starts with "os_" or is a long string)', 'yellow');
        log('   6. Add it to your .env file:', 'yellow');
        log('      EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=your_copied_key', 'yellow');
        log('   7. Restart your Expo dev server: npx expo start --clear', 'yellow');
    }
    
    // Check EAS secrets
    log('\n📦 EAS Build Configuration:', 'cyan');
    log('   Note: For EAS builds, you also need to set the key as a secret:', 'yellow');
    log('   eas secret:create --scope project --name ONESIGNAL_REST_API_KEY --value your_key', 'yellow');
    log('   (This is already configured in eas.json as @ONESIGNAL_REST_API_KEY)', 'cyan');
}

main().catch(error => {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
});

