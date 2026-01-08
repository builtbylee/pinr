#!/bin/bash

# Firebase CLI Authentication Fix Script
# This script performs a complete authentication reset and verification

set -e

echo "🔧 Firebase CLI Authentication Fix"
echo "==================================="
echo ""

# Step 1: Complete cleanup
echo "🧹 Step 1: Complete cleanup..."
rm -rf ~/.config/firebase
mkdir -p ~/.config/firebase
chmod 700 ~/.config/firebase
echo "✅ Cleaned Firebase config directory"
echo ""

# Step 2: Verify Firebase CLI installation
echo "🔍 Step 2: Verifying Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools@latest
else
    FIREBASE_VERSION=$(firebase --version)
    echo "✅ Firebase CLI found: $FIREBASE_VERSION"
fi
echo ""

# Step 3: Check network connectivity
echo "🌐 Step 3: Testing network connectivity..."
if curl -s -o /dev/null -w "%{http_code}" https://firebase.googleapis.com | grep -q "200\|404"; then
    echo "✅ Can reach Firebase APIs"
else
    echo "❌ Cannot reach Firebase APIs. Check your network connection."
    exit 1
fi

if curl -s -o /dev/null -w "%{http_code}" https://accounts.google.com | grep -q "200\|302"; then
    echo "✅ Can reach Google Accounts"
else
    echo "❌ Cannot reach Google Accounts. Check your network connection."
    exit 1
fi
echo ""

# Step 4: Attempt authentication with proper error handling
echo "🔐 Step 4: Attempting authentication..."
echo ""
echo "This will open your browser for authentication."
echo "Please complete the login in your browser."
echo ""

# Try login with explicit localhost
echo "Attempting login with localhost..."
if firebase login --no-localhost 2>&1 | tee /tmp/firebase-login-output.txt; then
    echo ""
    echo "✅ Authentication successful!"
else
    LOGIN_OUTPUT=$(cat /tmp/firebase-login-output.txt)
    
    if echo "$LOGIN_OUTPUT" | grep -q "already logged in"; then
        echo "ℹ️  Already logged in, attempting to refresh..."
        firebase logout
        firebase login --no-localhost
    elif echo "$LOGIN_OUTPUT" | grep -q "Cannot run login"; then
        echo ""
        echo "⚠️  Interactive login required."
        echo ""
        echo "Please run this command manually in your terminal:"
        echo "   firebase login"
        echo ""
        echo "Or if that fails, try:"
        echo "   firebase login --no-localhost"
        echo ""
        exit 1
    else
        echo "❌ Authentication failed. Error:"
        echo "$LOGIN_OUTPUT"
        exit 1
    fi
fi
echo ""

# Step 5: Verify authentication
echo "✅ Step 5: Verifying authentication..."
if firebase projects:list &> /dev/null; then
    echo "✅ Authentication verified - can list projects"
    firebase projects:list
else
    echo "❌ Authentication verification failed"
    exit 1
fi
echo ""

# Step 6: Verify project configuration
echo "📋 Step 6: Verifying project configuration..."
cd "$(dirname "$0")/.."
CURRENT_PROJECT=$(firebase use 2>&1 | head -1)
echo "Current project: $CURRENT_PROJECT"

if [ "$CURRENT_PROJECT" != "days-c4ad4" ]; then
    echo "Setting project to days-c4ad4..."
    firebase use days-c4ad4
fi
echo ""

# Step 7: Test deployment capability
echo "🧪 Step 7: Testing deployment capability..."
if firebase functions:list &> /dev/null; then
    echo "✅ Can access Functions API"
    echo ""
    echo "🎉 Authentication fix complete!"
    echo ""
    echo "You can now deploy functions with:"
    echo "   firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode"
else
    echo "⚠️  Cannot access Functions API. This might be a permissions issue."
    echo "   Check that your account has the necessary permissions in Firebase Console."
fi

