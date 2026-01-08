# Quick Fix: Enable Cloud Billing API

## The Issue
Firebase Functions deployment requires the Cloud Billing API to be enabled.

## Quick Fix (1 minute)

### Option 1: Direct Link (Easiest)
Click this link to enable the API:
https://console.developers.google.com/apis/api/cloudbilling.googleapis.com/overview?project=days-c4ad4

Then click **"ENABLE"** button.

### Option 2: Manual Steps
1. Go to: https://console.cloud.google.com/apis/library?project=days-c4ad4
2. Search for: `Cloud Billing API`
3. Click on the result
4. Click **"ENABLE"**

### After Enabling
1. **Wait 1-2 minutes** for the API to activate
2. **Re-run the GitHub Actions workflow**
3. Should work! ✅

## If You Get Billing Errors

If enabling the API shows billing errors:
1. Go to: https://console.firebase.google.com/project/days-c4ad4/settings/usage
2. Check if billing is enabled
3. If not, upgrade to Blaze plan (free tier available)

## Why This Is Needed

Firebase Functions require:
- Cloud Billing API (to check billing status)
- Cloud Functions API (already enabled ✅)
- Cloud Build API (already enabled ✅)

