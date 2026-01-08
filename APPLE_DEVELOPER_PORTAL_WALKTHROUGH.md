# Apple Developer Portal Setup - Step-by-Step Walkthrough

This guide walks you through setting up Apple Sign-In for Android in the Apple Developer Portal.

## Prerequisites

- Active Apple Developer Program membership ($99/year)
- Access to [developer.apple.com](https://developer.apple.com)
- Your app's bundle identifier: `com.builtbylee.app80days`

---

## Step 1: Access Apple Developer Portal

1. Go to [https://developer.apple.com/account](https://developer.apple.com/account)
2. Sign in with your Apple Developer account
3. Click on **"Certificates, Identifiers & Profiles"** in the left sidebar

---

## Step 2: Create a Service ID

### 2.1 Navigate to Service IDs

1. In the left sidebar, click **"Identifiers"**
2. Click the **"+"** button in the top right corner (or click **"Register a new identifier"**)

### 2.2 Select Service ID Type

1. You'll see a list of identifier types
2. Select **"Services IDs"** (it has an icon that looks like a gear/cog)
3. Click **"Continue"**

### 2.3 Register the Service ID

1. **Description**: Enter a descriptive name
   - Example: `Pinr Android Apple Sign-In`
   - This is just for your reference

2. **Identifier**: Enter your Service ID
   - **IMPORTANT**: This must be unique and follow reverse domain notation
   - Example: `com.builtbylee.app80days.service`
   - **Note this down** - you'll need it for Firebase configuration

3. Click **"Continue"**

4. Review the information and click **"Register"**

---

## Step 3: Configure Service ID for Sign in with Apple

### 3.1 Select Your Service ID

1. Go back to **"Identifiers"** → **"Services IDs"**
2. Find and click on the Service ID you just created (`com.builtbylee.app80days.service`)

### 3.2 Enable Sign in with Apple

1. Check the box next to **"Sign in with Apple"**
2. Click the **"Configure"** button that appears

### 3.3 Configure Sign in with Apple

You'll see a configuration screen with several fields:

#### Primary App ID
1. Click the dropdown under **"Primary App ID"**
2. Select your iOS app's App ID: `com.builtbylee.app80days`
   - If you don't see it, you may need to create it first (see Step 4 below)
   - The App ID should already exist if you've built the iOS app

#### Domains and Subdomains
1. Click **"Add Domain"** (or enter directly in the field)
2. **IMPORTANT**: Enter your domain WITHOUT `https://` or `www`
   - ✅ Correct: `getpinr.com`
   - ✅ Correct: `builtbylee.github.io`
   - ❌ Wrong: `https://getpinr.com` (will show error)
   - ❌ Wrong: `www.getpinr.com` (unless you specifically need www)
3. Click **"Add"** (or the domain will be added automatically)

#### Return URLs
1. Click **"Add Return URL"** (or enter directly in the field)
2. **IMPORTANT**: For Service IDs, Apple only accepts HTTPS URLs (not custom URL schemes)
   - ✅ Correct: `https://getpinr.com/auth/apple/callback`
   - ❌ Wrong: `pinr://auth/apple/callback` (custom schemes not allowed for Service IDs)
3. Enter only the HTTPS callback URL:
   - `https://getpinr.com/auth/apple/callback`
   - Replace `getpinr.com` with your actual domain
4. Click **"Add"** (or it will be added automatically)
5. **Note**: Custom URL schemes like `pinr://` are for native iOS apps, not Service IDs. For Android/web flows, use HTTPS only.

#### Save Configuration
1. Review all the information
2. Click **"Save"** in the top right
3. Click **"Continue"** on the next screen
4. Click **"Done"**

---

## Step 4: Verify/Create Your App ID (if needed)

If you couldn't find your App ID in Step 3.3, you need to create it:

### 4.1 Create App ID

1. Go to **"Identifiers"** → **"App IDs"**
2. Click **"+"** to create a new App ID
3. Select **"App"** and click **"Continue"**
4. Fill in:
   - **Description**: `Pinr iOS App`
   - **Bundle ID**: Select **"Explicit"** and enter `com.builtbylee.app80days`
5. Under **"Capabilities"**, check:
   - **"Sign in with Apple"** (if not already checked)
6. Click **"Continue"** and **"Register"**

---

## Step 5: Create a Private Key

### 5.1 Navigate to Keys

1. In the left sidebar, click **"Keys"**
2. Click **"+"** in the top right (or **"Create a key"**)

### 5.2 Configure the Key

1. **Key Name**: Enter a descriptive name
   - Example: `Apple SignIn Key for Android` (no hyphens or special characters)
   - **Note**: Key names cannot include symbols like `-`, `@`, `&`, etc.
   - This is just for your reference and doesn't affect functionality

2. **Enable Services**: Check the box for **"Sign in with Apple"**

3. Click **"Configure"** next to "Sign in with Apple"

### 5.3 Configure Sign in with Apple for Key

1. **Primary App ID**: Select your App ID from the dropdown
   - Should be: `com.builtbylee.app80days`

2. Click **"Save"**

3. Click **"Continue"**

### 5.4 Register and Download Key

1. Review the information
2. Click **"Register"**

**⚠️ CRITICAL: Download the Key File**

1. You'll see a screen with a **"Download"** button
2. **Click "Download"** immediately - you can only download this once!
3. Save the `.p8` file securely (e.g., `AuthKey_XXXXXXXXXX.p8`)
4. **Note the Key ID** displayed on the page (it looks like: `XXXXXXXXXX`)
   - Example: `ABC123DEF4`
   - **Write this down** - you'll need it for Firebase

5. Click **"Done"**

---

## Step 6: Note Your Team ID

1. In the top right corner of the Apple Developer Portal, click on your account name
2. You'll see your **Team ID** (looks like: `XXXXXXXXXX`)
   - Example: `ABC123DEF4`
3. **Write this down** - you'll need it for Firebase configuration

---

## Step 7: Summary of Information You Need

After completing the setup, you should have:

1. **Service ID**: `com.builtbylee.app80days.service`
2. **Team ID**: `XXXXXXXXXX` (from your account)
3. **Key ID**: `XXXXXXXXXX` (from the key you created)
4. **Private Key File**: `AuthKey_XXXXXXXXXX.p8` (downloaded file)
5. **Primary App ID**: `com.builtbylee.app80days`
6. **Return URLs**:
   - `https://getpinr.com/auth/apple/callback` (HTTPS only for Service IDs)

---

## Step 8: Next Steps

Now that you have all the information:

1. **Configure Firebase Console** (see `APPLE_SIGNIN_ANDROID_SETUP.md` Step 2)
   - Use your Service ID, Team ID, Key ID, and upload the `.p8` file

2. **Deploy Cloud Functions** (see `APPLE_SIGNIN_ANDROID_SETUP.md` Step 3)
   - Use the same credentials in your Cloud Functions configuration

---

## Common Issues & Solutions

### Issue: "Service ID already exists"
- **Solution**: Use a different identifier or find the existing one and configure it

### Issue: "App ID not found" when configuring Service ID
- **Solution**: Create the App ID first (Step 4), then come back to configure the Service ID

### Issue: "One or more domains are invalid"
- **Solution**: 
  - The "Domains and Subdomains" field should NOT include `https://` or `www`
  - Enter only the domain name: `getpinr.com` (not `https://getpinr.com`)
  - Return URLs should include the full protocol: `https://getpinr.com/auth/apple/callback`

### Issue: "Invalid return URL format"
- **Solution**: 
  - HTTPS URLs must start with `https://`
  - Deep link URLs must match your app's URL scheme exactly
  - No trailing slashes

### Issue: "Can't download key file"
- **Solution**: If you missed the download, you need to create a new key. The old key file cannot be retrieved.

### Issue: "Key ID not visible"
- **Solution**: The Key ID is shown on the download page. If you closed it, check the Keys list - it should show there too.

---

## Verification Checklist

Before moving to Firebase setup, verify:

- [ ] Service ID created: `com.builtbylee.app80days.service`
- [ ] Service ID has "Sign in with Apple" enabled
- [ ] Service ID is configured with:
  - [ ] Primary App ID selected
  - [ ] Domain added
  - [ ] Return URLs added (both HTTPS and deep link)
- [ ] Private key created and downloaded (`.p8` file)
- [ ] Key ID noted down
- [ ] Team ID noted down
- [ ] All information saved securely

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit the `.p8` file to version control**
   - Add it to `.gitignore`
   - Store it securely (password manager, encrypted storage)

2. **Never share the private key publicly**
   - Keep it confidential
   - Only use it in Firebase Functions configuration (server-side)

3. **The private key cannot be regenerated**
   - If lost, you must create a new key
   - Keep backups in secure locations

---

## Need Help?

If you encounter issues:

1. Check Apple's official documentation: [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)
2. Verify all identifiers match exactly (case-sensitive)
3. Ensure your Apple Developer account is active
4. Check that you have the necessary permissions in your Apple Developer team

---

## Next: Firebase Configuration

Once you've completed this setup, proceed to:
- **Firebase Console Configuration** (Step 2 in `APPLE_SIGNIN_ANDROID_SETUP.md`)
- **Cloud Functions Deployment** (Step 3 in `APPLE_SIGNIN_ANDROID_SETUP.md`)

