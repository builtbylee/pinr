# Firebase Functions Deployment Instructions

## Important: Firebase Console Cannot Deploy Functions

The Firebase Console **does not** have a "Deploy function" button. Functions can only be deployed via:
- Firebase CLI (command line)
- CI/CD pipelines
- Google Cloud Console (complex setup)

## Current Issue

Firebase CLI authentication is failing due to network connectivity to `https://auth.firebase.tools/attest`.

## Solution: Use CI Token Authentication

This method requires **one-time browser authentication** but then generates a token for future use.

### Step 1: Generate CI Token

Run this command in your terminal:

```bash
firebase login:ci
```

This will:
1. Open your browser (or show URL/code)
2. Ask you to sign in with Google
3. Generate a token that you can use for deployments

**If this also fails with the same network error**, try:
- Different network (mobile hotspot)
- VPN connection
- Check firewall settings

### Step 2: Deploy with Token

Once you have the token, set it and deploy:

```bash
export FIREBASE_TOKEN=your-token-here
./scripts/deploy-with-token.sh
```

Or manually:

```bash
FIREBASE_TOKEN=your-token-here firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4
```

## Alternative: Manual Deployment Script

If `firebase login:ci` works, you can also use:

```bash
# After getting token
export FIREBASE_TOKEN=your-token-here
cd functions
npm run build
cd ..
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --token $FIREBASE_TOKEN
```

## Network Troubleshooting

If authentication keeps failing:

1. **Test connectivity:**
   ```bash
   curl -v https://auth.firebase.tools/attest
   curl -v https://firebase.googleapis.com
   ```

2. **Check for proxy/firewall:**
   ```bash
   env | grep -i proxy
   ```

3. **Try different network:**
   - Mobile hotspot
   - Different WiFi
   - VPN

4. **Check macOS firewall:**
   - System Settings → Network → Firewall
   - Ensure Firebase/Google services are allowed

## Verification

After successful deployment, check:
- https://console.firebase.google.com/project/days-c4ad4/functions
- You should see `getAppleAuthUrl` and `exchangeAppleAuthCode` in the list

## Current Status

- ✅ Functions code ready
- ✅ Functions built (`functions/lib/` exists)
- ✅ Deployment script ready
- ⏳ Waiting for successful authentication to deploy
