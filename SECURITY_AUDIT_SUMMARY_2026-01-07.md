# Security Audit Report - January 7, 2026

**Tool:** [rnsec](https://www.rnsec.dev/) - React Native Security Scanner  
**Scan Duration:** 3.35 seconds  
**Files Analyzed:** 269  
**Total Issues Found:** 444

**Risk Level:** 🔴 **HIGH** - Immediate action required for high severity vulnerabilities

---

## Executive Summary

The security audit detected **444 security issues** across the codebase:
- **6 HIGH severity** issues requiring immediate attention
- **432 MEDIUM severity** issues (mostly logging and timeout-related)
- **6 LOW severity** issues (permissions and configurations)

**Reports Generated:**
- HTML Report: `security-audit-report.html` (visual summary)
- JSON Report: `rnsec-report.json` (detailed data)

---

## 🔴 HIGH SEVERITY ISSUES (6 - Critical Fix Required)

### 1. Hardcoded OneSignal REST API Key (2 instances)
**Location:**
- `scripts/simulate-pin-notification.js:7`
- `scripts/verify-pin-notification.js:6`

**Issue:** OneSignal REST API key hardcoded in test scripts  
**Risk:** If these scripts are committed to production, the API key is exposed  
**Fix:** 
- Move keys to environment variables
- Add these files to `.gitignore` if they're test-only scripts
- Use `process.env.EXPO_PUBLIC_ONESIGNAL_REST_API_KEY` instead

**Code:**
```javascript
const ONE_SIGNAL_REST_API_KEY = 'os_v2_app_lgmokdxmfze7vhj7sy4rnbehvsajdjhgufbegzfkoyeuqj7txtsyebzctnwo577asbhicpokkrh5plskt3kx2zmrvjanqtsumxn22oi';
```

---

### 2. Authentication Token in URL Query Parameter
**Location:** `scripts/verify-explore-backend.js:58`

**Issue:** Mapbox token passed as URL query parameter instead of Authorization header  
**Risk:** Tokens in URLs are logged in server logs, browser history, and can be exposed  
**Fix:** Use Authorization header:
```javascript
// ❌ BAD:
const url = `https://api.mapbox.com/...?access_token=${MAPBOX_TOKEN}`;

// ✅ GOOD:
const url = `https://api.mapbox.com/...`;
const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${MAPBOX_TOKEN}` }
});
```

---

### 3. Insecure Random Number Generation (Math.random)
**Location:** `src/services/authService.ts:196`

**Issue:** `Math.random()` used for nonce generation in Apple Sign-In  
**Risk:** Nonces can be predicted, compromising security of OAuth flow  
**Fix:** Use cryptographically secure random:
```typescript
// ❌ CURRENT:
const nonce = Math.random().toString(36).substring(2, 15);

// ✅ FIXED:
import * as Crypto from 'expo-crypto';
const randomBytes = await Crypto.getRandomBytesAsync(16);
const nonce = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
```

---

### 4. Hardcoded Firebase API Key
**Location:** `src/services/firebaseInitService.ts:110`

**Issue:** Firebase API key hardcoded in source code  
**Risk:** API keys exposed in bundle can be extracted and abused  
**Fix:** Move to environment variable:
```typescript
// ❌ CURRENT:
const firebaseConfig = {
    apiKey: "AIzaSyAUKW5TCvDSYK_G-T9CuxVGaCeYv57ikBE",
    // ...
};

// ✅ FIXED:
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
    // ...
};
```

**Note:** Firebase Web API keys are often considered "public" but should still be restricted via Firebase Console (domain restrictions, API quotas). Moving to env vars is best practice.

---

### 5. Exported Activity Without Permission Protection
**Location:** `android/app/src/main/AndroidManifest.xml`

**Issue:** Android activity accessible by any app without permission checks  
**Risk:** Malicious apps can invoke activities and potentially trigger unauthorized actions  
**Fix:** Add permission protection or use `android:exported="false"` where appropriate

---

### 6. Permissive Intent Filter
**Location:** `android/app/src/main/AndroidManifest.xml`

**Issue:** Intent filter with `android.intent.action.VIEW` allows any app to trigger deep links  
**Risk:** Malicious apps could trigger arbitrary deep links  
**Fix:** Add signature-based protection or validate deep link data before processing

---

## 🟡 MEDIUM SEVERITY ISSUES (432 - Address in Priority Order)

### Top Categories:

#### 1. Sensitive Logging (200+ instances)
**Issue:** Console logs containing tokens, session data, user IDs, pin locations, and other sensitive data  
**Locations:** Throughout `app/_layout.tsx`, `app/index.tsx`, and service files

**Risk:** In production, these logs can be captured by log aggregation services or device logs, exposing sensitive data

**Fix Pattern:**
```typescript
// ❌ CURRENT:
console.log('[App] Saving push token:', token);
console.log('[Layout] Setting session to:', userId);

// ✅ FIXED:
if (__DEV__) {
    console.log('[App] Saving push token:', token?.substring(0, 10) + '...');
    console.log('[Layout] Setting session to:', userId?.substring(0, 8) + '...');
}
// OR: Use a logging library that filters sensitive data in production
```

**Priority Files:**
- `app/_layout.tsx` (20+ instances)
- `app/index.tsx` (30+ instances)
- `src/services/authService.ts` (40+ instances)

---

#### 2. Error Objects Logged Directly (100+ instances)
**Issue:** Full error objects logged, potentially exposing stack traces, internal paths, and sensitive data  
**Locations:** Throughout all service files

**Fix Pattern:**
```typescript
// ❌ CURRENT:
catch (error) {
    console.error('Error:', error);
}

// ✅ FIXED:
catch (error: any) {
    console.error('Error:', error.message || 'Unknown error');
    // Log full error only in dev
    if (__DEV__) {
        console.error('Full error:', error);
    }
}
```

---

#### 3. Missing Request Timeouts (100+ instances)
**Issue:** `fetch()` calls without timeout, vulnerable to slowloris DoS attacks  
**Locations:** All service files and scripts

**Fix Pattern:**
```typescript
// ❌ CURRENT:
const response = await fetch(url, { headers });

// ✅ FIXED:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
try {
    const response = await fetch(url, { 
        headers, 
        signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return response;
} catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
        throw new Error('Request timeout after 30s');
    }
    throw error;
}
```

**High Priority Files:**
- `src/services/firestoreService.ts`
- `src/services/userService.ts`
- `src/services/authService.ts`
- All files in `scripts/` directory

---

#### 4. Generic API Key Patterns Detected
**Issue:** API key patterns detected in multiple locations  
**Locations:**
- `scripts/simulate-pin-notification.js:7` (OneSignal key)
- `src/services/firebaseInitService.ts:110` (Firebase key)

**Fix:** Already covered in HIGH severity section above

---

## 🔵 LOW SEVERITY ISSUES (6 - Review and Justify)

### 1. Dangerous Permissions Declared
**Location:** `app.json` and `android/app/src/main/AndroidManifest.xml`

**Permissions:**
- `android.permission.ACCESS_FINE_LOCATION` (required for map functionality ✅)
- `android.permission.CAMERA` (required for photo uploads ✅)
- `android.permission.RECORD_AUDIO` (verify if actually needed ❓)

**Action:** Verify `RECORD_AUDIO` is necessary. If not, remove it.

---

### 2. Background Mode Enabled
**Location:** `ios/Pinr/Info.plist`
- `remote-notification` background mode

**Status:** Required for push notifications ✅ (acceptable)

---

### 3. Missing Data Protection Entitlement
**Location:** `ios/Pinr/Info.plist`

**Issue:** No data protection entitlement declared  
**Fix:** Add data protection class to `ios/Pinr/Pinr.entitlements` if handling sensitive data

---

## Recommended Action Plan

### Immediate (Today/Tomorrow):
1. ✅ **Fix HIGH #3:** Replace `Math.random()` with `expo-crypto` in `authService.ts`
2. ✅ **Fix HIGH #2:** Move Mapbox token to Authorization header in `verify-explore-backend.js`
3. ✅ **Fix HIGH #1:** Move OneSignal keys to env vars in test scripts OR add to `.gitignore`
4. ✅ **Fix HIGH #4:** Move Firebase API key to environment variable (already using env, but hardcoded fallback should be removed)

### This Week:
5. ⚠️ **Address HIGH #5 & #6:** Review Android manifest permissions and exported activities
6. ⚠️ **Production Logging:** Wrap all sensitive logs in `__DEV__` checks in critical files:
   - `app/_layout.tsx`
   - `app/index.tsx`
   - `src/services/authService.ts`
   - `src/services/userService.ts`

### Next Sprint:
7. ⏳ **Add Timeouts:** Add timeout handlers to critical `fetch()` calls (start with service files)
8. ⏳ **Error Sanitization:** Sanitize all error logging across the codebase
9. ⏳ **Review LOW Issues:** Justify all dangerous permissions

---

## Files with Most Issues

1. `src/services/userService.ts` - 80+ issues (mostly error logging and timeouts)
2. `src/services/authService.ts` - 60+ issues (logging, error handling)
3. `app/index.tsx` - 50+ issues (logging)
4. `app/_layout.tsx` - 40+ issues (logging, error handling)
5. Scripts directory - 100+ issues (hardcoded secrets, timeouts)

---

## Security Best Practices Going Forward

1. **Never commit secrets** - Use environment variables for all API keys, even "public" ones
2. **Wrap production logs** - Use `__DEV__` checks or a logging library that filters in production
3. **Always add timeouts** - All network requests should have timeout protection
4. **Sanitize errors** - Never log full error objects in production
5. **Use secure randomness** - Always use crypto-secure RNG for nonces, tokens, IDs
6. **Validate deep links** - Always validate deep link data before processing
7. **Review permissions** - Only request permissions you actually use

---

## Notes

- The scanner flagged **scripts/** directory heavily - if these are dev-only scripts, consider adding them to `.gitignore` or moving to a separate repo
- Most MEDIUM issues are **development/debugging code** that should be wrapped in `__DEV__` checks
- Firebase Web API keys are often considered "safe" to expose, but should still be restricted via Firebase Console
- The **high number of findings** is normal for React Native apps with extensive logging/debugging code

---

**Generated:** January 7, 2026, 11:08 PM  
**Next Audit Recommended:** After implementing HIGH severity fixes

