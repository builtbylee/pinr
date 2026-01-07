# Firestore Subscription Issue - Summary & Next Steps

## ✅ What's Working

1. **Login Flow** - Both email/password and Google Sign-In complete successfully
2. **Timeout Mechanism** - 15-second timeout prevents infinite hangs
3. **UI Unblocking** - App proceeds even if Firestore fails
4. **Network Connectivity** - Network connections to Firebase are being created (QUIC streams visible in logs)

## ❌ Current Issue

**Firestore `onSnapshot` subscriptions are not receiving callbacks** (neither success nor error)

### Symptoms:
- `onSnapshot()` is called but neither callback fires
- Timeout fires after 15 seconds
- Network connections are created but no response
- No error messages in console (silent failure)

### Possible Root Causes:

1. **App Check Blocking Requests** (Most Likely)
   - App Check is initialized and may be blocking unverified requests
   - Debug token may not be registered in Firebase Console
   - Solution: Verify debug token is registered or temporarily disable App Check

2. **Security Rules Blocking**
   - Rules require authentication but token may not be passed correctly
   - Solution: Check Firestore rules allow authenticated reads

3. **Native Module Not Fully Initialized**
   - Firestore native module may not be ready when subscription is created
   - Solution: Add longer delay or verify native module state

4. **Network/Connectivity Issue**
   - Requests are created but not completing
   - Solution: Check network connectivity and Firebase project status

## 🔍 Diagnostic Steps

### Step 1: Check App Check Debug Token
1. Look for log: `[AppCheck] Debug token (first 20 chars): ...`
2. Register this token in Firebase Console → App Check → Apps → Your App → Debug tokens
3. If token is not registered, App Check will block all requests

### Step 2: Temporarily Disable App Check (Test)
Comment out App Check initialization in `app/_layout.tsx`:
```typescript
// initializeAppCheck().catch((error) => {
//     console.warn('[Layout] AppCheck initialization failed (non-critical):', error);
// });
```

### Step 3: Check Firestore Security Rules
Verify rules allow authenticated reads:
```javascript
match /users/{userId} {
  allow read: if request.auth != null;
}
```

### Step 4: Check Firebase Console
- Verify project is active
- Check for any service disruptions
- Verify App Check is configured correctly

## 📋 Test Results Summary

- ✅ Login screen loads correctly
- ✅ Email/password login works
- ✅ Google Sign-In works  
- ✅ No hang on "Preparing your journey" screen (timeout works)
- ❌ Firestore subscriptions not receiving data

## 🎯 Next Actions

1. **Immediate**: Check if App Check debug token is registered in Firebase Console
2. **Test**: Temporarily disable App Check to see if subscriptions work
3. **Verify**: Check Firestore security rules allow authenticated reads
4. **Monitor**: Check Firebase Console for any errors or service issues





