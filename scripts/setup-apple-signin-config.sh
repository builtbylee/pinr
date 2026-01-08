#!/bin/bash

# Apple Sign-In Firebase Functions Configuration Script
# This script helps set up Firebase Functions config for Apple Sign-In on Android

echo "🍎 Apple Sign-In Firebase Functions Configuration"
echo "=================================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed."
    echo "   Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase."
    echo "   Run: firebase login"
    exit 1
fi

echo "📋 Please provide the following information:"
echo ""

# Get Team ID
read -p "Enter your Apple Team ID: " TEAM_ID
if [ -z "$TEAM_ID" ]; then
    echo "❌ Team ID is required"
    exit 1
fi

# Key ID - use the one from Firebase Console
read -p "Enter your Key ID (from Firebase Console, currently: 8TV72LRP85): " KEY_ID
if [ -z "$KEY_ID" ]; then
    KEY_ID="8TV72LRP85"  # Default to what's in Firebase Console
    echo "Using default Key ID: $KEY_ID"
fi
echo "✅ Key ID: $KEY_ID"

# Service ID
SERVICE_ID="com.builtbylee.app80days.service"
echo "✅ Service ID: $SERVICE_ID"

# Redirect URI
REDIRECT_URI="https://getpinr.com/auth/apple/callback"
echo "✅ Redirect URI: $REDIRECT_URI"

# Read private key file
KEY_FILE="$HOME/Downloads/AuthKey_3T5RS67KHS.p8"
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Private key file not found at: $KEY_FILE"
    exit 1
fi

PRIVATE_KEY=$(cat "$KEY_FILE")

echo ""
echo "🔧 Setting Firebase Functions configuration..."
echo ""

# Set Firebase Functions config
firebase functions:config:set \
    apple.client_id="$SERVICE_ID" \
    apple.team_id="$TEAM_ID" \
    apple.key_id="$KEY_ID" \
    apple.redirect_uri="$REDIRECT_URI" \
    apple.private_key="$PRIVATE_KEY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Firebase Functions configuration set successfully!"
    echo ""
    echo "📝 Summary:"
    echo "   - Service ID: $SERVICE_ID"
    echo "   - Team ID: $TEAM_ID"
    echo "   - Key ID: $KEY_ID"
    echo "   - Redirect URI: $REDIRECT_URI"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Configure Firebase Console (enable Apple provider)"
    echo "   2. Deploy Cloud Functions: firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode"
else
    echo ""
    echo "❌ Failed to set Firebase Functions configuration"
    exit 1
fi

