# Complete Service Account Permissions for Firebase Functions Deployment

## Required Roles

Your service account `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com` needs these roles:

### Essential Roles:
1. ✅ **Service Account User** (`roles/iam.serviceAccountUser`) - Already added
2. ⏳ **Firebase Admin** (`roles/firebase.admin`) - **NEED TO ADD**

### Alternative (Minimal Permissions):
If you don't want to grant full Firebase Admin, you can grant:
- **Cloud Functions Developer** (`roles/cloudfunctions.developer`)
- **Firebase Extensions Admin** (`roles/firebaseextensions.admin`)
- **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`)

## Quick Fix

### Step 1: Go to IAM
https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4

### Step 2: Edit Service Account
1. Find: `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com`
2. Click **Edit (pencil icon)**
3. Click **"ADD ANOTHER ROLE"**
4. Add: **Firebase Admin** (`roles/firebase.admin`)
5. Click **SAVE**

### Step 3: Retry
1. Wait 30-60 seconds
2. Re-run GitHub Actions workflow
3. Should work! ✅

## Why Firebase Admin?

Firebase Admin role includes:
- Functions deployment
- Extensions API access
- All Firebase service permissions

This is the simplest solution and is safe for CI/CD service accounts.

