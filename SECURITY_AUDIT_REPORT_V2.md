# Security Audit Report - Update #2
**Date:** 2025-01-27  
**Application:** Primal Singularity (React Native Expo + Firebase)  
**Previous Audit:** Initial audit identified 8 HIGH RISK, 6 MEDIUM RISK, and 4 LOW RISK issues

---

## Executive Summary

**Significant progress has been made!** Several critical vulnerabilities have been fixed:
- ✅ Account recovery function removed
- ✅ Unauthorized account deletion removed
- ✅ Firestore rules fixed (users can only update own profiles)
- ✅ Friend management moved to request-based model
- ✅ Username validation added
- ✅ Credentials moved to environment variables

**Remaining Issues:** 3 HIGH RISK, 4 MEDIUM RISK, and 3 LOW RISK vulnerabilities remain, primarily around client-side game score validation and anti-cheat mechanisms.

---

## ✅ FIXED VULNERABILITIES

### 1. **Account Recovery Function - REMOVED** ✅
**Previous Issue:** `recoverAccount()` allowed account takeover  
**Status:** Function has been removed (commented out with security note)  
**Location:** `src/services/userService.ts:531`

---

### 2. **Unauthorized Account Deletion - REMOVED** ✅
**Previous Issue:** `deleteUserByUsername()` allowed deleting any account  
**Status:** Function has been removed (commented out with security note)  
**Location:** `src/services/userService.ts:542`

---

### 3. **Firestore Rules: Friend List Modification - FIXED** ✅
**Previous Issue:** Users could modify other users' friends lists  
**Status:** **FIXED** - Rule now only allows users to update their own profile  
**Location:** `firestore.rules:9`

```javascript
// BEFORE (VULNERABLE):
allow update: if request.auth != null && (
  request.auth.uid == userId || 
  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['friends', 'updatedAt'])
);

// AFTER (SECURE):
allow update: if request.auth != null && request.auth.uid == userId; // STRICT: Owner only
```

**Additional Improvement:** Friend management moved to request-based model with Cloud Functions for server-side validation.

---

### 4. **Hardcoded Google Client ID - PARTIALLY FIXED** ⚠️
**Previous Issue:** Hardcoded OAuth client ID  
**Status:** **IMPROVED** - Now uses environment variable, but still has hardcoded fallback  
**Location:** `src/services/authService.ts:5`

```typescript
// IMPROVED but still has fallback:
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '760973100570-m7rblrrm2fkcjk61mjnu9bruvkrs03qp.apps.googleusercontent.com';
```

**Remaining Risk:** Hardcoded fallback means credential is still in source code if env var is missing.

**Recommendation:**
- Remove hardcoded fallback
- Fail fast if environment variable is not set
- Document required environment variables

---

### 5. **Hardcoded App Check Debug Token - FIXED** ✅
**Previous Issue:** Hardcoded debug token  
**Status:** **FIXED** - Now uses environment variable  
**Location:** `src/services/appCheckService.ts:33`

```typescript
debugToken: process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN,
```

**Note:** No hardcoded fallback - this is good!

---

### 6. **Username Validation - ADDED** ✅
**Previous Issue:** No input validation on usernames  
**Status:** **FIXED** - Validation added  
**Location:** `src/services/userService.ts:109-112`

```typescript
// Validation (Risk #12)
const u = username.trim();
if (u.length < 3 || u.length > 20) throw new Error('Username must be 3-20 characters');
if (!/^[a-zA-Z0-9_-]+$/.test(u)) throw new Error('Invalid characters in username');
```

---

### 7. **Friend Management - IMPROVED** ✅
**Previous Issue:** Client-side friend list modifications  
**Status:** **IMPROVED** - Moved to request-based model with Cloud Functions  
**Location:** `functions/src/index.ts`, `src/services/userService.ts`

**Improvements:**
- Friend requests now require mutual consent
- Cloud Functions handle friend acceptance (`acceptFriendRequest`)
- Firestore rules prevent direct friend list manipulation
- Request-based model is more secure

**Note:** Old `addFriend()` function is deprecated but still exists (returns error message).

---

## 🔴 REMAINING HIGH RISK VULNERABILITIES

### 1. **Game Scores Still Client-Side Validated** ⚠️ CRITICAL
**Location:** `src/services/LeaderboardService.ts:25-77`, `src/services/GameService.ts:208-238`

**Issue:** 
- Game scoring logic still runs entirely on client
- Leaderboard accepts any score value from client
- Client-side "anti-cheat" can be bypassed
- No server-side validation

