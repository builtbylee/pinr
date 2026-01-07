# How to View Metro Bundler Logs

## Option 1: Find the Metro Terminal Window

Metro is currently running (process ID: 18416). It's likely running in a different terminal window or tab.

**To find it:**
1. Check all your terminal windows/tabs
2. Look for a window showing Metro bundler output
3. It should show messages like "Metro waiting on..." or bundle compilation

## Option 2: Use Device/Simulator Logs

Since Metro logs might not be visible, we can capture logs directly from the simulator:

```bash
./capture_ios_logs.sh
```

This will show real-time logs from the iOS Simulator, filtered for Firestore/UserService messages.

## Option 3: Check Xcode Console

If you opened the project in Xcode:
1. Open Xcode
2. Run the app from Xcode (or it's already running)
3. Check the bottom console panel in Xcode
4. Look for `[Firestore]`, `[UserService]`, `[App]` messages

## Option 4: Restart Metro with Visible Logs

If you want to restart Metro in your current terminal:

1. Find and stop the current Metro process:
   ```bash
   kill 18416
   ```

2. Start Metro in your current terminal:
   ```bash
   npx expo start --dev-client
   ```

3. Then reload the app on the simulator (Cmd+R)

## What to Look For

When you log in, you should see these log messages in order:

1. **Firestore Initialization:**
   - `[FirebaseInit] 🔍 Verifying Firestore connectivity with test query...`
   - `[FirebaseInit] ✅ Firestore connectivity verified`

2. **Profile Subscription:**
   - `[UserService] ========== subscribeToUserProfile START ==========`
   - `[UserService] ✅ Initial fetch completed`
   - `[UserService] 🎉 onSnapshot callback fired!`

3. **Pins Subscription:**
   - `[Firestore] ========== subscribeToPins START ==========`
   - `[Firestore] ✅ Initial fetch completed`
   - `[Firestore] Pins found: X`
   - `[Firestore] 🎉 Pins snapshot callback fired!`

4. **Data Flow:**
   - `[useDataSubscriptions] Pins callback received: X pins`
   - `[App] allPins changed: X pins`
   - `[App] Calling setMemories with X pins`

## Quick Test

Run this to see if logs are being generated:

```bash
./capture_ios_logs.sh
```

Then reload the app on the simulator and try logging in. The logs should appear in real-time.



