# Fix Firebase Extensions Permission Error

## New Error
```
Error: Request to https://firebaseextensions.googleapis.com/v1beta/projects/days-c4ad4/instances?pageSize=100&pageToken= had HTTP Error: 403, The caller does not have permission
```

## Progress! ✅
We got past the Service Account User issue! Now we need to grant Firebase Extensions permissions.

## Solution: Grant Additional Roles

### Option 1: Grant Firebase Admin Role (Recommended)

1. **Go to IAM Console:**
   - https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4

2. **Find your service account:**
   - `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com`

3. **Add these roles:**
   - **Firebase Admin** (`roles/firebase.admin`)
   - OR **Firebase Extensions Admin** (`roles/firebaseextensions.admin`)

### Option 2: Skip Extensions Check (Faster)

I've updated the workflow to use `--force` flag which may skip the extensions check. Try running the workflow again first.

### Option 3: Grant Specific Permissions

If you prefer minimal permissions, grant:
- `firebaseextensions.instances.list` permission
- `firebaseextensions.instances.get` permission

## Quick Fix Steps

1. **Go to:** https://console.cloud.google.com/iam-admin/iam?project=days-c4ad4
2. **Find:** `firebase-adminsdk-fbsvc@days-c4ad4.iam.gserviceaccount.com`
3. **Click Edit (pencil icon)**
4. **Add Role:** `Firebase Admin` or `Firebase Extensions Admin`
5. **Save**
6. **Wait 30-60 seconds**
7. **Re-run the workflow**

## Why This Happens

Firebase CLI checks for installed extensions before deploying, which requires the Extensions API permission.