**Current "Protection":**
```typescript
// GameService.ts:213-223
// Anti-Cheat Validation (Risk #6)
const maxPossibleScore = this.correctAnswersCount * 100;
if (this.state.score > maxPossibleScore) {
    console.error('[GameService] Security Alert: Score calculation mismatch.');
    // Silently fail to save high score
    return;
}
```

**Problems:**
1. `correctAnswersCount` is tracked client-side and can be manipulated
2. Score calculation happens client-side
3. Leaderboard still allows direct writes via Firestore rules
4. No verification that game was actually played

**Impact:**
- Users can submit arbitrary high scores
- Leaderboard can be completely manipulated
- Game integrity is compromised

**Attack Example:**
```typescript
// Attacker can:
// 1. Modify GameService to set correctAnswersCount = 999
// 2. Directly call: leaderboardService.saveScore(999999, 'easy')
// 3. Bypass all client-side checks
```

**Recommendation:**
- **IMMEDIATELY:** Remove direct writes to leaderboard in Firestore rules
- Implement Cloud Function to validate scores:
  - Store game session data server-side
  - Verify score calculation server-side
  - Validate timestamps and game completion
  - Implement rate limiting
- Move score submission to Cloud Function call

---

### 2. **Challenge Anti-Cheat Still Client-Side** ⚠️ HIGH
**Location:** `src/services/ChallengeService.ts:152-244`

**Issue:** Anti-cheat validation runs on client and only logs warnings - doesn't reject scores.

```typescript
// ChallengeService.ts:180-186
} else if ((now - startedAt) > TIME_LIMIT_MS) {
    console.warn('[ChallengeService] Time limit exceeded. Forfeit?');
    // We could reject the score or force it to 0.
    // For now, let's accept it but maybe flag it?
    // Or implementing strict forfeit:
    // score = 0;  // COMMENTED OUT - NOT ENFORCED
}
```

**Problems:**
1. Time limit check is client-side (can be bypassed)
2. Even when exceeded, score is still accepted
3. No server-side validation
4. `startedAt` timestamp can be manipulated

**Impact:**
- Users can bypass time limits
- Users can submit scores without playing
- Challenge integrity is compromised

**Recommendation:**
- Move all validation to Cloud Functions
- Store challenge start times server-side
- Reject scores that exceed time limits
- Implement cryptographic signatures for game state
- Validate timestamps server-side

---

### 3. **Leaderboard Write Rule Still Allows Direct Writes** ⚠️ CRITICAL
**Location:** `firestore.rules:59-63`

```javascript
match /game_leaderboard/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.resource.data.odUid == request.auth.uid;
}
```

**Issue:** Users can still write their own scores directly to Firestore, bypassing any client-side validation.

**Impact:**
- Complete leaderboard manipulation
- No validation of score legitimacy
- Users can set arbitrary scores

**Recommendation:**
```javascript
// REMOVE direct writes:
match /game_leaderboard/{docId} {
  allow read: if request.auth != null;
  // REMOVE: allow write
  // Only allow writes via Cloud Functions (admin SDK)
}
```

Then implement Cloud Function for score submission.

---

## 🟡 REMAINING MEDIUM RISK VULNERABILITIES

### 4. **Story/Pin Limits Still Client-Side Only**
**Location:** `src/services/StoryService.ts:36-76`

**Issue:** Limits like "5 stories per user" and "10 pins per story" are checked client-side and can be bypassed.

```typescript
// Client-side check:
if (userStoriesSnapshot.size >= MAX_STORIES_PER_USER) {
    return { success: false, error: `You can only have up to ${MAX_STORIES_PER_USER} stories.` };
}
```

**Impact:**
- Users can exceed limits by modifying client code
- Database can be polluted with excessive data

**Recommendation:**
- Enforce limits in Firestore rules using `get()` to count existing stories
- Or use Cloud Functions to validate before creation
- Add server-side validation

---

### 5. **Game Challenge Read Rule May Fail for New Documents**
**Location:** `firestore.rules:54`

```javascript
allow read: if request.auth != null && (resource.data.challengerId == request.auth.uid || resource.data.opponentId == request.auth.uid);
```

**Issue:** Uses `resource.data` which may not exist for newly created documents during the create operation.

**Recommendation:**
- Add fallback to check `request.resource.data` for create operations
- Or ensure read happens after create completes

---

### 6. **Hardcoded Fallback Credentials Still Present**
**Location:** `src/services/authService.ts:5`, `src/constants/Config.ts:1`

**Issue:** Environment variables have hardcoded fallbacks that expose credentials in source code.

