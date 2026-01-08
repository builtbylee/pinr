# Apple Sign-In on Android Setup Guide

## Overview

Apple Sign-In on Android requires a web-based OAuth flow since Apple doesn't provide a native Android SDK. This implementation uses Firebase Cloud Functions to handle the OAuth flow securely.

## Prerequisites

1. **Apple Developer Account** (paid membership required)
2. **Firebase Project** with Apple provider enabled
3. **Cloud Functions** deployed (see below)

## Step 1: Apple Developer Portal Setup

### 1.1 Create a Service ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers)
2. Navigate to **Identifiers** → **Service IDs**
3. Click **+** to create a new Service ID
4. Enter:
   - **Description**: `Pinr Android Sign-In` (or your app name)
   - **Identifier**: `com.builtbylee.app80days.service` (or your service ID)
5. Click **Continue** and **Register**

### 1.2 Configure Service ID for Sign in with Apple

1. Select your newly created Service ID
2. Check **Sign in with Apple**
3. Click **Configure**
4. Select your **Primary App ID** (the iOS app ID: `com.builtbylee.app80days`)
5. Add **Domains and Subdomains**:
   - Your app's domain (e.g., `getpinr.com`)
6. Add **Return URLs**:
   - `https://getpinr.com/auth/apple/callback` (or your callback URL)
   - **Note**: For Service IDs, only HTTPS URLs are allowed (no custom URL schemes)
7. Click **Save** and **Continue**

### 1.3 Create a Private Key

1. Go to **Keys** section in Apple Developer Portal
2. Click **+** to create a new key
3. Enter **Key Name**: `Apple SignIn Key for Android` (no hyphens or special characters)
4. Check **Sign in with Apple**
5. Click **Configure** and select your **Primary App ID**
6. Click **Save** and **Continue**
7. Click **Register**
8. **Download the `.p8` key file** (you can only download it once!)
9. **Note the Key ID** (displayed on the page)

## Step 2: Firebase Console Setup

### 2.1 Enable Apple Provider

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Apple** provider
5. Enable it
6. Enter:
   - **Service ID**: `com.builtbylee.app80days.service` (from Step 1.1)
   - **Apple Team ID**: Your Apple Team ID (found in Apple Developer Portal → Membership)
   - **Key ID**: The Key ID from Step 1.3
   - **Private Key**: Upload the `.p8` file from Step 1.3
7. Click **Save**

### 2.2 Configure Authorized Domains

1. In Firebase Console → **Authentication** → **Settings**
2. Under **Authorized domains**, ensure your domain is listed:
   - `getpinr.com` (or your domain)
   - `builtbylee.github.io` (if using GitHub Pages)

## Step 3: Deploy Cloud Functions

You need to create and deploy two Cloud Functions:

### 3.1 Function: `getAppleAuthUrl`

This function generates the OAuth URL for Apple Sign-In.

**File**: `functions/src/index.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export const getAppleAuthUrl = functions.https.onCall(async (data, context) => {
  const nonce = data.nonce;
  if (!nonce) {
    throw new functions.https.HttpsError('invalid-argument', 'Nonce is required');
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state and nonce temporarily (you can use Firestore or Realtime Database)
  // For simplicity, we'll include state in the URL
  
  const clientId = 'com.builtbylee.app80days.service'; // Your Service ID
  const redirectUri = 'https://getpinr.com/auth/apple/callback'; // Your callback URL
  const scope = 'name email';
  
  const authUrl = `https://appleid.apple.com/auth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `response_mode=form_post&` +
    `state=${state}&` +
    `nonce=${nonce}`;

  return { authUrl, state };
});
```

### 3.2 Function: `exchangeAppleAuthCode`

This function exchanges the authorization code for an ID token.

**File**: `functions/src/index.ts` (add to existing file)

```typescript
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

