# Fix: Functions Not Showing in Console

## Quick Checks

### 1. Refresh Firebase Console
- Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
- Functions might take a minute to appear

### 2. Check Codebase Filter
- In Firebase Console, check if there's a "codebase" filter
- Make sure "default" codebase is selected
- Your functions are in the "default" codebase

### 3. Check GitHub Actions Logs
The deployment might have succeeded but functions weren't actually deployed.

**Go to GitHub Actions:**
1. Click on the successful workflow run
2. Click on "deploy" job
3. Expand "Deploy Functions" step
4. Look for messages like:
   - "Deployed functions: getAppleAuthUrl, exchangeAppleAuthCode"
   - Or "Function getAppleAuthUrl not found"

### 4. Verify Function Names Match
The deploy command uses:
- `functions:getAppleAuthUrl`
- `functions:exchangeAppleAuthCode`

Make sure these exact names match the exported function names.

## If Functions Still Don't Appear

The deployment might have silently failed. Let's try:
1. Check the actual deployment logs
2. Redeploy with verbose logging
3. Verify the functions are in the built code

## Action Required

Please check the GitHub Actions "Deploy Functions" step logs and share what it says. This will tell us if:
- Functions were actually deployed
- There was an error we didn't see
- Functions need to be redeployed

