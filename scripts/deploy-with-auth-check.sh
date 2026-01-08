#!/bin/bash

# Deployment script with authentication verification
# This ensures authentication is valid before attempting deployment

set -e

cd "$(dirname "$0")/.."

echo "🚀 Deploying Apple Sign-In Functions"
echo "====================================="
echo ""

# Verify authentication
echo "🔐 Verifying authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not authenticated. Running authentication fix..."
    ./scripts/firebase-auth-fix.sh
    if [ $? -ne 0 ]; then
        echo "❌ Authentication failed. Please run: firebase login"
        exit 1
    fi
fi

echo "✅ Authentication verified"
echo ""

# Verify project
echo "📋 Verifying project..."
CURRENT_PROJECT=$(firebase use 2>&1 | head -1)
if [ "$CURRENT_PROJECT" != "days-c4ad4" ]; then
    echo "Setting project to days-c4ad4..."
    firebase use days-c4ad4
fi
echo "✅ Project: days-c4ad4"
echo ""

# Build functions
echo "🔨 Building functions..."
cd functions
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
cd ..
echo "✅ Build successful"
echo ""

# Deploy
echo "🚀 Deploying functions..."
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Verify in Firebase Console → Functions"
    echo "   You should see:"
    echo "   - getAppleAuthUrl"
    echo "   - exchangeAppleAuthCode"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi

