---
description: Autonomous Android EAS build workflow with pre-verification, monitoring, and auto-repair
---

# Autonomous Android Build Workflow

This workflow autonomously builds, monitors, and repairs Android builds until successful.

## CRITICAL: Command Execution Rules

**NEVER run EAS commands directly** - they will crash the agent due to timeouts.

### SAFE Commands (< 30 seconds)
```bash
# These are safe to run directly:
eas build:list --platform android --limit 5 --non-interactive
eas build:view [BUILD_ID] --json
./scripts/monitor-build.sh
./scripts/pre-build-verify.sh
./scripts/fetch-build-logs.sh
```

### UNSAFE Commands (WILL CRASH AGENT)
```bash
# NEVER run these directly:
eas build --platform android ...  # ❌ CRASHES
export NODE_TLS... && eas build ... # ❌ CRASHES
```

### Background Commands (Use for builds)
```bash
# ALWAYS use this for builds:
./scripts/eas-build-async.sh android production
```

---

## WORKFLOW: Autonomous Build Loop

### Phase 1: Pre-Build Verification (MANDATORY)

**Run this BEFORE every build attempt:**

```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/pre-build-verify.sh
```

**Expected output:**
- Exit code 0 + "PRE-BUILD PASSED" → Proceed to Phase 2
- Exit code 1 + "PRE-BUILD FAILED" → Fix errors first, then re-run verification

**If verification fails, fix these common issues:**

| Error Type | Fix |
|------------|-----|
| TypeScript errors | Fix the TS errors in indicated files |
| Bundle errors | Fix syntax/import errors in source files |
| Missing google-services.json | Ensure file exists in project root |
| Invalid app.json fields | Remove `predictiveBackGestureEnabled` |
| expo-modules-core installed | Remove from package.json dependencies |

### Phase 2: Submit Build

**Only after Phase 1 passes:**

```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android production
```

**Output will show:**
- Log file path: `/tmp/eas-build-android-TIMESTAMP.log`
- Status file: `/tmp/eas-build-status.txt`

**Wait 15 seconds, then check submission status:**

```bash
cat /tmp/eas-build-status.txt
```

- `STARTING` → Wait and re-check
- `SUBMITTED` → Proceed to Phase 3
- `FAILED` → Check log file, fix issues, retry from Phase 1

### Phase 3: Monitor Build (Every 60 seconds)

**Run monitoring check:**

```bash
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/monitor-build.sh
```

**Interpret status:**

| Status | Action |
|--------|--------|
| `IN_PROGRESS` / `IN_QUEUE` | Wait 60 seconds, check again |
| `FINISHED` | 🎉 BUILD SUCCEEDED - Report artifact URL to user |
| `ERRORED` / `CANCELED` | Proceed to Phase 4 |

**Alternative monitoring (more detail):**

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas build:list --platform android --limit 1 --non-interactive --json
```

### Phase 4: Failure Analysis (On ERRORED/CANCELED)

**Step 4a: Fetch build logs**

```bash
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/fetch-build-logs.sh
```

**Step 4b: Analyze the error**

Read the output file at `/tmp/build-logs-*.txt` and identify the error type:

| Error Code | Typical Cause | Fix |
|------------|---------------|-----|
| `UNKNOWN_ERROR` (Bundle JS phase) | Syntax error in TypeScript/JavaScript | Check `src/` files for syntax issues |
| `EAS_BUILD_UNKNOWN_GRADLE_ERROR` | Gradle/Android config issue | Check `android/build.gradle`, Kotlin version |
| `Key X.X.X is missing in map` | Unsupported Kotlin version | Change kotlinVersion in app.json |
| `Unexpected token` | Syntax error (comment, bracket, etc.) | Find and fix the syntax error |
| `Cannot find module` | Missing dependency or bad import | Fix import or install dependency |

**Step 4c: Apply fix based on error type**

**For TypeScript/Syntax errors:**
1. Read the file mentioned in error
2. Find and fix the syntax issue
3. Run `npx tsc --noEmit` to verify fix

**For Gradle/Kotlin errors:**
1. Check `app.json` expo-build-properties
2. Verify Kotlin version is supported (1.9.24 recommended, NOT 1.9.25)
3. Verify Gradle version is compatible (8.10.2 recommended)

**For Missing dependency:**
1. Run `npm install` or `yarn`
2. If specific package missing, install it

**Step 4d: Commit fix (if code was changed)**

```bash
cd /Users/lee/Projects/primal-singularity && git add -A && git commit -m "Fix: [describe the fix]"
```

**Step 4e: Return to Phase 1**

After fixing, start over from Phase 1 verification.

---

## Common Build Errors & Fixes

### SyntaxError: Unexpected token
**Symptoms:** Error in "Bundle JavaScript" phase mentioning a specific file/line
**Fix:**
1. Read the file at the mentioned line
2. Look for:
   - Orphaned `*` from JSDoc comments
   - Missing closing brackets `}` or `)`
   - Incomplete import statements
3. Fix the syntax error
4. Verify with: `npx tsc --noEmit`

### Gradle: Key 1.9.25 is missing in map
**Symptoms:** Error in "Run gradlew" phase about Kotlin version
**Fix:**
1. Edit `app.json`
2. In `expo-build-properties.android`, change `kotlinVersion` to `1.9.24`
3. Run `npx expo prebuild --clean` if android/ exists

### Config: predictiveBackGestureEnabled
**Symptoms:** expo-doctor or config schema error
**Fix:**
1. Edit `app.json`
2. Remove `"predictiveBackGestureEnabled": false` from android section

### Missing google-services.json
**Symptoms:** Build fails looking for Google Services configuration
**Fix:**
1. Download `google-services.json` from Firebase Console
2. Place in project root directory

---

## Quick Reference: Build Loop Commands

```bash
# Step 1: Pre-build verification
cd /Users/lee/Projects/primal-singularity && ./scripts/pre-build-verify.sh

# Step 2: Submit build (background)
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android production

# Step 3: Check submission status (wait 15s first)
cat /tmp/eas-build-status.txt

# Step 4: Monitor build progress (every 60s)
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/monitor-build.sh

# Step 5 (if failed): Fetch logs for analysis
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/fetch-build-logs.sh

# Read logs
cat /tmp/build-logs-*.txt | tail -100
```

---

## Success Criteria

The build loop is complete when:
1. `./scripts/monitor-build.sh` returns `FINISHED` status
2. An artifact URL (APK or AAB) is available
3. Report the artifact URL to the user

**On success, provide:**
- Build ID
- Artifact download URL
- EAS dashboard link: https://expo.dev/accounts/hackneymanlee2/projects/80days/builds
