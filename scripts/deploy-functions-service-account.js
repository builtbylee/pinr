/**
 * Deploy Firebase Functions using Service Account Authentication
 * This bypasses the Firebase CLI authentication requirement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Service account path
const SERVICE_ACCOUNT_PATH = path.join(process.env.HOME, 'Downloads', 'days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service account file not found:', SERVICE_ACCOUNT_PATH);
    process.exit(1);
}

// Set environment variable for Firebase Admin SDK
process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;

console.log('🚀 Deploying Functions via Service Account');
console.log('==========================================');
console.log('');

// Build functions first
console.log('🔨 Building functions...');
const projectRoot = path.join(__dirname, '..');
const functionsDir = path.join(projectRoot, 'functions');

try {
    execSync('npm run build', { 
        cwd: functionsDir, 
        stdio: 'inherit',
        env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SERVICE_ACCOUNT_PATH }
    });
    console.log('✅ Build successful');
} catch (error) {
    console.error('❌ Build failed');
    process.exit(1);
}

console.log('');
console.log('📦 Preparing deployment...');

// Check if we can use gcloud CLI (alternative method)
const gcloudPath = execSync('which gcloud 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();

if (gcloudPath) {
    console.log('✅ Found gcloud CLI, using it for deployment...');
    try {
        // Authenticate with service account
        execSync(`gcloud auth activate-service-account --key-file="${SERVICE_ACCOUNT_PATH}"`, {
            stdio: 'inherit'
        });
        
        // Set project
        execSync('gcloud config set project days-c4ad4', {
            stdio: 'inherit'
        });
        
        // Deploy functions
        execSync('gcloud functions deploy getAppleAuthUrl --source=functions --runtime=nodejs20 --trigger=http --allow-unauthenticated --region=us-central1', {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        
        execSync('gcloud functions deploy exchangeAppleAuthCode --source=functions --runtime=nodejs20 --trigger=http --allow-unauthenticated --region=us-central1', {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        
        console.log('');
        console.log('✅ Deployment successful via gcloud!');
        process.exit(0);
    } catch (error) {
        console.error('❌ gcloud deployment failed, trying alternative method...');
    }
}

// Alternative: Use Firebase CLI with service account
console.log('🔄 Attempting Firebase CLI with service account...');

// Try to use firebase CLI with the service account
try {
    // Set the service account as default credentials
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
    
    // Try deploying
    execSync('firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SERVICE_ACCOUNT_PATH }
    });
    
    console.log('');
    console.log('✅ Deployment successful!');
} catch (error) {
    console.error('');
    console.error('❌ Deployment failed');
    console.error('');
    console.error('Firebase CLI requires OAuth authentication which cannot be automated.');
    console.error('');
    console.error('Please run this command in your terminal:');
    console.error('   firebase login');
    console.error('');
    console.error('Then run:');
    console.error('   firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode');
    process.exit(1);
}

