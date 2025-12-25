---
description: How to build and distribute the app for testing (Android APK & iOS)
---

# Distributing the App for Testing

Since your app uses native modules (Mapbox, Firebase, Google Sign-In), standard **Expo Go** will NOT work. You must build a standalone version.

## 🔨 Pre-Build Protocol (ALWAYS RUN BEFORE BUILDING)

### Step 1: TypeScript Check
```bash
npx tsc --noEmit 2>&1 | grep -E "(error TS|\.tsx|\.ts)" | head -20
```
- ✅ OK if only sandbox/test file errors
- ❌ STOP if core app files have errors

### Step 2: Verify Assets
```bash
file assets/images/icon.png assets/images/android-icon-foreground.png assets/images/splash-icon.png
```
- ✅ Must show: `PNG image data, 1024 x 1024, 8-bit/color RGBA`
- ❌ STOP if "cannot open" or wrong format

### Step 3: Check app.json Config
```bash
cat app.json | grep -E "(icon|splash|adaptive|version)" | head -10
```
- Verify paths point to valid files
- Check version number if needed

---

## 🤖 Android (APK) Build

// turbo
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build -p android --profile preview --non-interactive
```

### Monitor Build
- Watch for build ID in output
- Check EAS Dashboard if issues: https://expo.dev/accounts/hackneymanlee/projects/80days/builds

### Download
Once complete, EAS provides a download link. Share the `.apk` file via WhatsApp, Drive, or Email.

---

## 🍎 iOS (iPhone)

### Option A: TestFlight (Recommended)
*Requires Apple Developer Program ($99/year)*
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build -p ios --profile preview --non-interactive
```
Then upload to App Store Connect and invite testers.

### Option B: Ad-Hoc / Development
*Requires registering device UDIDs*
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build --profile development --platform ios --non-interactive
```

---

## ⚠️ Known Issues & Fixes

| Issue | Fix |
|-------|-----|
| Invalid PNG/JPEG assets | Regenerate with transparent backgrounds |
| JDK Version Mismatch | Update `android/build.gradle` |
| Kotlin Version Mismatch | Set explicit `kotlin-gradle-plugin:$kotlinVersion` |
| TLS Certificate Error | Use `NODE_TLS_REJECT_UNAUTHORIZED=0` prefix |

---

## ⚡ Summary
1. **Run pre-build checks** (TypeScript + Assets)
2. **Android:** `eas build -p android --profile preview`
3. **iOS:** `eas build -p ios --profile preview` + TestFlight
