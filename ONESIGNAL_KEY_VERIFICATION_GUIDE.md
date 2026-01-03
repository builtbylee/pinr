# OneSignal REST API Key Verification Guide

## Quick Verification Methods

### Method 1: Run the Verification Script (Recommended)

```bash
node scripts/verify-onesignal-key.js
```

This script will:
- ✅ Check if the key exists in your `.env` file
- ✅ Verify the key format
- ✅ Test the key against OneSignal's API
- ✅ Show you exactly what's wrong if there are issues

---

### Method 2: Check App Logs

When you start your app, you should now see logs like:

```
[NotificationService] OneSignal REST API Key loaded: os_v2_app_...xyz (length: 123)
[App] OneSignal Config Check: {
  appId: '5998e50e-ec2e-49fa-9d3f-9639168487ac',
  restApiKeyLoaded: true,
  restApiKeyLength: 123,
  restApiKeyPreview: 'os_v2_app_...xyz'
}
```

**If you see:**
- ❌ `CRITICAL: EXPO_PUBLIC_ONESIGNAL_REST_API_KEY environment variable is not set!` → Key is missing
- ⚠️ `WARNING: REST API Key format looks unusual` → Key format might be wrong
- ✅ Key loaded with proper length → Key is present (but might still be wrong)

---

### Method 3: Manual Check

1. **Check your `.env` file** (in project root):
   ```bash
   cat .env | grep ONESIGNAL
   ```
   
   Should show:
   ```
   EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=os_v2_app_...your_key_here...
   ```

2. **Verify the key format:**
   - Should start with `os_` (newer format) OR be a long alphanumeric string
   - Should be 50+ characters long
   - Should NOT contain spaces
   - Should NOT be a placeholder like `YOUR_ONESIGNAL_REST_API_KEY`

---

## How to Get Your OneSignal REST API Key

### Step 1: Log in to OneSignal
1. Go to https://onesignal.com/
2. Log in to your account

### Step 2: Navigate to Keys & IDs
1. Select your app (App ID: `5998e50e-ec2e-49fa-9d3f-9639168487ac`)
2. Go to **Settings** → **Keys & IDs**
3. Find the **"REST API Key"** section

### Step 3: Copy the Key
- The REST API Key will either:
  - Start with `os_` (newer format)
  - OR be a long alphanumeric string (50+ characters)

### Step 4: Add to `.env` File
```bash
# In your project root .env file
EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=os_v2_app_your_actual_key_here
```

**Important:** 
- No quotes around the value
- No spaces
- The entire key on one line

### Step 5: Restart Expo
```bash
# Stop your current Expo server (Ctrl+C)
# Then restart with cache clear
npx expo start --clear
```

---

## For EAS Builds (Production)

Your `eas.json` shows you're using EAS secrets:
```json
"EXPO_PUBLIC_ONESIGNAL_REST_API_KEY": "@ONESIGNAL_REST_API_KEY"
```

This means for **EAS cloud builds**, you need to set the secret:

```bash
eas secret:create --scope project --name ONESIGNAL_REST_API_KEY --value your_onesignal_rest_api_key
```

**To verify EAS secrets are set:**
```bash
eas secret:list
```

Should show `ONESIGNAL_REST_API_KEY` in the list.

---

## Common Issues & Solutions

### Issue 1: Key Not Found in Logs
**Symptom:** `CRITICAL: EXPO_PUBLIC_ONESIGNAL_REST_API_KEY environment variable is not set!`

**Solutions:**
1. Check `.env` file exists in project root
2. Check the variable name is exactly: `EXPO_PUBLIC_ONESIGNAL_REST_API_KEY`
3. Restart Expo with `--clear` flag
4. For EAS builds, ensure secret is set: `eas secret:list`

---

### Issue 2: Key Format Warning
**Symptom:** `WARNING: REST API Key format looks unusual`

**Solutions:**
1. Verify you copied the **REST API Key**, not the App ID
2. Check the key doesn't have extra spaces or quotes
3. Make sure it's the full key (50+ characters)

---

### Issue 3: API Returns 401 Unauthorized
**Symptom:** OneSignal API returns 401 when sending notifications

**Solutions:**
1. The key is wrong or expired
2. Get a fresh key from OneSignal dashboard
3. Make sure you're using the **REST API Key**, not the App ID or User Auth Key

---

### Issue 4: Key Works Locally But Not in EAS Build
**Symptom:** Notifications work in dev but fail in production builds

**Solutions:**
1. Set the EAS secret:
   ```bash
   eas secret:create --scope project --name ONESIGNAL_REST_API_KEY --value your_key
   ```
2. Verify in `eas.json` it's referenced as `@ONESIGNAL_REST_API_KEY`
3. Rebuild your app

---

## Testing the Key

### Test 1: Use the Verification Script
```bash
node scripts/verify-onesignal-key.js
```

### Test 2: Test in App
1. Start your app
2. Check logs for the config check output
3. Try sending a test notification (game invite or new pin)
4. Check logs for:
   - `OneSignal Response Status: 200` ✅
   - `recipients: 1` or more ✅
   - If `recipients: 0`, the external_id might not be set (different issue)

### Test 3: Manual API Test
```bash
curl -X GET "https://onesignal.com/api/v1/players?app_id=5998e50e-ec2e-49fa-9d3f-9639168487ac" \
  -H "Authorization: Basic YOUR_REST_API_KEY" \
  -H "Content-Type: application/json"
```

If you get a 200 response, the key is valid.

---

## Quick Checklist

- [ ] `.env` file exists in project root
- [ ] `EXPO_PUBLIC_ONESIGNAL_REST_API_KEY=...` is in `.env`
- [ ] Key is 50+ characters long
- [ ] Key starts with `os_` OR is a long alphanumeric string
- [ ] No quotes around the key value in `.env`
- [ ] Restarted Expo with `npx expo start --clear`
- [ ] App logs show key is loaded (check console)
- [ ] For EAS builds: Secret is set (`eas secret:list`)
- [ ] Test notification shows `recipients: 1` or more in logs

---

## Still Not Working?

If the key is verified but notifications still don't work:

1. **Check external_id is set:**
   - OneSignal dashboard → Users → Search by external_id (Firebase UID)
   - Verify the user exists and has push subscription

2. **Check notification settings:**
   - User's `notificationSettings.globalEnabled === true`
   - Specific notification type is enabled (e.g., `gameInvites`, `friendsPins`)

3. **Check device permissions:**
   - User has granted push notification permissions
   - Device has valid push token

4. **Check logs for specific errors:**
   - Look for HTTP status codes (401 = bad key, 400 = bad payload, etc.)
   - Look for `recipients: 0` (user not found or not subscribed)

---

*Last updated: 2025-01-27*








