# How to View Logs for Debugging (Expo Project)

## Quick Start

**For Expo projects, logs appear in the Metro bundler terminal!**

When you run `npx expo run:ios`, **that same terminal** will show all your `console.log()` output.

## Where Logs Appear

### Option 1: Metro Bundler Terminal (BEST - Shows console.log)
**This is the terminal where you ran `npx expo run:ios`**

This terminal shows:
- ✅ All `console.log()` statements
- ✅ JavaScript errors
- ✅ Metro bundler output
- ✅ All the debugging logs we added

**Look for logs prefixed with:**
- `[AuthScreen]` - Login screen actions
- `[AuthService]` - Authentication service
- `[Layout]` - App layout and navigation
- `[UserService]` - User profile operations
- `[Firebase]` - Firebase operations

### Option 2: Xcode Console
1. Open the project in Xcode:
   ```bash
   open ios/Pinr.xcworkspace
   ```
2. Run the app from Xcode (click the Play button)
3. View logs in the bottom console panel

This shows:
- Native iOS logs
- Crash reports
- System-level errors

### Option 3: Check Log Files
If you ran the build with logging enabled:
```bash
tail -f ios_debug_logging.log
```

Or filter for specific logs:
```bash
tail -f ios_debug_logging.log | grep -E "(Auth|Layout|UserService|Firebase|Firestore|ERROR|WARN)"
```

## What to Look For

When testing login, you should see logs like:

```
[AuthScreen] ========== LOGIN ATTEMPT START ==========
[AuthService] ========== signInEmailPassword START ==========
[AuthService] ✅ Sign-in succeeded
[Layout] ========== AUTH STATE CHANGED ==========
[Layout] ✅ User authenticated, setting session
```

If you see errors, look for:
- `❌` - Errors
- `⚠️` - Warnings
- `ERROR` - Error messages
- Stack traces

## Current Issue: Firestore Timeout

The error you're seeing:
```
[UserService] ⚠️ Profile subscription timeout after 15s - no callback received
```

This means Firestore `onSnapshot` is not receiving callbacks. Check logs for:
1. Does `waitForFirestore()` complete?
2. Does `get()` succeed?
3. Does `onSnapshot()` get called?
4. Any error codes (like `permission-denied`)?

## Tips

1. **Keep Metro terminal open** - This is where most logs appear
2. **Scroll up** - Logs might be above the current view
3. **Look for the markers** - `==========` markers show start/end of operations
4. **Check timestamps** - Logs show when things happen

## Quick Commands

```bash
# Navigate to project
cd /Users/lee/Projects/primal-singularity

# View log file (if it exists)
tail -f ios_debug_logging.log

# Filter logs
tail -f ios_debug_logging.log | grep -E "(Auth|ERROR)"

# Open in Xcode
open ios/Pinr.xcworkspace
```
