# Mobile Notification Fix Report
**Date:** 2025-01-27  
**Issue:** Mobile notifications for game invites and new friend pins/journeys not working

---

## 🔍 Issues Identified

### 1. **OneSignal External ID Alias Not Explicitly Set** ⚠️ CRITICAL
**Location:** `src/services/NotificationService.ts:login()`

**Problem:**
- `OneSignal.login(uid)` was called, but the external_id alias might not have been properly set for REST API targeting
- In React Native OneSignal SDK v5, `login()` should set external_id automatically, but explicit alias setting ensures reliability

**Fix:**
- Added explicit `OneSignal.User.addAlias('external_id', uid)` call with error handling
- Added fallback if `addAlias` is not available (SDK version compatibility)

---

### 2. **Missing HTTP Status Code Validation** ⚠️ HIGH
**Location:** All notification functions (`sendGameInvite`, `notifyNewPin`, `notifyNewStory`, `notifyChallengeComplete`)

**Problem:**
- API calls only checked for `result.errors` but didn't validate HTTP status codes
- Failed API calls (4xx, 5xx) were not properly detected
- No distinction between API errors and network errors

**Fix:**
- Added `response.ok` checks before parsing JSON
- Added HTTP status code logging
- Improved error messages to include status codes

---

### 3. **No Recipient Validation** ⚠️ HIGH
**Location:** All notification functions

**Problem:**
- API calls succeeded but `recipients: 0` was not detected
- This indicates the user wasn't found (external_id not set, not subscribed, etc.)
- Silent failures made debugging impossible

**Fix:**
- Added check for `result.recipients === 0`
- Added warning logs when no recipients found
- Added success logs when recipients > 0

---

### 4. **Insufficient Error Logging** ⚠️ MEDIUM
**Location:** `notifyNewPin`, `notifyNewStory`, `notifyChallengeComplete`

**Problem:**
- Errors were logged but without context (HTTP status, API response)
- No distinction between different failure types
- Silent failures in some cases

**Fix:**
- Added comprehensive error logging with HTTP status codes
- Added API response logging for all calls
- Added recipient count logging for success cases

---

### 5. **Missing API Key Validation** ⚠️ MEDIUM
**Location:** `notifyChallengeComplete`, `notifyNewStory`

**Problem:**
- Some functions didn't check if `ONE_SIGNAL_REST_API_KEY` was configured before making API calls
- Would fail silently or with unclear errors

**Fix:**
- Added API key validation at the start of all notification functions
- Early return with clear error message if key is missing

---

## ✅ Fixes Applied

### 1. Enhanced `login()` Function
```typescript
async login(uid: string) {
    // Login sets user identity
    OneSignal.login(uid);
    
    // Explicitly set external_id alias (with fallback)
    try {
        if (OneSignal.User && OneSignal.User.addAlias) {
            await OneSignal.User.addAlias('external_id', uid);
        }
    } catch (aliasError) {
        // Fallback: login() should have set external_id automatically
    }
}
```

### 2. Enhanced Error Handling in All Notification Functions
- HTTP status code validation
- Recipient count validation
- Comprehensive error logging
- API key validation

### 3. Improved Logging
- Success logs with recipient counts
- Warning logs when recipients = 0
- Error logs with HTTP status codes
- API response logging for debugging

---

## 🧪 Testing Recommendations

### 1. Verify OneSignal Login
- Check logs for `[OneSignal] Login complete for: <uid>`
- Verify external_id is set in OneSignal dashboard

### 2. Test Game Invite Notifications
- Send a game challenge to a friend
- Check logs for:
  - `[ChallengeService] sendGameInvite result`
  - `OneSignal Response Status: 200`
  - `recipients: 1` (or > 0)

### 3. Test Pin Notifications
- Create a new pin
- Check logs for:
  - `[NotificationService] notifyNewPin response status: 200`
  - `recipients: X` where X > 0

### 4. Check for Common Issues
- **No recipients found**: User's external_id not set or user not subscribed
- **HTTP 401**: Invalid REST API key
- **HTTP 400**: Invalid payload format
- **HTTP 404**: App ID not found

---

## 🔧 Additional Debugging Steps

If notifications still don't work after these fixes:

1. **Verify OneSignal Configuration:**
   - Check `EXPO_PUBLIC_ONESIGNAL_APP_ID` matches OneSignal dashboard
   - Check `EXPO_PUBLIC_ONESIGNAL_REST_API_KEY` is valid

2. **Verify User Subscription:**
   - Check OneSignal dashboard → Users → Find user by external_id
   - Verify user has push subscription enabled
   - Check if user has opted out of notifications

3. **Verify External ID:**
   - In OneSignal dashboard, search for user by external_id (Firebase UID)
   - Verify the external_id matches the Firebase UID exactly

4. **Check Notification Settings:**
   - Verify `friendProfile.notificationSettings.globalEnabled === true`
   - Verify specific notification type is enabled (e.g., `gameInvites`, `friendsPins`)

5. **Test API Directly:**
   - Use OneSignal REST API tester or curl to send a test notification
   - Verify the payload format matches what the code sends

---

## 📝 Code Changes Summary

**Files Modified:**
- `src/services/NotificationService.ts`

**Functions Updated:**
1. `login()` - Added explicit external_id alias setting
2. `sendGameInvite()` - Enhanced error handling and validation
3. `notifyChallengeComplete()` - Added error handling and logging
4. `notifyNewPin()` - Enhanced error handling and logging
5. `notifyNewStory()` - Added API key check and enhanced logging

**Lines Changed:** ~80 lines

---

## 🎯 Expected Behavior After Fix

1. **OneSignal Login:**
   - User's external_id is explicitly set when they log in
   - Logs confirm successful login and alias setting

2. **Game Invite Notifications:**
   - Notifications are sent successfully
   - Logs show `recipients: 1` or more
   - Friends receive push notifications

3. **Pin/Story Notifications:**
   - Notifications are sent successfully
   - Logs show recipient counts
   - Friends receive push notifications

4. **Error Handling:**
   - Clear error messages in logs
   - HTTP status codes logged
   - Recipient count validation

---

## ⚠️ Known Limitations

1. **OneSignal SDK Version:**
   - `addAlias` method may not be available in all SDK versions
   - Fallback to `login()` automatic external_id setting is in place

2. **User Subscription:**
   - Users must have push notifications enabled
   - Users must not have opted out
   - Device must have valid push token

3. **Network Issues:**
   - Network failures will still cause notifications to fail
   - No retry logic implemented (consider adding in future)

---

## ✅ Next Steps

1. **Test the fixes** with real devices
2. **Monitor logs** for any remaining issues
3. **Verify in OneSignal dashboard** that external_ids are set correctly
4. **Consider adding retry logic** for failed API calls
5. **Consider adding notification delivery tracking** to Firestore

---

*Report generated after comprehensive code review and fix implementation*

