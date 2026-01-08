# Quick Deployment Instructions

## Problem
Your GitHub PAT doesn't have `workflow` scope, so workflow files can't be pushed via CLI.

## Solution: Create Workflow in GitHub UI

### Step 1: Create the workflow file

1. Go to: https://github.com/builtbylee/pinr
2. Click **"Add file"** → **"Create new file"**
3. Path: `.github/workflows/deploy-functions-simple.yml`
4. Copy the content from `WORKFLOW_FILE_CONTENT.md`
5. Click **"Commit new file"**

### Step 2: Trigger deployment

1. Go to: **Actions** tab
2. Click **"Deploy Firebase Functions"**
3. Click **"Run workflow"**
4. Select branch: `main` (or your branch)
5. Click **"Run workflow"**

### Step 3: Monitor

- Watch the workflow run in real-time
- Wait for completion (2-3 minutes)
- Check Firebase Console to verify functions deployed

## That's it!

The workflow will:
- ✅ Build your functions
- ✅ Authenticate with Firebase (using your secret)
- ✅ Deploy `getAppleAuthUrl` and `exchangeAppleAuthCode`

## Future Deployments

After the workflow is created, it will:
- Run automatically when you push to `functions/` on `main`
- Or you can trigger it manually anytime

