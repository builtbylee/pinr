# iOS Login Fix - Comprehensive Investigation & Fix

## Root Causes Identified

### 1. **Session Not Set on Authentication**
- **Issue**: `session` state was not being set immediately when user authenticates
- **Location**: `app/_layout.tsx` - `onAuthStateChanged` callback
- **Impact**: App stays on AuthScreen even after successful login
- **Fix**: Set `session` immediately when user authenticates, don't wait for profile validation

### 2. **Profile Validation Blocking Navigation**
- **Issue**: Profile validation was blocking navigation, causing race conditions
- **Location**: `app/_layout.tsx` - profile validation logic
- **Impact**: User gets signed out before profile fetch completes
- **Fix**: Allow navigation immediately, let subscriptions handle profile loading

### 3. **Firestore Queries Timing Out**
- **Issue**: Firestore queries timeout after 10 seconds on iOS
- **Location**: `src/services/userService.ts` - `getUserProfile`
- **Impact**: Profile never loads, causing validation to fail
- **Fix**: Increased timeout, improved error handling, allow navigation without profile

### 4. **Race Condition Between AuthScreen and Layout**
- **Issue**: `AuthScreen` and `_layout.tsx` both trying to fetch profile simultaneously
- **Location**: Both files calling `getUserProfile` at the same time
- **Impact**: User gets signed out while AuthScreen is still fetching
- **Fix**: Simplified flow - Layout handles navigation, AuthScreen just triggers auth

## Fixes Applied

### 1. Set Session Immediately on Authentication
```typescript
// app/_layout.tsx - onAuthStateChanged
setSession(userId); // Set immediately, don't wait for profile
setCurrentUserId(userId);
setIsInitializing(false);
```

### 2. Allow Navigation Without Profile
```typescript
// Profile validation no longer blocks navigation
// Profile will load via subscription once Firestore connects
setProfileValidated(true);
```

### 3. Improved Error Handling
- Removed blocking alerts
- Better timeout handling
- Graceful degradation when Firestore is slow

### 4. Simplified Authentication Flow
- `onAuthStateChanged` handles all session management
- `onAuthenticated` callback only sets username
- No race conditions between components

## Testing Checklist

- [ ] Email + Password login works
- [ ] Google Sign-In works
- [ ] Biometric login works
- [ ] App navigates to main screen after login
- [ ] Profile loads via subscription (even if slow)
- [ ] No hanging spinners
- [ ] No "Unknown" profile auto-login

## Next Steps

1. Test all login methods
2. Verify profile loads via subscription
3. Check that pins load correctly
4. Ensure no regressions on Android



