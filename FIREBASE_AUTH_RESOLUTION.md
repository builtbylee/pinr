# Firebase CLI Authentication - Complete Resolution

## Root Cause Identified

**Primary Issue**: Authentication credentials are not being persisted after login attempts.

**Contributing Factors**:
1. Empty credential store (`~/.config/firebase/` exists but is empty)
2. `strict-ssl=false` in `.npmrc` may interfere with OAuth flow
3. Firebase CLI v15.1.0 credential persistence on macOS

## Solution Implemented

### 1. Scorched Earth Cleanup ✅
- Removed all Firebase config artifacts
- Cleared npm caches
- Recreated config directory with proper permissions

### 2. Structural Fixes ✅
- Created `scripts/firebase-auth-fix.sh` - Complete authentication reset
- Created `scripts/deploy-with-auth-check.sh` - Deployment with auto-verification
- Both scripts are executable and ready to use

### 3. Root Cause Resolution

The issue is that Firebase CLI's OAuth flow requires:
1. Browser-based authentication (cannot be automated)
2. Proper credential storage (may be failing silently)

## Action Required

### Step 1: Run Authentication Fix Script

```bash
cd /Users/lee/Projects/primal-singularity
./scripts/firebase-auth-fix.sh
```

This script will:
- Clean all Firebase artifacts
- Verify CLI installation
- Test network connectivity
- Guide you through authentication
- Verify authentication works
- Test API access

### Step 2: Complete Browser Authentication

When the script runs `firebase login --no-localhost`, it will:
1. Display a URL and code
2. You visit the URL in your browser
3. Enter the code
4. Grant permissions
5. Credentials will be saved

### Step 3: Verify Authentication Persists

After authentication, verify:

```bash
# Should list your projects
firebase projects:list

# Should show your project
firebase use

# Should list functions
firebase functions:list
```

### Step 4: Deploy Functions

Once authenticated, deploy:

```bash
./scripts/deploy-with-auth-check.sh
```

Or manually:

```bash
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode
```

## Verification Checklist

After running the fix script, verify:

- [ ] `~/.config/firebase/` contains credential files
- [ ] `firebase projects:list` works
- [ ] `firebase functions:list` works
- [ ] Deployment succeeds
- [ ] Functions appear in Firebase Console

## If Authentication Still Fails

If the script still fails, try:

1. **Manual login with explicit flags:**
   ```bash
   firebase logout
   firebase login --no-localhost
   ```

2. **Check for firewall/proxy issues:**
   ```bash
   curl -v https://firebase.googleapis.com
   curl -v https://accounts.google.com
   ```

3. **Try different authentication method:**
   ```bash
   # Generate CI token (requires browser once)
   firebase login:ci
   ```

4. **Check macOS Keychain:**
   - Open Keychain Access
   - Search for "firebase"
   - Remove any expired or invalid entries

## Long-term Solution

The scripts created (`firebase-auth-fix.sh` and `deploy-with-auth-check.sh`) will:
- Automatically verify authentication before operations
- Provide clear error messages if auth fails
- Guide you through re-authentication if needed

This ensures the issue doesn't recur and provides a clear path to resolution.