```typescript
// authService.ts
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '760973100570-m7rblrrm2fkcjk61mjnu9bruvkrs03qp.apps.googleusercontent.com';

// Config.ts
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'pk.placeholder';
```

**Impact:**
- Credentials visible in source code if env vars missing
- Difficult to rotate credentials
- Potential for accidental exposure

**Recommendation:**
- Remove hardcoded fallbacks
- Fail fast if environment variables are missing
- Document required environment variables in `.env.example`

---

### 7. **Client-Side Anti-Cheat Can Be Bypassed**
**Location:** `src/services/GameService.ts:149, 191, 216`

**Issue:** `correctAnswersCount` is tracked client-side and used for validation, but can be manipulated.

```typescript
private correctAnswersCount: number = 0; // Anti-cheat tracking

// In submitAnswer:
if (isCorrect) {
    this.correctAnswersCount++; // Can be manipulated
}

// In endGame:
const maxPossibleScore = this.correctAnswersCount * 100; // Can be bypassed
```

**Impact:**
- Users can manipulate `correctAnswersCount` to bypass validation
- Score validation is ineffective

**Recommendation:**
- Move score tracking to server-side
- Store game session data in Firestore
- Validate server-side

---

## 🟢 LOW RISK / DEFENSE-IN-DEPTH

### 8. **Missing Rate Limiting**
**Issue:** No rate limiting on:
- Friend requests
- Pin creation
- Story creation
- Score submissions
- Challenge creation

**Recommendation:**
- Implement rate limiting in Cloud Functions
- Use Firebase App Check to prevent bot abuse
- Add per-user quotas

---

### 9. **Cloud Functions Exist But Not Used for Critical Operations**
**Location:** `functions/src/index.ts`

**Issue:** Cloud Functions exist for friend management but:
- Not used for score validation
- Not used for challenge validation
- Not used for story/pin limit enforcement

**Recommendation:**
- Extend Cloud Functions to handle score submissions
- Add challenge validation functions
- Add story/pin limit enforcement

---

### 10. **Debug Logging in Production Code**
**Issue:** Multiple `console.log()` statements may leak sensitive data.

**Recommendation:**
- Use environment-based logging
- Remove or guard all `console.log()` statements in production
- Use proper logging library with log levels

---

## 📊 Security Posture Summary

### Fixed: 7 issues
- ✅ Account recovery removed
- ✅ Unauthorized deletion removed
- ✅ Firestore friend list rule fixed
- ✅ Friend management improved
- ✅ Username validation added
- ✅ App Check token uses env var
- ✅ Google Client ID uses env var (with fallback)

### Remaining: 10 issues
- 🔴 3 HIGH RISK (game scores, challenges, leaderboard writes)
- 🟡 4 MEDIUM RISK (story limits, read rules, fallback creds, client anti-cheat)
- 🟢 3 LOW RISK (rate limiting, Cloud Functions usage, logging)

---

## Priority Recommendations

### Immediate (Before Production):
1. **Remove direct leaderboard writes** from Firestore rules
2. **Implement Cloud Function for score validation**
3. **Move challenge validation to Cloud Functions**

### High Priority (Fix Soon):
4. **Enforce story/pin limits server-side**
5. **Remove hardcoded credential fallbacks**
6. **Move game session tracking server-side**

### Medium Priority:
7. **Add rate limiting**
8. **Improve error handling and logging**
9. **Set up dependency vulnerability scanning**

---

## Testing Recommendations

1. **Penetration Testing:**
   - Attempt to submit fake game scores
   - Try to bypass challenge time limits
   - Attempt to exceed story/pin limits
   - Test leaderboard manipulation

2. **Security Testing:**
   - Verify Cloud Functions are called for critical operations
   - Test Firestore rules with different user contexts
   - Verify App Check is working in production

3. **Code Review:**
   - Review all remaining client-side write operations
   - Verify all sensitive operations require authentication
   - Check for any remaining hardcoded secrets

---

## Conclusion

**Excellent progress!** The most critical account takeover vulnerabilities have been fixed. However, **game integrity remains a significant concern** with client-side score validation. The leaderboard and challenge systems are still vulnerable to manipulation.

**Estimated Fix Time:** 1-2 weeks for remaining critical issues (score validation, leaderboard writes).

**Security Score Improvement:** 
- **Before:** 2/10 (Critical vulnerabilities present)
- **After:** 6/10 (Major improvements, but game integrity issues remain)

---

*This audit assumes attackers have full access to client-side code, as is standard for mobile applications.*










