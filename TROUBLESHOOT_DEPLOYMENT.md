# Troubleshoot Missing Functions

## Issue
Functions `getAppleAuthUrl` and `exchangeAppleAuthCode` are not showing in Firebase Console.

## Possible Causes

1. **Functions deployed to different codebase**
2. **Function names don't match**
3. **Deployment actually failed (despite success message)**
4. **Functions are in a different region**
5. **Need to refresh the console**

## Steps to Diagnose

### 1. Check GitHub Actions Logs
- Go to the successful workflow run
- Click on "deploy" job
- Look for the actual deployment output
- Check if it says "Deployed functions: getAppleAuthUrl, exchangeAppleAuthCode"

### 2. Check Function Code
- Verify function names match exactly
- Check if they're exported correctly

### 3. Check Firebase Console Filters
- Make sure no filters are applied
- Check if there's a "codebase" filter
- Try refreshing the page

### 4. Check Different Views
- Try the "Dashboard" view vs "Usage" view
- Check if functions are in a different codebase

## Next Steps

Let me check the deployment logs and function definitions to see what happened.

