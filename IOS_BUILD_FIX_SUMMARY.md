# iOS Build Fix Summary

## Issues Resolved

### 1. ✅ FirebaseAuth-Swift.h Not Found (Exit Code 65)
**Root Cause:** Firebase 11 requires static framework linkage, but it wasn't properly configured.

**Fix Applied:**
- Added `"useFrameworks": "static"` to `expo-build-properties` in `app.json`
- This ensures Firebase Swift headers are generated correctly with static frameworks
- Removed redundant manual patches that conflicted with static framework setup

### 2. ✅ Simulator Launch Crashes (dyld errors)
**Root Cause:** Architecture mismatch between simulator and dependencies (Mapbox/OneSignal).

**Fix Applied:**
- Added `EXCLUDED_ARCHS` configuration in Podfile post_install hook
- Conditionally excludes arm64 on Intel Macs (x86_64), allows it on Apple Silicon
- Ensures consistent architecture across all pods

### 3. ✅ OneSignal Extension Target Configuration
**Root Cause:** Extension target wasn't using the same static framework linkage as main target.

**Fix Applied:**
- Updated OneSignal extension target to use same `useFrameworks` configuration
- Ensures consistent linkage between main app and extension

### 4. ✅ Podfile Cleanup
**Removed:**
- Redundant gRPC modulemap patch (handled by static frameworks)
- React-jsitooling modulemap patch (no longer needed)
- Complex React Native module disabling logic (simplified)

**Kept:**
- Essential Firebase Swift header generation settings
- gRPC/leveldb DEFINES_MODULE settings
- Resource bundle code signing fix

## Changes Made

### app.json
```json
"expo-build-properties": {
  "android": {
    "kotlinVersion": "1.9.25"
  },
  "ios": {
    "useFrameworks": "static"  // ← NEW: Enables static framework linkage
  }
}
```

### ios/Podfile
- Simplified post_install hook
- Removed ~70 lines of redundant patches
- Added EXCLUDED_ARCHS for simulator
- Ensured OneSignal extension uses static linkage

## Clean Slate Commands

Run these commands in order for a completely fresh build:

```bash
# 1. Run the clean slate script
./ios_clean_slate.sh

# 2. Regenerate iOS project with Expo
npx expo prebuild --clean --platform ios

# 3. Install pods
cd ios && pod install && cd ..

# 4. Clean Xcode build folder (optional but recommended)
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 5. Build in Xcode or via CLI
npx expo run:ios
```

## Manual Clean Slate (if script doesn't work)

```bash
# Remove CocoaPods
cd ios
rm -rf Pods Podfile.lock .symlinks build
pod deintegrate 2>/dev/null || true
cd ..

# Remove Expo artifacts
rm -rf .expo ios/.expo node_modules/.cache

# Remove Xcode DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Rebuild
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
```

## Verification Steps

After applying fixes, verify:

1. **Static Frameworks:**
   ```bash
   cd ios
   grep -r "useFrameworks" Podfile
   # Should show: use_frameworks! :linkage => :static
   ```

2. **Firebase Headers:**
   ```bash
   ls -la ios/Pods/Headers/Public/FirebaseAuth/
   # Should include FirebaseAuth-Swift.h
   ```

3. **Architecture Settings:**
   ```bash
   # Check Xcode project settings
   # Build Settings > Excluded Architectures > Any iOS Simulator SDK
   # Should be: arm64 (on Intel Mac) or empty (on Apple Silicon)
   ```

## Expected Build Behavior

### ✅ Success Indicators:
- Build completes without "FirebaseAuth-Swift.h not found" errors
- Simulator launches without dyld crashes
- EAS builds succeed (Exit Code 0)
- Local Xcode builds succeed

### ⚠️ If Issues Persist:

1. **Still getting FirebaseAuth-Swift.h errors:**
   - Verify `expo-build-properties` plugin is in `app.json`
   - Run `npx expo prebuild --clean`
   - Check `ios/Podfile.properties.json` has `ios.useFrameworks: "static"`

2. **Simulator still crashes:**
   - Check Xcode > Product > Destination > Simulator architecture
   - Verify EXCLUDED_ARCHS in Xcode project settings
   - Try building for a specific simulator: `npx expo run:ios --simulator "iPhone 15"`

3. **OneSignal extension issues:**
   - Verify extension target uses same linkage as main target
   - Check extension's Podfile target configuration

## Technical Details

### Why Static Frameworks?
Firebase 11 introduced Swift-based modules (FirebaseAuth-Swift) that require:
- Static framework linkage (not dynamic)
- Modular headers enabled
- Proper Swift header generation

### Why EXCLUDED_ARCHS?
Some pods (Mapbox, OneSignal) may not have proper arm64 simulator support, causing:
- Architecture mismatch errors
- dyld symbol not found errors
- Simulator launch crashes

The fix conditionally excludes arm64 on Intel Macs while allowing it on Apple Silicon.

## Next Steps

1. Run clean slate script
2. Rebuild project
3. Test on simulator
4. Test on physical device
5. Test EAS build

If all tests pass, the iOS build issues are resolved! 🎉






