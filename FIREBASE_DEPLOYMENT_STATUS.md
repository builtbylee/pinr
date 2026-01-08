# Firebase Functions Deployment Status

## Current Situation

### ✅ Completed
- Functions code written (`getAppleAuthUrl`, `exchangeAppleAuthCode`)
- Functions built successfully (`functions/lib/` exists)
- Service account credentials available
- Apple config file ready (`functions/src/apple-config.ts`)

### ❌ Blocked
- Firebase CLI authentication failing due to network issue
- Error: "Failed to make request to https://auth.firebase.tools/attest"
- This prevents automated deployment via CLI

## Root Cause

The Firebase CLI is unable to connect to `https://auth.firebase.tools/attest` during the authentication flow. This could be due to:
- Firewall/proxy blocking the endpoint
- Network connectivity issues
- Corporate network restrictions

## Solutions

### Immediate Solution: Firebase Console Deployment

**Deploy via Firebase Console (No CLI Required):**

1. Visit: https://console.firebase.google.com/project/days-c4ad4/functions
2. Click "Deploy function" or use "Deploy from source"
3. Upload or connect your `functions` directory
4. Deploy `getAppleAuthUrl` and `exchangeAppleAuthCode`

### Alternative: Fix Network Issue

**Try these steps:**

1. **Test connectivity:**
   ```bash
   curl -v https://auth.firebase.tools/attest
   ```

2. **Try different network:**
   - Switch to mobile hotspot
   - Try different WiFi network
   - Use VPN if behind corporate firewall

3. **Use CI token (one-time browser auth):**
   ```bash
   firebase login:ci
   ```
   This will open browser once, then generate a token for future use.

4. **Check firewall settings:**
   - Ensure `*.firebase.tools` and `*.googleapis.com` are allowed
   - Check if corporate proxy is blocking requests

## Functions Ready to Deploy

Both functions are built and ready:

1. **getAppleAuthUrl**
   - Location: `functions/src/index.ts:1426`
   - Purpose: Generate OAuth URL for Apple Sign-In on Android
   - Type: HTTPS Callable Function

2. **exchangeAppleAuthCode**
   - Location: `functions/src/index.ts:1458`
   - Purpose: Exchange Apple authorization code for ID token
   - Type: HTTPS Callable Function

## Verification After Deployment

Once deployed, verify:

1. Functions appear in Firebase Console
2. Functions are callable from the app
3. Test with Android device using Apple Sign-In

## Next Steps

**Recommended:** Deploy via Firebase Console now, then troubleshoot CLI authentication for future deployments.

