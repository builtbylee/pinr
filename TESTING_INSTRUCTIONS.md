# Testing Instructions for Firestore Subscription Fix

## Current Situation

- ✅ Code fixes have been implemented
- ✅ Build completed successfully for iOS Simulator
- ⚠️ Metro bundler is running but logs are in a different terminal (ttys007)
- ❌ Fix has NOT been tested yet

## How to Test

### Step 1: View Logs

**Option A: Find Metro Terminal**
- Look for a terminal window/tab showing Metro bundler output
- It should show messages like "Metro waiting on..." or bundle compilation

**Option B: Restart Metro in Current Terminal**
```bash
./view_metro_output.sh
```
Choose 'y' to restart Metro here so you can see logs

**Option C: Use Xcode Console**
1. Open Xcode: `open ios/Pinr.xcworkspace`
2. Run the app from Xcode (or it's already running)
3. Check the bottom console panel for JavaScript logs

### Step 2: Test the App

1. **Reload the app** on simulator:
   - Press `Cmd+R` in simulator, or
   - Shake device → "Reload"

2. **Sign out** if logged in:
   - This tests the "Unknown profile" sign-out fix

3. **Log in** with your credentials:
   - Email + Password, or
   - Google Sign-In

4. **Watch the logs** for these messages:

#### Expected Success Logs:

**Firestore Initialization:**
```
[FirebaseInit] 🔍 Verifying Firestore connectivity with test query...
[FirebaseInit] ✅ Firestore connectivity verified (XXXms)
[FirebaseInit] ✅ Firestore is ready and connected
```

**Profile Subscription:**
```
[UserService] ========== subscribeToUserProfile START ==========
[UserService] Waiting for Firestore to be ready and connected...
[UserService] ✅ Firestore ready and connected
[UserService] Fetching initial profile data...
[UserService] ✅ Initial fetch completed
[UserService] ✅ Initial profile loaded: [your-username]
[UserService] Setting up real-time subscription...
[UserService] 🎉 onSnapshot callback fired!
[UserService] ✅ Profile update received: [your-username]
```

**Pins Subscription:**
```
[Firestore] ========== subscribeToPins START ==========
[Firestore] Waiting for Firestore to be ready and connected...
[Firestore] ✅ Firestore ready and connected
[Firestore] Fetching initial pins data...
[Firestore] ✅ Initial fetch completed
[Firestore] Pins found: X
[Firestore] Setting up real-time subscription...
[Firestore] 🎉 Pins snapshot callback fired!
[Firestore] Pins count: X
[useDataSubscriptions] Pins callback received: X pins
[App] allPins changed: X pins
[App] Calling setMemories with X pins
```

### Step 3: Verify Results

**✅ Success Indicators:**
- Profile loads with your username (not "Unknown")
- Pin count shows correct number (not 0 if you have pins)
- Pins appear on the map
- No 15-second timeout warnings
- No REST fallback messages

**❌ Failure Indicators:**
- Profile shows "Unknown"
- Pin count is 0 when you have pins
- No pins on map
- Timeout warnings after 15 seconds
- REST fallback messages
- Errors in logs

## What to Report

If it's not working, please share:
1. The log messages you see (especially errors)
2. What happens when you log in
3. Whether profile loads correctly
4. Whether pins appear

## Quick Test Script

Run this to see logs in real-time:
```bash
./capture_ios_logs.sh
```

Then reload the app and log in. The logs should show what's happening.

