# Deploy Apple Sign-In Functions via Firebase Console

Since Firebase CLI authentication is experiencing network issues, we'll deploy directly via the Firebase Console.

## Prerequisites

✅ Functions are already built (`functions/lib/` exists)
✅ Service account credentials available
✅ Project: `days-c4ad4`

## Deployment Steps

### Option 1: Firebase Console (Recommended - No CLI Required)

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/project/days-c4ad4/functions

2. **Deploy Functions:**
   - Click "Get started" or "Deploy function"
   - Select "Deploy from source"
   - Choose your repository or upload the `functions` directory
   - Select functions: `getAppleAuthUrl` and `exchangeAppleAuthCode`
   - Click "Deploy"

### Option 2: Fix Network Issue and Use CLI

The error suggests a network connectivity issue with `https://auth.firebase.tools/attest`.

**Try these fixes:**

1. **Check firewall/proxy:**
   ```bash
   # Test connectivity
   curl -v https://auth.firebase.tools/attest
   ```

2. **Try with different network:**
   - Switch to a different network (mobile hotspot, etc.)
   - Some corporate networks block Firebase auth endpoints

3. **Use VPN:**
   - If behind a corporate firewall, try VPN

4. **Try firebase login:ci:**
   ```bash
   firebase login:ci
   ```
   This generates a token that can be used non-interactively.

### Option 3: Use Service Account with gcloud (If Installed)

If you install Google Cloud SDK:

```bash
# Install gcloud (if not installed)
# macOS: brew install google-cloud-sdk

# Authenticate
gcloud auth activate-service-account \
  --key-file=~/Downloads/days-c4ad4-firebase-adminsdk-fbsvc-1c60eaee2a.json

# Set project
gcloud config set project days-c4ad4

# Deploy (requires functions to be in gcloud format)
# This is more complex, so Console is recommended
```

## Verification

After deployment, verify in Firebase Console:
- Go to: https://console.firebase.google.com/project/days-c4ad4/functions
- You should see:
  - ✅ `getAppleAuthUrl`
  - ✅ `exchangeAppleAuthCode`

## Current Status

- ✅ Functions code ready
- ✅ Functions built successfully
- ✅ Service account available
- ❌ Firebase CLI authentication blocked by network issue

## Next Steps

1. **Immediate:** Deploy via Firebase Console (Option 1)
2. **Long-term:** Resolve network issue for CLI authentication

