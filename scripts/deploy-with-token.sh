#!/bin/bash

# Deploy Firebase Functions using a CI token
# This bypasses the interactive login requirement

set -e

cd "$(dirname "$0")/.."

echo "🚀 Deploying Functions with CI Token"
echo "====================================="
echo ""

# Check if token is provided
if [ -z "$FIREBASE_TOKEN" ]; then
    echo "❌ FIREBASE_TOKEN environment variable not set"
    echo ""
    echo "To get a token, run:"
    echo "   firebase login:ci"
    echo ""
    echo "Then set it:"
    echo "   export FIREBASE_TOKEN=your-token-here"
    echo "   ./scripts/deploy-with-token.sh"
    echo ""
    exit 1
fi

echo "✅ Using CI token for authentication"
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
FIREBASE_TOKEN="$FIREBASE_TOKEN" firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Verify in Firebase Console:"
    echo "   https://console.firebase.google.com/project/days-c4ad4/functions"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi

