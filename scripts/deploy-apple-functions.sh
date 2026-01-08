#!/bin/bash
# Autonomous deployment script for Apple Sign-In functions
# This script can be run locally or in CI to deploy the functions

set -e

echo "🚀 Starting Apple Sign-In Functions Deployment"
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

# Navigate to functions directory
cd functions

echo "📦 Installing dependencies..."
npm ci

echo ""
echo "🔨 Building functions..."
npm run build

echo ""
echo "✅ Verifying Apple functions in built code..."
node -e "
const f = require('./lib/index.js');
const appleFunctions = ['getAppleAuthUrl', 'exchangeAppleAuthCode'];
let allFound = true;
for (const funcName of appleFunctions) {
    if (typeof f[funcName] === 'function') {
        console.log('✅', funcName, 'EXISTS in built code');
    } else {
        console.log('❌', funcName, 'MISSING from built code');
        allFound = false;
    }
}
if (!allFound) {
    console.error('ERROR: Functions missing from built code!');
    process.exit(1);
}
"

echo ""
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &>/dev/null; then
    echo "⚠️  Not authenticated with Firebase. Please run: firebase login"
    exit 1
fi

echo ""
echo "🚀 Deploying ALL functions (to force discovery)..."
cd ..
firebase deploy --only functions --project days-c4ad4 --non-interactive

echo ""
echo "✅ Verifying deployment..."
firebase functions:list --project days-c4ad4 | grep -i "getAppleAuthUrl\|exchangeAppleAuthCode" && {
    echo ""
    echo "🎉 SUCCESS! Apple Sign-In functions are deployed!"
    echo ""
    firebase functions:list --project days-c4ad4 | grep -i "getAppleAuthUrl\|exchangeAppleAuthCode"
} || {
    echo "❌ ERROR: Apple functions not found after deployment"
    echo "Full function list:"
    firebase functions:list --project days-c4ad4
    exit 1
}

echo ""
echo "✅ Deployment complete!"
