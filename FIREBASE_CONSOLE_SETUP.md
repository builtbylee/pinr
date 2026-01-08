# Firebase Console Setup for Apple Sign-In (Manual Configuration)

Since Firebase CLI isn't working, we'll configure everything through the Firebase Console.

## Step 1: Set Environment Variables in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **80 Days**
3. Navigate to **Functions** in the left sidebar
4. Click on **Configuration** tab
5. Click **"Add secret"** or **"Environment variables"** (depending on your Firebase version)

### Add the following secrets/environment variables:

1. **APPLE_CLIENT_ID**
   - Value: `com.builtbylee.app80days.service`

2. **APPLE_TEAM_ID**
   - Value: `CMBSFLQ5V6`

3. **APPLE_KEY_ID**
   - Value: `8TV72LRP85`

4. **APPLE_REDIRECT_URI**
   - Value: `https://getpinr.com/auth/apple/callback`

5. **APPLE_PRIVATE_KEY**
   - Value: Copy the entire private key from Firebase Console → Authentication → Sign-in method → Apple
   - This should include:
     ```
     -----BEGIN PRIVATE KEY-----
     [your key content]
     -----END PRIVATE KEY-----
     ```

## Step 2: Verify Firebase Console Apple Configuration

1. Go to **Authentication** → **Sign-in method**
2. Click on **Apple** provider
3. Verify:
   - ✅ Service ID: `com.builtbylee.app80days.service`
   - ✅ Apple Team ID: `CMBSFLQ5V6`
   - ✅ Key ID: `8TV72LRP85`
   - ✅ Private Key: (should be filled in)

## Step 3: Install Dependencies

In your terminal, run:

```bash
cd functions
npm install
npm run build
cd ..
```

## Step 4: Deploy Functions

Since we can't use Firebase CLI, you'll need to deploy through one of these methods:

### Option A: Use Firebase Console (if available)
1. Go to Firebase Console → Functions
2. Look for a "Deploy" or "Upload" button
3. Upload the built functions

### Option B: Fix Firebase CLI (recommended)
Try these steps to fix Firebase CLI:

1. **Clear Firebase cache:**
   ```bash
   rm -rf ~/.config/firebase
   ```

2. **Reinstall Firebase CLI:**
   ```bash
   npm uninstall -g firebase-tools
   npm install -g firebase-tools
   ```

3. **Try login again:**
   ```bash
   firebase login
   ```

4. **If still failing, try:**
   ```bash
   firebase logout
   firebase login --no-localhost
   ```

### Option C: Use GitHub Actions or CI/CD
If you have CI/CD set up, you can deploy through that.

## Step 5: Test the Functions

Once deployed, test the functions:

1. Go to Firebase Console → Functions
2. Find `getAppleAuthUrl` and `exchangeAppleAuthCode`
3. Test them using the Firebase Console test interface

## Alternative: Hardcode Values (Temporary)

If setting environment variables through Console doesn't work, we can temporarily hardcode the values in the code (not recommended for production, but works for testing):

Update `functions/src/index.ts` to use hardcoded values:

```typescript
const teamId = 'CMBSFLQ5V6';
const keyId = '8TV72LRP85';
const clientId = 'com.builtbylee.app80days.service';
const redirectUri = 'https://getpinr.com/auth/apple/callback';
const privateKey = `-----BEGIN PRIVATE KEY-----
[paste your private key here]
-----END PRIVATE KEY-----`;
```

**⚠️ Warning:** Never commit hardcoded private keys to version control! Use `.gitignore` to exclude the file or use environment variables.

## Next Steps

Once the functions are deployed:
1. Test Apple Sign-In on Android device
2. Verify the OAuth flow works
3. Check function logs for any errors

