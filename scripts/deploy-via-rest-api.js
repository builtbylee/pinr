/**
 * Deploy Firebase Functions using Cloud Functions REST API
 * This bypasses Firebase CLI authentication by using service account
 */

// Handle SSL certificate issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');

// Configuration
const PROJECT_ID = 'days-c4ad4';
const REGION = 'us-central1';
const SERVICE_ACCOUNT_PATH = path.join(process.env.HOME, 'Downloads', 'days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');
const PROJECT_ROOT = path.join(__dirname, '..');
const FUNCTIONS_DIR = path.join(PROJECT_ROOT, 'functions');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service account file not found:', SERVICE_ACCOUNT_PATH);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// Helper to get access token
async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform'
    };
    
    const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(token)}`
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token request failed: ${error}`);
    }
    
    const data = await response.json();
    return data.access_token;
}

// Helper to create source zip
function createSourceZip() {
    return new Promise((resolve, reject) => {
        const zipPath = path.join(PROJECT_ROOT, 'functions-source.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => {
            console.log(`✅ Created source zip: ${archive.pointer()} bytes`);
            resolve(zipPath);
        });
        
        archive.on('error', reject);
        archive.pipe(output);
        
        // Add necessary files
        archive.directory(path.join(FUNCTIONS_DIR, 'lib'), 'lib');
        archive.file(path.join(FUNCTIONS_DIR, 'package.json'), { name: 'package.json' });
        archive.file(path.join(FUNCTIONS_DIR, 'package-lock.json'), { name: 'package-lock.json' });
        
        archive.finalize();
    });
}

// Deploy function via REST API
async function deployFunction(functionName, accessToken, sourceZip) {
    const functionUrl = `https://cloudfunctions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/functions/${functionName}`;
    
    // First, check if function exists
    const checkResponse = await fetch(functionUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const functionExists = checkResponse.ok;
    
    // Read source zip
    const sourceData = fs.readFileSync(sourceZip);
    const sourceBase64 = sourceData.toString('base64');
    
    const functionConfig = {
        name: `projects/${PROJECT_ID}/locations/${REGION}/functions/${functionName}`,
        runtime: 'nodejs20',
        entryPoint: functionName,
        httpsTrigger: {},
        sourceArchiveUrl: `data:application/zip;base64,${sourceBase64}`,
        environmentVariables: {}
    };
    
    const method = functionExists ? 'PATCH' : 'POST';
    const url = functionExists ? functionUrl : `https://cloudfunctions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/functions`;
    
    console.log(`📤 Deploying ${functionName}...`);
    
    const response = await fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(functionConfig)
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deployment failed: ${error}`);
    }
    
    const result = await response.json();
    console.log(`✅ ${functionName} deployment initiated`);
    return result;
}

// Main deployment
async function main() {
    console.log('🚀 Deploying Functions via REST API');
    console.log('====================================');
    console.log('');
    
    // Build functions
    console.log('🔨 Building functions...');
    try {
        execSync('npm run build', { 
            cwd: FUNCTIONS_DIR, 
            stdio: 'inherit'
        });
        console.log('✅ Build successful');
    } catch (error) {
        console.error('❌ Build failed');
        process.exit(1);
    }
    
    // Get access token
    console.log('');
    console.log('🔐 Authenticating...');
    const accessToken = await getAccessToken();
    console.log('✅ Authenticated');
    
    // Create source zip
    console.log('');
    console.log('📦 Creating source archive...');
    const sourceZip = await createSourceZip();
    
    // Deploy functions
    console.log('');
    console.log('🚀 Deploying functions...');
    
    try {
        await deployFunction('getAppleAuthUrl', accessToken, sourceZip);
        await deployFunction('exchangeAppleAuthCode', accessToken, sourceZip);
        
        console.log('');
        console.log('✅ Deployment successful!');
        console.log('');
        console.log('📝 Verify in Firebase Console → Functions');
        console.log('   You should see:');
        console.log('   - getAppleAuthUrl');
        console.log('   - exchangeAppleAuthCode');
    } catch (error) {
        console.error('');
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    } finally {
        // Cleanup
        if (fs.existsSync(sourceZip)) {
            fs.unlinkSync(sourceZip);
        }
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