export const exchangeAppleAuthCode = functions.https.onCall(async (data, context) => {
  const { code, nonce, state } = data;
  
  if (!code || !nonce) {
    throw new functions.https.HttpsError('invalid-argument', 'Code and nonce are required');
  }

  // Exchange authorization code for tokens
  // This requires your client secret (JWT signed with your private key)
  // For security, store the private key in Firebase Functions config:
  // firebase functions:config:set apple.private_key="YOUR_PRIVATE_KEY"
  // firebase functions:config:set apple.key_id="YOUR_KEY_ID"
  // firebase functions:config:set apple.team_id="YOUR_TEAM_ID"
  // firebase functions:config:set apple.client_id="com.builtbylee.app80days.service"
  
  const privateKey = functions.config().apple.private_key;
  const keyId = functions.config().apple.key_id;
  const teamId = functions.config().apple.team_id;
  const clientId = functions.config().apple.client_id;
  
  // Generate client secret (JWT)
  const clientSecret = jwt.sign(
    {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: clientId,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
    }
  );

  // Exchange code for tokens
  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://getpinr.com/auth/apple/callback',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new functions.https.HttpsError('internal', `Token exchange failed: ${error}`);
  }

  const tokens = await tokenResponse.json();
  const idToken = tokens.id_token;

  // Verify and decode ID token
  const decoded = jwt.decode(idToken, { complete: true });
  
  // Verify nonce matches
  if (decoded.payload.nonce !== nonce) {
    throw new functions.https.HttpsError('invalid-argument', 'Nonce mismatch');
  }

  // Return ID token and user info
  return {
    identityToken: idToken,
    email: decoded.payload.email || null,
    fullName: decoded.payload.name ? {
      givenName: decoded.payload.name.given_name,
      familyName: decoded.payload.name.family_name,
    } : null,
  };
});
```

### 3.3 Install Required Dependencies

In `functions/package.json`, add:

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "jwks-rsa": "^3.0.0"
  }
}
```

### 3.4 Configure Function Secrets

```bash
# Set your Apple private key (read from .p8 file)
firebase functions:secrets:set APPLE_PRIVATE_KEY

# Set other required values
firebase functions:config:set apple.key_id="YOUR_KEY_ID"
firebase functions:config:set apple.team_id="YOUR_TEAM_ID"
firebase functions:config:set apple.client_id="com.builtbylee.app80days.service"
```

### 3.5 Deploy Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode
```

## Step 4: Update App Configuration

### 4.1 Add Deep Link Handler

In `app.json`, ensure you have the callback URL scheme configured:

```json
{
  "expo": {
    "scheme": "pinr",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "pinr",
              "host": "auth",
              "pathPrefix": "/apple/callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 4.2 Update Deep Link Handler in App

In `app/index.tsx` or your routing file, add handling for the Apple callback:

```typescript
// Handle deep link: pinr://auth/apple/callback?code=...&state=...
useEffect(() => {
  const subscription = Linking.addEventListener('url', (event) => {
    const { url } = event;
    if (url.includes('/auth/apple/callback')) {
      // The WebBrowser will handle this automatically
      // But you may want to add additional handling here
    }
  });

  return () => subscription.remove();
}, []);
```

## Step 5: Test the Implementation

1. **Test on Android device** (not emulator, as it requires browser)
2. Tap "Continue with Apple" button
3. Browser should open with Apple Sign-In page
4. Complete sign-in flow
5. App should receive callback and sign in user

## Troubleshooting

### Error: "Cloud Function did not return OAuth URL"
- Ensure Cloud Functions are deployed
- Check Firebase Console → Functions to verify deployment
- Check function logs for errors

### Error: "No authorization code received"
- Verify redirect URI matches exactly in Apple Developer Portal
- Check that callback URL is properly configured in `app.json`

### Error: "Nonce mismatch"
- Ensure nonce is generated and passed correctly
- Check that nonce is preserved through the OAuth flow

### Browser doesn't open
- Verify `expo-web-browser` is installed
- Check that deep linking is configured correctly

## Security Considerations

1. **Never commit private keys** to version control
2. **Use Firebase Functions config/secrets** for sensitive data
3. **Validate nonce** to prevent replay attacks
4. **Use HTTPS** for all callback URLs
5. **Implement rate limiting** on Cloud Functions

## Alternative: Simplified Approach

If setting up Cloud Functions is too complex, you can:

1. Use a third-party service that handles Apple OAuth
2. Create a simple backend endpoint (Node.js/Express) that handles the OAuth flow
3. Use Firebase Hosting Functions (simpler than Cloud Functions)

## Next Steps

Once setup is complete:
1. Test the flow end-to-end
2. Handle edge cases (user cancels, network errors)
3. Add proper error messages for users
4. Monitor Cloud Function logs for issues

## References

- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Firebase Auth Apple Provider](https://firebase.google.com/docs/auth/android/apple)
- [Expo Web Browser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)

