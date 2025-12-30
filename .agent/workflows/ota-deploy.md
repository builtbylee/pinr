---
description: OTA deployment process for all updates (features, modifications, fixes)
---

# OTA Deployment Workflow

This 4-phase process MUST be followed for EVERY update request.

## Phase 1: Cache Clearing (Infrastructure)
// turbo
```bash
rm -rf dist node_modules/.cache .expo
```
- Removes compiled bundle artifacts
- Clears Metro bundler cache
- Removes Expo development cache

## Phase 2: Git Commit (QA)
```bash
git add -A && git commit -m "[descriptive message]"
```
- Stage all modified files
- Create a **clean commit** (no asterisk in hash)
- Commit message should describe the changes

## Phase 3: OTA Push to Both Channels (Mobile Dev)
// turbo
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 eas update --branch production --message "[message]"
NODE_TLS_REJECT_UNAUTHORIZED=0 eas update --branch preview --message "[message]"
```
- Push to BOTH production and preview channels
- Same message for both channels
- Wait for both to complete successfully

## Phase 4: Bundle Verification (QA)
// turbo
```bash
npx expo export --platform android --no-bytecode --no-minify
grep -c "[search_pattern]" dist/_expo/static/js/android/*.js
```
- Export uncompressed bundle
- Search for specific code patterns that should exist
- Verify counts are > 0 for expected patterns

## Success Criteria
- Clean commit hash (no asterisk `*`)
- Both channels show "Published!" status
- Bundle verification shows expected patterns
- Same bundle hash on both channels confirms identical code

## Why This Works
1. **Clean commit** → Code is definitively in the bundle
2. **Cache cleared** → Fresh bundle generated every time
3. **Both channels pushed** → All devices receive updates
4. **Bundle verification** → Confirmed specific code patterns exist
