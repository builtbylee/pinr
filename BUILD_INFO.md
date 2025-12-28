# Pinr Build Tracking

This file tracks EAS builds for the Pinr app.

## Build Types

| Profile | Output | Purpose |
|---------|--------|---------|
| `preview` | APK | Standalone testing (works without dev server) |
| `testing` | APK | Dev/testing builds |
| `production` | AAB | **Google Play Store submission** |

## Build Commands

### Preview Build (for personal testing)
```bash
eas build --profile preview --platform android
```
Output: `.apk` file - Install directly on device

### Production Build (for store submission)
```bash
eas build --profile production --platform android
```
Output: `.aab` file - **This is the file to upload to Google Play Console**

## Recent Builds

| Date | Profile | Platform | Build ID | Notes |
|------|---------|----------|----------|-------|
| 2024-12-28 | preview | android | `3931d28e-d852-4375-8d8f-95ba800b7939` | ✅ Standalone APK for offline testing |

---

**Remember:** 
- **APK** = Install directly on device for testing
- **AAB** = Upload to Google Play Console for store distribution
