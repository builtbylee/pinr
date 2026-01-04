# Firestore Subscription Fix - Revert Guide

## Changes Made

### Files Modified:
1. `src/services/firebaseInitService.ts` - Improved `waitForFirestore()` to verify actual connectivity
2. `src/services/userService.ts` - Improved `subscribeToUserProfile()` to wait for verified connectivity

## How to Revert

### Option 1: Git Revert (Recommended)
```bash
git diff src/services/firebaseInitService.ts src/services/userService.ts
git checkout HEAD -- src/services/firebaseInitService.ts src/services/userService.ts
```

### Option 2: Manual Revert

#### Revert `firebaseInitService.ts`:
- Remove the connectivity test in `waitForFirestore()` (lines ~295-330)
- Restore the original logic that only checks SDK availability

#### Revert `userService.ts`:
- Restore the previous `subscribeToUserProfile()` implementation
- The old implementation used `waitForFirestoreConnection()` helper function

## What Changed

### Before:
- `waitForFirestore()` only checked if SDK instance exists
- `subscribeToUserProfile()` had its own connectivity check but didn't wait for `waitForFirestore()` first
- Result: Race condition on iOS where subscriptions were created before connection was ready

### After:
- `waitForFirestore()` now verifies actual connectivity with a test query
- `subscribeToUserProfile()` waits for `waitForFirestore()` first, then fetches initial data, then creates subscription
- Result: Connection is verified before subscription, eliminating timeouts

## Testing

To verify the fix works:
1. Launch app on iOS
2. Check logs for: `[FirebaseInit] ✅ Firestore connectivity verified`
3. Check logs for: `[UserService] 🎉 onSnapshot callback fired!`
4. Verify no 15-second timeout warnings
5. Verify profile loads without REST fallback

## Platform Impact

- **iOS**: Should fix subscription timeouts
- **Android**: No impact (already worked, fix makes it more robust)


