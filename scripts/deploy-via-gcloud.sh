#!/bin/bash

# Deploy Firebase Functions using gcloud CLI with service account
# This bypasses Firebase CLI authentication issues

set -e

cd "$(dirname "$0")/.."

SERVICE_ACCOUNT_PATH="$HOME/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json"
PROJECT_ID="days-c4ad4"
REGION="us-central1"

echo "🚀 Deploying Functions via gcloud CLI"
echo "======================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found"
    echo ""
    echo "Please install Google Cloud SDK:"
    echo "  https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "Or try alternative: Deploy via Firebase Console"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Check service account
if [ ! -f "$SERVICE_ACCOUNT_PATH" ]; then
    echo "❌ Service account not found: $SERVICE_ACCOUNT_PATH"
    exit 1
fi

echo "✅ Service account found"
echo ""

# Authenticate with service account
echo "🔐 Authenticating with service account..."
gcloud auth activate-service-account --key-file="$SERVICE_ACCOUNT_PATH" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Service account authentication failed"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Set project
echo "📋 Setting project..."
gcloud config set project "$PROJECT_ID" 2>&1
echo "✅ Project set: $PROJECT_ID"
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

# Deploy functions using gcloud
echo "🚀 Deploying functions..."
echo ""

# Note: gcloud functions deploy requires the functions to be in a specific format
# We need to use firebase-tools or deploy via the Firebase Console
# Let me check if we can use firebase-tools with the service account

echo "⚠️  gcloud functions deploy requires different function format"
echo ""
echo "Alternative: Deploy via Firebase Console"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/days-c4ad4/functions"
echo "2. Click 'Deploy' or use the Firebase Console deployment"
echo ""
echo "Or try: firebase-tools with service account environment variable"
echo ""

# Try using firebase-tools with service account
export GOOGLE_APPLICATION_CREDENTIALS="$SERVICE_ACCOUNT_PATH"

echo "🔄 Attempting Firebase CLI with service account..."
cd functions
if firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project "$PROJECT_ID" 2>&1; then
    echo ""
    echo "✅ Deployment successful!"
else
    echo ""
    echo "❌ Deployment failed"
    echo ""
    echo "📝 Manual Deployment Option:"
    echo "1. Go to Firebase Console: https://console.firebase.google.com/project/days-c4ad4/functions"
    echo "2. Use 'Deploy from source' option"
    echo "3. Select the 'functions' directory"
    echo "4. Deploy the functions"
    exit 1
fi

