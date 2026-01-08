# Fix: Deploy All Functions

## Problem
The deployment says "Deploy complete!" but doesn't list which functions were deployed, and the new functions aren't showing in the console.

## Solution: Deploy All Functions

I've updated the workflow to deploy **all functions** instead of just the two new ones. This will:
1. Force Firebase CLI to analyze all exports
2. Deploy everything it finds
3. Include the new Apple Sign-In functions

## Update Workflow

**In GitHub, update `.github/workflows/deploy-functions-simple.yml`:**

Change line 44 from:
```yaml
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive
```

To:
```yaml
firebase deploy --only functions --project days-c4ad4 --non-interactive
```

## Why This Works

- Deploying all functions forces Firebase CLI to scan all exports
- It will find and deploy the new functions along with existing ones
- Existing functions won't be affected (they'll just be redeployed)

## After Deployment

1. Re-run the workflow
2. Check the logs - it should list ALL functions being deployed
3. Check Firebase Console - the new functions should appear

## Alternative: Check if Functions Are Callable vs HTTP

The new functions use `functions.https.onCall` (callable), while most existing functions use `functions.https.onRequest` (HTTP). Both should show in console, but callable functions might appear differently.

Let me know when you've updated the workflow and we can re-run it!

