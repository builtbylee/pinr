# Native Build Queue

This file tracks optimizations that require a native iOS/Android rebuild (cannot be pushed OTA).

## iOS: Eliminate Black Screen on Launch

**File:** `ios/Pinr/AppDelegate.swift`

**Change:** Set window background color to white immediately when window is created to eliminate black screen flash during native initialization.

**Status:** ✅ Ready for next native build

**Code:**
```swift
window = UIWindow(frame: UIScreen.main.bounds)
// Set window background to white immediately to eliminate black screen flash
// This matches the splash screen background color (#FFFFFF) for seamless transition
// The launch storyboard will show on top, but this ensures no black screen appears
window?.backgroundColor = UIColor.white
```

**When to apply:** Next TestFlight build

**Expected impact:** Eliminates the ~2 second black screen that appears before the splash screen on iOS launch.

---

*Last updated: 2026-01-07*

