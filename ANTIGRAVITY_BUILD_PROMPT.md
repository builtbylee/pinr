# Antigravity: Autonomous Android Build Task

## Your Mission
Build and deploy a successful Android production build to EAS. Continue attempting builds until one succeeds.

## CRITICAL RULES

### Command Execution Limits
Your `run_command` tool has a timeout (~60-120 seconds). EAS build commands take 2-5+ minutes to upload.

**NEVER run these commands directly (WILL CRASH YOU):**
```bash
❌ eas build --platform android ...
❌ export NODE_TLS_REJECT_UNAUTHORIZED=0 && eas build ...
❌ Any EAS build command without the async wrapper
```

**ALWAYS use these instead:**
```bash
✅ ./scripts/eas-build-async.sh android production   # For builds
✅ ./scripts/monitor-build.sh                         # For status
✅ eas build:list ... --non-interactive              # For queries
```

---

## Build Loop Protocol

Execute this loop until a successful build is achieved:

### PHASE 1: Pre-Build Verification
**Run first, every time:**
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/pre-build-verify.sh
```

**If it fails (exit code 1):**
1. Read the error output
2. Fix all errors
3. Run verification again
4. Only proceed when it passes

### PHASE 2: Submit Build
**Only after Phase 1 passes:**
```bash
cd /Users/lee/Projects/primal-singularity && ./scripts/eas-build-async.sh android production
```

**Then wait 15 seconds and check:**
```bash
cat /tmp/eas-build-status.txt
```

- If `STARTING` - wait 10 more seconds, check again
- If `SUBMITTED` - proceed to Phase 3
- If `FAILED` - read the log file, fix issue, restart from Phase 1

### PHASE 3: Monitor Build (Loop every 60 seconds)
```bash
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/monitor-build.sh
```

**Interpret result:**
- `IN_PROGRESS` or `IN_QUEUE` → Wait 60 seconds, check again
- `FINISHED` → **SUCCESS!** Report the artifact URL to user
- `ERRORED` or `CANCELED` → Proceed to Phase 4

### PHASE 4: Failure Diagnosis & Repair
**Step 4a: Get the logs:**
```bash
cd /Users/lee/Projects/primal-singularity && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/fetch-build-logs.sh
cat /tmp/build-logs-*.txt | tail -150
```

**Step 4b: Identify & fix the error:**

| Error Pattern | Cause | Fix |
|---------------|-------|-----|
| `SyntaxError: Unexpected token` | Syntax error in JS/TS | Read the file, fix syntax |
| `Key 1.9.25 is missing` | Bad Kotlin version | Edit app.json, use 1.9.24 |
| `EAS_BUILD_UNKNOWN_GRADLE_ERROR` | Gradle config issue | Check android/build.gradle |
| `Cannot find module 'X'` | Missing dependency | npm install X |
| `predictiveBackGestureEnabled` | Invalid config | Remove from app.json android section |

**Step 4c: After fixing, commit:**
```bash
cd /Users/lee/Projects/primal-singularity && git add -A && git commit -m "Fix: [describe what you fixed]"
```

**Step 4d: Return to Phase 1**

---

## Recent Build Failures (Context)

The last 7 builds have failed with these errors:
1. **SyntaxError** in `src/services/authService.ts` - Bundle JS phase
2. **Gradle errors** - "Key 1.9.25 is missing in map" (Kotlin version issue)
3. **Config errors** - Invalid `predictiveBackGestureEnabled` field

These have been addressed, but you should verify in Phase 1.

---

## Success Reporting

When build succeeds, report to user:
1. ✅ **Build Status:** FINISHED
2. **Build ID:** [the build ID]
3. **Artifact URL:** [download link]
4. **Dashboard:** https://expo.dev/accounts/hackneymanlee2/projects/80days/builds

---

## Begin Now

Start with Phase 1: Run pre-build verification, then proceed through the loop until successful.

Remember:
- Be patient between monitoring checks (60 second intervals)
- Always diagnose failures thoroughly before retrying
- Commit any code fixes before re-submitting builds
- The goal is ONE successful build, not many failed attempts
