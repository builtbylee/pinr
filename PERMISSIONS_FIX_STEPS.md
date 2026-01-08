# Quick Fix: Service Account Permissions

## The Problem
Your service account `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com` doesn't have permission to act as the App Engine service account, which is required for Firebase Functions deployment.

## Quick Fix (2 minutes)

### 1. Open IAM Console
Go to: https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4

### 2. Find Your Service Account
Search for: `firebase-adminsdk-fbsvc`

### 3. Edit Permissions
- Click the **pencil icon** (Edit) next to it
- Click **"ADD ANOTHER ROLE"**
- Type: `Service Account User`
- Select: **"Service Account User"** (roles/iam.serviceAccountUser)
- Click **"SAVE"**

### 4. Also Grant to Default Service Account
While you're there, also grant the same role to:
- `days-c4ad4@appspot.gserviceaccount.com`

### 5. Retry Deployment
1. Wait 30-60 seconds for permissions to propagate
2. Go to GitHub Actions
3. Click **"Re-run jobs"** on the failed workflow
4. It should work! ✅

## Why This Happens

Firebase Functions need to:
1. Create/update function resources
2. Act as the App Engine service account
3. Deploy code to Cloud Functions

The "Service Account User" role allows your service account to impersonate the App Engine service account for deployments.

