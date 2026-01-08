# Fix Service Account Permissions

## Error
```
Missing permissions required for functions deploy. 
You must have permission `iam.serviceAccounts.ActAs` on service account 
`days-c4ad4@appspot.gserviceaccount.com`.
```

## Solution: Grant Service Account User Role

### Step 1: Go to IAM & Admin

Click this link (from the error message):
https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4

### Step 2: Find Your Service Account

1. Look for: `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com`
2. This is the service account from your secret

### Step 3: Grant Permissions

1. **Click the pencil icon** (Edit) next to the service account
2. **Click "ADD ANOTHER ROLE"**
3. **Select:** `Service Account User` (or `roles/iam.serviceAccountUser`)
4. **Click "SAVE"**

### Step 4: Alternative - Grant to Default Service Account

If you can't find the service account, also grant the role to:
- `days-c4ad4@appspot.gserviceaccount.com` (the default App Engine service account)

### Step 5: Wait and Retry

1. Wait 1-2 minutes for permissions to propagate
2. Go back to GitHub Actions
3. Click "Re-run jobs" on the failed workflow
4. It should work now!

## Required Roles for Firebase Functions Deployment

The service account needs:
- ✅ **Service Account User** (`roles/iam.serviceAccountUser`)
- ✅ **Cloud Functions Developer** (`roles/cloudfunctions.developer`)
- ✅ **Service Account Token Creator** (if needed)

## Quick Fix URL

Direct link to grant permissions:
https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4

