#!/bin/bash

# Complete Firebase Authentication and Deployment Solution
# This script handles everything except the one-time browser authentication

set -e

cd "$(dirname "$0")/.."

echo "🔧 Firebase CLI Complete Authentication Solution"
echo "================================================"
echo ""

# Step 1: Clean state
echo "🧹 Step 1: Cleaning authentication state..."
rm -rf ~/.config/firebase
mkdir -p ~/.config/firebase
chmod 700 ~/.config/firebase
echo "✅ Cleaned"
echo ""

# Step 2: Verify CLI
echo "🔍 Step 2: Verifying Firebase CLI..."
FIREBASE_VERSION=$(firebase --version)
echo "✅ Firebase CLI: $FIREBASE_VERSION"
echo ""

# Step 3: Network check
echo "🌐 Step 3: Testing connectivity..."
if curl -s -o /dev/null -w "%{http_code}" https://firebase.googleapis.com | grep -qE "200|404"; then
    echo "✅ Firebase APIs reachable"
else
    echo "❌ Cannot reach Firebase APIs"
    exit 1
fi
echo ""

# Step 4: Authentication
echo "🔐 Step 4: Authentication Required"
echo ""
echo "Firebase CLI requires one-time browser authentication."
echo "This cannot be automated, but we'll guide you through it."
echo ""
echo "Please run this command in your terminal:"
echo ""
echo "   firebase login"
echo ""
echo "This will:"
echo "  1. Open your browser"
echo "  2. Ask you to sign in with Google"
echo "  3. Grant permissions"
echo "  4. Save credentials automatically"
echo ""
echo "After you complete the login, press Enter here to continue..."
read -p "Press Enter after completing 'firebase login'..."

# Step 5: Verify authentication
echo ""
echo "✅ Step 5: Verifying authentication..."
if firebase projects:list &> /dev/null; then
    echo "✅ Authentication successful!"
    firebase projects:list
else
    echo "❌ Authentication verification failed"
    echo "Please run 'firebase login' again"
    exit 1
fi
echo ""

# Step 6: Set project
echo "📋 Step 6: Setting project..."
firebase use days-c4ad4
echo "✅ Project set: days-c4ad4"
echo ""

# Step 7: Verify functions access
echo "🧪 Step 7: Testing Functions API access..."
if firebase functions:list &> /dev/null; then
    echo "✅ Can access Functions API"
else
    echo "⚠️  Cannot list functions (may need permissions)"
fi
echo ""

# Step 8: Build functions
echo "🔨 Step 8: Building functions..."
cd functions
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
cd ..
echo "✅ Build successful"
echo ""

# Step 9: Deploy
echo "🚀 Step 9: Deploying functions..."
echo ""
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "✅ Verification:"
    echo "   - Functions deployed to Firebase"
    echo "   - Check Firebase Console → Functions"
    echo ""
    echo "📝 Deployed functions:"
    echo "   - getAppleAuthUrl"
    echo "   - exchangeAppleAuthCode"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi

