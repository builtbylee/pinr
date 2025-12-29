"use strict";
/**
 * Firebase Cloud Functions for Pinr
 *
 * Handles friend operations that require updating multiple user profiles.
 * Using Cloud Functions with admin SDK bypasses Firestore security rules,
 * allowing reciprocal friend updates while keeping client-side rules strict.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onWaitlistSignup = exports.createStory = exports.submitChallengeScore = exports.submitGameScore = exports.acceptFriendRequest = exports.removeFriend = exports.addFriend = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const USERS_COLLECTION = 'users';
// ============================================
// RATE LIMITING UTILITY
// ============================================
const RATE_LIMIT_COLLECTION = 'rate_limits';
/**
 * Simple rate limiter using Firestore
 * Tracks requests per user per action type
 */
async function checkRateLimit(uid, action, config) {
    const docId = `${uid}_${action}`;
    const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    try {
        const doc = await docRef.get();
        const data = doc.data();
        if (!data || data.windowStart < windowStart) {
            // New window - reset counter
            await docRef.set({
                count: 1,
                windowStart: now,
            });
            return { allowed: true, remaining: config.maxRequests - 1 };
        }
        if (data.count >= config.maxRequests) {
            // Rate limit exceeded
            console.warn(`[RateLimit] User ${uid} exceeded limit for ${action}`);
            return { allowed: false, remaining: 0 };
        }
        // Increment counter
        await docRef.update({
            count: admin.firestore.FieldValue.increment(1),
        });
        return { allowed: true, remaining: config.maxRequests - data.count - 1 };
    }
    catch (error) {
        console.error('[RateLimit] Error checking rate limit:', error);
        // Fail open to avoid blocking legitimate users
        return { allowed: true, remaining: config.maxRequests };
    }
}
// Rate limit configurations
const RATE_LIMITS = {
    scoreSubmission: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
    storyCreation: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    friendRequest: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
};
/**
 * Add a friend by username (callable function)
 * Adds the friend to both users' friends arrays reciprocally.
 */
exports.addFriend = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to add friends.');
    }
    const currentUid = context.auth.uid;
    const { friendUsername } = data;
    if (!friendUsername || typeof friendUsername !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Friend username is required.');
    }
    // Rate limiting check
    const rateCheck = await checkRateLimit(currentUid, 'friendRequest', RATE_LIMITS.friendRequest);
    if (!rateCheck.allowed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too many friend requests. Please wait.');
    }
    try {
        // Find friend by username (case-insensitive)
        const snapshot = await db
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', friendUsername.toLowerCase())
            .get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        const friendDoc = snapshot.docs[0];
        const friendUid = friendDoc.id;
        if (friendUid === currentUid) {
            throw new functions.https.HttpsError('invalid-argument', 'You cannot add yourself as a friend.');
        }
        // Check if already friends
        const currentUserDoc = await db.collection(USERS_COLLECTION).doc(currentUid).get();
        const currentUserData = currentUserDoc.data();
        if ((_a = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.friends) === null || _a === void 0 ? void 0 : _a.includes(friendUid)) {
            throw new functions.https.HttpsError('already-exists', 'You are already friends with this user.');
        }
        // Reciprocal friend add using batch
        const batch = db.batch();
        const currentUserRef = db.collection(USERS_COLLECTION).doc(currentUid);
        const friendUserRef = db.collection(USERS_COLLECTION).doc(friendUid);
        batch.update(currentUserRef, {
            friends: admin.firestore.FieldValue.arrayUnion(friendUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        batch.update(friendUserRef, {
            friends: admin.firestore.FieldValue.arrayUnion(currentUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        await batch.commit();
        return {
            success: true,
            message: 'Friend added!',
            friendUid: friendUid,
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('[addFriend] Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to add friend.');
    }
});
/**
 * Remove a friend by UID (callable function)
 * Removes the friend from both users' friends arrays reciprocally.
 */
exports.removeFriend = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to remove friends.');
    }
    const currentUid = context.auth.uid;
    const { friendUid } = data;
    if (!friendUid || typeof friendUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Friend UID is required.');
    }
    if (friendUid === currentUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid friend UID.');
    }
    try {
        // Reciprocal friend remove using batch
        const batch = db.batch();
        const currentUserRef = db.collection(USERS_COLLECTION).doc(currentUid);
        const friendUserRef = db.collection(USERS_COLLECTION).doc(friendUid);
        batch.update(currentUserRef, {
            friends: admin.firestore.FieldValue.arrayRemove(friendUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        batch.update(friendUserRef, {
            friends: admin.firestore.FieldValue.arrayRemove(currentUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        await batch.commit();
        return {
            success: true,
            message: 'Friend removed.',
        };
    }
    catch (error) {
        console.error('[removeFriend] Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to remove friend.');
    }
});
const FRIEND_REQUESTS_COLLECTION = 'friend_requests';
/**
 * Accept a friend request (callable function)
 * Adds both users to each other's friends array and deletes the request.
 */
exports.acceptFriendRequest = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to accept friend requests.');
    }
    const currentUid = context.auth.uid;
    const { requestId, fromUid } = data;
    if (!requestId || !fromUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Request ID and sender UID are required.');
    }
    try {
        // SECURITY: Fetch and validate the request document
        const requestRef = db.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Friend request not found.');
        }
        const requestData = requestDoc.data();
        // SECURITY: Verify the request was sent TO the current user
        if (requestData.toUid !== currentUid) {
            throw new functions.https.HttpsError('permission-denied', 'You can only accept requests sent to you.');
        }
        // SECURITY: Verify the request is pending
        if (requestData.status !== 'pending') {
            throw new functions.https.HttpsError('failed-precondition', 'This request has already been processed.');
        }
        // SECURITY: Verify fromUid matches the request document
        if (requestData.fromUid !== fromUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Request sender mismatch.');
        }
        // Check if already friends (defense-in-depth)
        const currentUserDoc = await db.collection(USERS_COLLECTION).doc(currentUid).get();
        const currentUserData = currentUserDoc.data();
        if ((_a = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.friends) === null || _a === void 0 ? void 0 : _a.includes(fromUid)) {
            // Already friends, just delete the request
            await requestRef.delete();
            return {
                success: true,
                message: 'Already friends. Request cleaned up.',
            };
        }
        const batch = db.batch();
        // 1. Add to both friend lists
        const currentUserRef = db.collection(USERS_COLLECTION).doc(currentUid);
        const fromUserRef = db.collection(USERS_COLLECTION).doc(fromUid);
        batch.update(currentUserRef, {
            friends: admin.firestore.FieldValue.arrayUnion(fromUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        batch.update(fromUserRef, {
            friends: admin.firestore.FieldValue.arrayUnion(currentUid),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        // 2. Delete the friend request
        batch.delete(requestRef);
        await batch.commit();
        return {
            success: true,
            message: 'Friend request accepted!',
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('[acceptFriendRequest] Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to accept friend request.');
    }
});
// ============================================
// GAME SCORE VALIDATION
// ============================================
const countries_json_1 = __importDefault(require("./data/countries.json"));
const ALL_COUNTRIES = countries_json_1.default;
// Create lookup maps for fast validation
const COUNTRY_BY_CODE = new Map();
const COUNTRY_BY_NAME = new Map();
ALL_COUNTRIES.forEach(country => {
    COUNTRY_BY_CODE.set(country.code, country);
    COUNTRY_BY_NAME.set(country.name.toLowerCase(), country);
});
const LEADERBOARD_COLLECTION = 'game_leaderboard';
/**
 * Submit and validate a game score (callable function)
 * Recalculates score server-side to prevent cheating.
 */
exports.submitGameScore = functions.https.onCall(async (data, context) => {
    var _a;
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to submit scores.');
    }
    const uid = context.auth.uid;
    const { gameType, difficulty, answers, clientScore, gameTimeMs } = data;
    // 1.5 Rate limiting check
    const rateCheck = await checkRateLimit(uid, 'scoreSubmission', RATE_LIMITS.scoreSubmission);
    if (!rateCheck.allowed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too many submissions. Please wait.');
    }
    // 2. Validate input
    if (!gameType || !['flagdash', 'pindrop'].includes(gameType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid game type.');
    }
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid difficulty.');
    }
    if (!Array.isArray(answers)) {
        throw new functions.https.HttpsError('invalid-argument', 'Answers must be an array.');
    }
    if (typeof clientScore !== 'number' || clientScore < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid score.');
    }
    // 3. Validate game time (30 seconds = 30000ms, give some buffer)
    const MAX_GAME_TIME_MS = 35000; // 35 seconds max
    if (gameTimeMs > MAX_GAME_TIME_MS) {
        console.warn(`[submitGameScore] Suspiciously long game time: ${gameTimeMs}ms from ${uid}`);
        // Don't reject, but log it
    }
    // 4. Server-side score calculation
    let serverScore = 0;
    let streak = 0;
    let validatedCorrectCount = 0;
    for (const answer of answers) {
        const country = COUNTRY_BY_CODE.get(answer.questionCode);
        if (!country) {
            console.warn(`[submitGameScore] Unknown country code: ${answer.questionCode}`);
            continue;
        }
        // Validate the answer - for flag questions, correct answer is country name
        const isActuallyCorrect = country.name.toLowerCase() === answer.selectedAnswer.toLowerCase();
        if (isActuallyCorrect) {
            // Score formula: 10 base + 2 per streak
            serverScore += 10 + (streak * 2);
            streak++;
            validatedCorrectCount++;
        }
        else {
            streak = 0;
        }
    }
    // 5. Check for score manipulation
    const scoreDifference = Math.abs(serverScore - clientScore);
    if (scoreDifference > 10) { // Allow small rounding differences
        console.warn(`[submitGameScore] Score mismatch! Client: ${clientScore}, Server: ${serverScore}, User: ${uid}`);
        // Use server score, not client score
    }
    // 6. Skip saving 0 scores
    if (serverScore <= 0) {
        return {
            success: false,
            message: 'Score too low to save.',
            serverScore: 0,
        };
    }
    // 7. Check if this beats existing high score
    const docId = `${uid}_${gameType}`;
    const existingDoc = await db.collection(LEADERBOARD_COLLECTION).doc(docId).get();
    if (existingDoc.exists) {
        const existingScore = ((_a = existingDoc.data()) === null || _a === void 0 ? void 0 : _a.score) || 0;
        if (serverScore <= existingScore) {
            return {
                success: true,
                message: 'Score saved but not a new high score.',
                serverScore,
                isNewHighScore: false,
            };
        }
    }
    // 8. Get user profile for username
    const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
    const userData = userDoc.data();
    // 9. Save the new high score
    await db.collection(LEADERBOARD_COLLECTION).doc(docId).set({
        odUid: uid,
        username: (userData === null || userData === void 0 ? void 0 : userData.username) || 'Traveller',
        photoURL: (userData === null || userData === void 0 ? void 0 : userData.avatarUrl) || null,
        score: serverScore,
        difficulty,
        gameType,
        timestamp: Date.now(),
    });
    console.log(`[submitGameScore] New high score: ${serverScore} for ${uid} on ${gameType}`);
    return {
        success: true,
        message: 'New high score!',
        serverScore,
        isNewHighScore: true,
    };
});
const CHALLENGES_COLLECTION = 'game_challenges';
/**
 * Submit and validate a challenge score (callable function)
 * - Validates time limits server-side
 * - Recalculates score
 * - Updates challenge document
 */
exports.submitChallengeScore = functions.https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to submit scores.');
    }
    const uid = context.auth.uid;
    const { challengeId, answers, clientScore, gameTimeMs } = data;
    // 2. Validate input
    if (!challengeId || typeof challengeId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid challenge ID.');
    }
    if (!Array.isArray(answers)) {
        throw new functions.https.HttpsError('invalid-argument', 'Answers must be an array.');
    }
    // 3. Get challenge document
    const challengeRef = db.collection(CHALLENGES_COLLECTION).doc(challengeId);
    const challengeDoc = await challengeRef.get();
    if (!challengeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Challenge not found.');
    }
    const challenge = challengeDoc.data();
    const isChallenger = challenge.challengerId === uid;
    const isOpponent = challenge.opponentId === uid;
    if (!isChallenger && !isOpponent) {
        throw new functions.https.HttpsError('permission-denied', 'You are not part of this challenge.');
    }
    // 4. Validate time limit (30s game + 10s buffer = 40s)
    const TIME_LIMIT_MS = 40 * 1000;
    const startedAtField = isChallenger ? 'challengerStartedAt' : 'opponentStartedAt';
    const startedAt = challenge[startedAtField];
    if (startedAt && gameTimeMs > TIME_LIMIT_MS) {
        console.warn(`[submitChallengeScore] Time exceeded: ${gameTimeMs}ms from ${uid}`);
        // Strict: Reject scores that exceed time limit
        throw new functions.https.HttpsError('failed-precondition', 'Time limit exceeded. Score rejected.');
    }
    // 5. Server-side score calculation
    let serverScore = 0;
    let streak = 0;
    for (const answer of answers) {
        const country = COUNTRY_BY_CODE.get(answer.questionCode);
        if (!country)
            continue;
        const isActuallyCorrect = country.name.toLowerCase() === answer.selectedAnswer.toLowerCase();
        if (isActuallyCorrect) {
            serverScore += 10 + (streak * 2);
            streak++;
        }
        else {
            streak = 0;
        }
    }
    // 6. Log score mismatches
    if (Math.abs(serverScore - clientScore) > 10) {
        console.warn(`[submitChallengeScore] Score mismatch! Client: ${clientScore}, Server: ${serverScore}, User: ${uid}`);
    }
    // 7. Update challenge with validated score
    const scoreField = isChallenger ? 'challengerScore' : 'opponentScore';
    const otherScoreField = isChallenger ? 'opponentScore' : 'challengerScore';
    const otherScore = challenge[otherScoreField];
    const updateData = {
        [scoreField]: serverScore,
    };
    let completed = false;
    let won;
    // Check if both players have submitted
    if (otherScore !== undefined) {
        const winnerId = serverScore > otherScore ? uid :
            otherScore > serverScore ? (isChallenger ? challenge.opponentId : challenge.challengerId) :
                null; // Tie
        updateData.status = 'completed';
        updateData.completedAt = Date.now();
        updateData.winnerId = winnerId;
        completed = true;
        won = winnerId === uid;
    }
    await challengeRef.update(updateData);
    console.log(`[submitChallengeScore] Score ${serverScore} saved for ${uid} on challenge ${challengeId}`);
    return {
        success: true,
        serverScore,
        completed,
        won,
    };
});
// ============================================
// STORY CREATION WITH LIMIT ENFORCEMENT
// ============================================
const STORIES_COLLECTION = 'stories';
const MAX_STORIES_PER_USER = 5;
const MAX_PINS_PER_STORY = 10;
/**
 * Create a story with server-side limit enforcement
 */
exports.createStory = functions.https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to create stories.');
    }
    const uid = context.auth.uid;
    const { title, description, pinIds, coverPinId } = data;
    // 1.5 Rate limiting check
    const rateCheck = await checkRateLimit(uid, 'storyCreation', RATE_LIMITS.storyCreation);
    if (!rateCheck.allowed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too many stories created. Please wait.');
    }
    // 2. Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Story title is required.');
    }
    if (!Array.isArray(pinIds) || pinIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one pin is required.');
    }
    if (pinIds.length > MAX_PINS_PER_STORY) {
        throw new functions.https.HttpsError('invalid-argument', `A story can have at most ${MAX_PINS_PER_STORY} pins.`);
    }
    // 3. Enforce story count limit
    const userStoriesSnapshot = await db
        .collection(STORIES_COLLECTION)
        .where('creatorId', '==', uid)
        .get();
    if (userStoriesSnapshot.size >= MAX_STORIES_PER_USER) {
        throw new functions.https.HttpsError('resource-exhausted', `You can only have up to ${MAX_STORIES_PER_USER} stories.`);
    }
    // 4. Create story
    const timestamp = Date.now();
    const storyRef = db.collection(STORIES_COLLECTION).doc();
    const storyData = {
        id: storyRef.id,
        creatorId: uid,
        title: title.trim(),
        description: (description === null || description === void 0 ? void 0 : description.trim()) || '',
        pinIds,
        coverPinId: coverPinId || pinIds[0],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    await storyRef.set(storyData);
    console.log(`[createStory] Created story ${storyRef.id} for ${uid}`);
    return {
        success: true,
        storyId: storyRef.id,
    };
});
// ============================================
// WAITLIST EMAIL AUTOMATION
// ============================================
// Collection name used in .document() below
// const WAITLIST_COLLECTION = 'waitlist';
// Email configuration - store these in Firebase environment config
// firebase functions:config:set resend.api_key="YOUR_RESEND_API_KEY"
const getResendApiKey = () => { var _a; return ((_a = functions.config().resend) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.RESEND_API_KEY; };
/**
 * Triggered when someone joins the waitlist
 * Sends a personalized welcome email with download link based on their platform
 */
exports.onWaitlistSignup = functions.firestore
    .document('waitlist/{email}')
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const email = context.params.email;
    // Skip if email already sent (shouldn't happen on create, but safety check)
    if (data.emailSent) {
        console.log(`[onWaitlistSignup] Email already sent to ${email}, skipping`);
        return;
    }
    const platform = data.platform || 'unknown';
    console.log(`[onWaitlistSignup] New signup: ${email} (${platform})`);
    // Platform detection for personalized messaging
    const LANDING_PAGE = 'https://getpinr.com';
    let platformText = 'your device';
    if (platform === 'android') {
        platformText = 'Android';
    }
    else if (platform === 'ios') {
        platformText = 'iOS';
    }
    // Build the waitlist confirmation email
    // NOTE: When app stores are ready, update this to include download links
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <img src="https://getpinr.com/assets/pinr-logo.png" alt="Pinr" style="width: 80px; height: auto; margin-bottom: 20px; border-radius: 16px;">
        <h1 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px;">You're on the list! 🎉</h1>
        
        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px;">
            Lee here from Pinr, thanks for signing up! I built Pinr to create a fun way to share travel photos, connect with friends, and explore your next trip.
        </p>
        
        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px;">
            Did you spot my signature, <strong>BuiltByLee</strong>, on the sign-up page? This is my personal seal of quality, your guarantee that Pinr has been built with performance, privacy, and security in mind.
        </p>
        
        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px;">
            I noticed you're on <strong>${platformText}</strong>. I'm putting the finishing touches on the app and will email you the moment it's ready to download. You'll be one of the first to try it!
        </p>
        
        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px;">
            In the meantime, feel free to reply to this email if you have any questions or feature ideas – I read every message.
        </p>
        
        <p style="color: #8e8e93; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
            See you on the map soon! 🗺️<br>
            – Lee
        </p>
    </div>
    
    <p style="color: #8e8e93; font-size: 12px; text-align: center; margin-top: 24px;">
        <a href="${LANDING_PAGE}" style="color: #8e8e93;">Pinr</a> • Travel Made Social
    </p>
</body>
</html>
        `.trim();
    const resendApiKey = getResendApiKey();
    if (!resendApiKey) {
        console.error('[onWaitlistSignup] No Resend API key configured. Set it with: firebase functions:config:set resend.api_key="YOUR_KEY"');
        return;
    }
    try {
        // Send email via Resend API
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Pinr <lee@getpinr.com>',
                to: [email],
                subject: "You're in! 🎉 Download Pinr",
                html: emailHtml,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[onWaitlistSignup] Resend API error: ${response.status} - ${errorBody}`);
            return;
        }
        const result = await response.json();
        console.log(`[onWaitlistSignup] Email sent to ${email}, ID: ${result.id}`);
        // Mark email as sent
        await snapshot.ref.update({ emailSent: true });
    }
    catch (error) {
        console.error('[onWaitlistSignup] Failed to send email:', error.message);
    }
});
//# sourceMappingURL=index.js.map