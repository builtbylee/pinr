# Project Rules & Context

## 1. Deployment Protocol (CRITICAL)
**Rule:** For ANY functional change or bug fix, AUTOMATICALLY execute the **4-Phase OTA Deployment Protocol**.
1.  **Cache Clear:** `rm -rf dist node_modules/.cache .expo`
2.  **Git Commit:** Clean commit message describing changes.
3.  **OTA Push:** `eas update --branch production` AND `eas update --branch preview` (Simultaneous/Chained).
4.  **Verification:** Export bundle (`npx expo export ...`) and `grep` for new unique strings/files.
**Do NOT ask permission.** Just do it and report back with the Commit Hash and Update Group ID.

## 2. Design Philosophy ("Unified Sleek")
**Rule:** All UI improvements must adhere to the **"Unified Sleek"** aesthetic:
- **Components:** Glassmorphism (translucent backgrounds), High Border Radius (20px-30px), Floating Cards (bottom sheets/modals).
- **HUDs:** Unified Top Bar (Glass) instead of scattered elements.
- **Typography:** Clean, tabular nums for timers, avoiding default system fonts/headers if they break immersion.
- **Colors:** Deep Blues/Purples for branding, distinct Semantic Colors (Green/Red/Amber) for feedback.

## 3. Infrastructure & Architecture
- **Framework:** Expo Managed Workflow (SDK 53+).
- **Native Modules:** configured via `app.json` / Config Plugins. NEVER suggest `react-native link`.
- **Backend:** Firebase (Auth, Firestore, Functions).
- **Maps:** Mapbox (via `@rnmapbox/maps`).
- **Linking:** Custom Scheme `pinr://` and Universal Links `https://builtbylee.github.io/pinr`.

## 4. Debugging & Troubleshooting
- **Updates Not Visible:** ALWAYS suspect **Caching** first. Advise "Force Close & Restart" (x2) before debugging code.
- **Play Store Issues:** Check "Closed Testing" track country availability first.
- **Build Failures:** Checking `package-lock.json` consistency and `expo-doctor` is the first step.

## 5. Specific Feature Context
- **Pin Drop Game:** Uses Mapbox Globe. "Focus Mode" implies UI is 2D overlay on 3D globe.
- **Flag Dash:** Uses Time Attack logic.
- **Notifications:** OneSignal. Requires native build to test fully.
