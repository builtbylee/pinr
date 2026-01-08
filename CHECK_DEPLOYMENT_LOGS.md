# Check Deployment Logs

## Issue
Functions are not showing in Firebase Console despite successful workflow.

## Diagnosis Steps

### 1. Check GitHub Actions Deployment Logs

Go to the successful workflow run and check the "Deploy Functions" step output. Look for:

- ✅ "Deployed functions: getAppleAuthUrl, exchangeAppleAuthCode"
- ❌ Any errors or warnings
- ⚠️ Messages about functions not being found

### 2. Possible Issues

**Issue 1: Functions not found during deployment**
- The deploy command might say "Function getAppleAuthUrl not found"
- This means the functions aren't being exported correctly

**Issue 2: Silent failure**
- Deployment succeeds but functions aren't actually deployed
- Check for warnings in logs

**Issue 3: Wrong codebase**
- Functions might be deployed to a different codebase
- Check if there are multiple codebases in firebase.json

### 3. Verify Function Exports

The functions should be exported as:
```typescript
export const getAppleAuthUrl = functions.https.onCall(...)
export const exchangeAppleAuthCode = functions.https.onCall(...)
```

### 4. Try Manual Deployment Check

In the GitHub Actions logs, look for output like:
```
✔  functions[getAppleAuthUrl(us-central1)]: Successful create operation.
✔  functions[exchangeAppleAuthCode(us-central1)]: Successful create operation.
```

If you don't see these messages, the functions weren't deployed.

## Next Steps

Please check the GitHub Actions logs for the "Deploy Functions" step and share:
1. What the output says
2. Any error or warning messages
3. Whether it mentions the function names

This will help us diagnose why they're not showing up.

