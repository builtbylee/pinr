# Force Deploy New Functions

## Issue
The functions are in the code but Firebase CLI didn't detect them during deployment. It only updated existing functions.

## Solution: Force Deploy with --force Flag

I've updated the workflow to:
1. Deploy only the two new functions explicitly
2. Use `--force` flag to force creation even if they're not detected

## Update Workflow in GitHub

**In `.github/workflows/deploy-functions-simple.yml`, change line 44 to:**

```yaml
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive --force
```

The `--force` flag will:
- Force deployment even if Firebase CLI doesn't detect changes
- Create new functions explicitly
- Override the "unchanged" detection

## After Updating

1. Save the workflow
2. Re-run the workflow
3. Check logs - it should show:
   - `i  functions: creating Node.js 20 (1st Gen) function getAppleAuthUrl(us-central1)...`
   - `i  functions: creating Node.js 20 (1st Gen) function exchangeAppleAuthCode(us-central1)...`
   - `✔  functions[getAppleAuthUrl(us-central1)]: Successful create operation.`
   - `✔  functions[exchangeAppleAuthCode(us-central1)]: Successful create operation.`

## Why This Works

The `--force` flag bypasses Firebase CLI's change detection and forces deployment of the specified functions, even if they're new or not detected automatically.

