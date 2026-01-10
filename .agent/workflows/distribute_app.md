---
description: How to build and distribute the app for testing (Android APK & iOS)
---

# Distributing the App for Testing

Since your app uses native modules (Mapbox, Firebase, Google Sign-In), standard **Expo Go** will NOT work. You must build a standalone version.

## ⚠️ CRITICAL: Antigravity Agent Build Instructions

**IMPORTANT**: EAS build commands can take 2-5+ minutes to archive and upload. Running them directly WILL crash the agent due to timeouts.

### SAFE Method for EAS Builds (USE THIS)

**Step 1: Start build in background**
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android production
```

**Step 2: Poll for completion (wait 10-15 seconds between checks)**
```bash
cat /tmp/eas-build-status.txt
```

**Step 3: Get build URL when status shows SUBMITTED**
```bash
cat /tmp/eas-build-status.txt | grep expo.dev
```

**Alternative: Use eas build:list to check existing builds**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build:list --platform android --limit 3 --non-interactive
```

### UNSAFE Methods (DO NOT USE)
❌ `eas build --platform android ...` - Will timeout and crash agent
❌ `export VAR=0 && eas build ...` - Same issue
❌ Any direct EAS build command in run_command tool

---

## 🔨 Pre-Build Protocol (ALWAYS RUN BEFORE BUILDING)

### Step 1: TypeScript Check
```bash
cd /Users/lee/Projects/primal-singularity && npx tsc --noEmit 2>&1 | grep -E "(error TS|\.tsx|\.ts)" | head -20
```
- ✅ OK if only sandbox/test file errors
- ❌ STOP if core app files have errors

### Step 2: Verify Assets
```bash
cd /Users/lee/Projects/primal-singularity && file assets/images/icon.png assets/images/android-icon-foreground.png assets/images/splash-icon.png
```
- ✅ Must show: `PNG image data, 1024 x 1024, 8-bit/color RGBA`
- ❌ STOP if "cannot open" or wrong format

### Step 3: Check app.json Config
```bash
cd /Users/lee/Projects/primal-singularity && cat app.json | grep -E "(icon|splash|adaptive|version)" | head -10
```
- Verify paths point to valid files
- Check version number if needed

---

## 🤖 Android Distribution

### Production Build (Google Play Store)
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android production
```
Then poll status as described above.

### Testing Build (APK for testers)
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android testing
```

### Preview Build (Development APK)
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android preview
```

### Monitor Build Status
```bash
# Check submission status
cat /tmp/eas-build-status.txt

# View detailed log
tail -50 /tmp/eas-build-android-*.log | tail -50

# Check EAS dashboard
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build:list --platform android --limit 3 --non-interactive
```

### Download
Once complete, EAS provides a download link. Share the `.apk` file via WhatsApp, Drive, or Email.

### ⚠️ Note for Testers (Security Warning)
Since this APK is not from the Play Store, testers will see a security warning:
> *"File might be harmful"* or *"Install unknown apps"*

**This is normal.** To install:
1.  Tap **Settings** on the warning dialog.
2.  Enable **"Allow from this source"** (for Chrome/WhatsApp/etc).
3.  Tap **Install**.

---

## 🍎 iOS (iPhone)

### TestFlight Build (Recommended)
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh ios production
```

### Development Build
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh ios development
```

---

## ⚠️ Known Issues & Fixes

| Issue | Fix |
|-------|-----|
| Agent crashes on EAS build | Use `./scripts/eas-build-async.sh` instead |
| Invalid PNG/JPEG assets | Regenerate with transparent backgrounds |
| JDK Version Mismatch | Update `android/build.gradle` |
| Kotlin Version Mismatch | Set explicit `kotlin-gradle-plugin:$kotlinVersion` |
| TLS Certificate Error | Use `NODE_TLS_REJECT_UNAUTHORIZED=0` prefix |
| Build upload timeout | Reduce upload size via `.easignore` |

---

## ⚡ Summary
1. **Run pre-build checks** (TypeScript + Assets)
2. **Start build:** `./scripts/eas-build-async.sh [platform] [profile]`
3. **Poll status:** `cat /tmp/eas-build-status.txt`
4. **Get URL:** Check status file or `eas build:list`
