# GitHub Actions Deployment Setup

## Overview

I've created a GitHub Actions workflow that will automatically deploy your Firebase Functions, bypassing the local network/authentication issues.

## Setup Steps

### 1. Get Firebase Service Account JSON

You already have this file:
- Location: `~/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json`

### 2. Add Secret to GitHub

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Copy the entire contents of `~/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json`
6. Click **Add secret**

### 3. Push the Workflow

The workflow file is already created at:
- `.github/workflows/deploy-functions-simple.yml`

Just commit and push:

```bash
git add .github/workflows/deploy-functions-simple.yml
git commit -m "Add GitHub Actions workflow for Firebase Functions deployment"
git push
```

### 4. Trigger Deployment

**Option A: Automatic (on push to main)**
- Push changes to `functions/` directory
- Workflow runs automatically

**Option B: Manual trigger**
- Go to GitHub → Actions tab
- Select "Deploy Firebase Functions"
- Click "Run workflow"

## How It Works

1. Workflow runs on Ubuntu (no local network issues)
2. Installs Firebase CLI
3. Builds your functions
4. Authenticates using service account (no browser needed)
5. Deploys `getAppleAuthUrl` and `exchangeAppleAuthCode`

## Verification

After deployment, check:
- GitHub Actions tab shows successful run
- Firebase Console shows the functions deployed

## Benefits

✅ No local network issues
✅ No browser authentication needed
✅ Automatic on code changes
✅ Can trigger manually anytime
✅ Uses service account (secure)

