/**
 * Firebase Cloud Functions for Pinr
 * 
 * Handles friend operations that require updating multiple user profiles.
 * Using Cloud Functions with admin SDK bypasses Firestore security rules,
 * allowing reciprocal friend updates while keeping client-side rules strict.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const USERS_COLLECTION = 'users';

// ============================================
// APPLE SIGN IN FUNCTIONS
// ============================================

const APPLE_CLIENT_ID = 'com.builtbylee.app80days.service';
const APPLE_REDIRECT_URI = 'https://us-central1-days-c4ad4.cloudfunctions.net/appleAuthCallback';

/**
 * Generate Apple Auth URL (for Android)
 */
export const getAppleAuthUrl = functions.https.onCall(async (data, context) => {
    const state = data.state || 'init';
    const nonce = data.nonce || 'nonce';

    // Construct the Apple OAuth URL
    const url = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${APPLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(APPLE_REDIRECT_URI)}&` +
        `response_type=code&` +
        `response_mode=form_post&` + // Important: Apple requires form_post for scopes
        `scope=name%20email&` +
        `state=${state}&` +
        `nonce=${nonce}`;

    return { url };
});

/**
 * Apple Auth Callback
 * Apple posts the code here. We redirect back to the app.
 */
export const appleAuthCallback = functions.https.onRequest(async (req, res) => {
    const { code, state, error } = req.body;

    if (error) {
        console.error('[appleAuthCallback] Apple returned error:', error);
        res.redirect(`https://getpinr.com/auth/apple/callback?error=${error}`);
        return;
    }

    if (!code) {
        console.error('[appleAuthCallback] No code returned');
        res.redirect(`https://getpinr.com/auth/apple/callback?error=no_code`);
        return;
    }

    console.log(`[appleAuthCallback] Received code from Apple. Redirecting to app.`);
    // Redirect to the app's deep link / universal link handler
    res.redirect(`https://getpinr.com/auth/apple/callback?code=${code}&state=${state}`);
});

/**
 * Save iOS Apple Authorization Code
 * Used by the iOS client to store the auth code for backend processing/refresh token generation
 */
export const saveiOSAppleAuth = functions.https.onCall(async (data: { code: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code is required.');
    }

    const uid = context.auth.uid;
    console.log(`[saveiOSAppleAuth] Saving auth code for user: ${uid}`);

    try {
        // Store in a private subcollection or document
        await db.collection('users').doc(uid).collection('private').doc('apple_auth').set({
            authorizationCode: code,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            platform: 'ios'
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error('[saveiOSAppleAuth] Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to save auth code.');
    }
});

/**
 * Exchange Apple Auth Code (Android/Generic)
 * Used to exchange the auth code for a refresh token directly on the backend
 */
export const exchangeAppleAuthCode = functions.https.onCall(async (data: { code: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code is required.');
    }

    const uid = context.auth.uid;
    console.log(`[exchangeAppleAuthCode] Exchanging auth code for user: ${uid}`);

    // Note: Actual exchange logic requires Apple Client Secret generation which involves private keys.
    // For now, we will store the code just like on iOS so we can process it later or via a separate service.
    // Logic for generating client_secret is complex and requires the APPLE_PRIVATE_KEY from apple-config.ts
    // (We will assume that is handled by a separate background trigger or manual admin process if needed for now, 
    // or add the full implementation if the user specifically requests the full refresh token flow).

    // Storing it is the critical first step to prevent data loss.
    try {
        await db.collection('users').doc(uid).collection('private').doc('apple_auth').set({
            authorizationCode: code,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            platform: 'android'
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error('[exchangeAppleAuthCode] Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to save auth code.');
    }
});

// ============================================
// RATE LIMITING UTILITY
// ============================================
const RATE_LIMIT_COLLECTION = 'rate_limits';

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;  // Time window in milliseconds
}

/**
 * Simple rate limiter using Firestore
 * Tracks requests per user per action type
 */
async function checkRateLimit(
    uid: string,
    action: string,
    config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
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
    } catch (error) {
        console.error('[RateLimit] Error checking rate limit:', error);
        // Fail open to avoid blocking legitimate users
        return { allowed: true, remaining: config.maxRequests };
    }
}

// Rate limit configurations
const RATE_LIMITS = {
    scoreSubmission: { maxRequests: 30, windowMs: 60 * 1000 },  // 30 per minute
    storyCreation: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    friendRequest: { maxRequests: 20, windowMs: 60 * 1000 },    // 20 per minute
};

interface AddFriendData {
    friendUsername: string;
}

interface RemoveFriendData {
    friendUid: string;
}

/**
 * Add a friend by username (callable function)
 * Adds the friend to both users' friends arrays reciprocally.
 */
export const addFriend = functions.https.onCall(async (data: AddFriendData, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to add friends.'
        );
    }

    const currentUid = context.auth.uid;
    const { friendUsername } = data;

    if (!friendUsername || typeof friendUsername !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Friend username is required.'
        );
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
            throw new functions.https.HttpsError(
                'not-found',
                'User not found.'
            );
        }

        const friendDoc = snapshot.docs[0];
        const friendUid = friendDoc.id;

        if (friendUid === currentUid) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'You cannot add yourself as a friend.'
            );
        }

        // Check if already friends
        const currentUserDoc = await db.collection(USERS_COLLECTION).doc(currentUid).get();
        const currentUserData = currentUserDoc.data();
        if (currentUserData?.friends?.includes(friendUid)) {
            throw new functions.https.HttpsError(
                'already-exists',
                'You are already friends with this user.'
            );
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
    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('[addFriend] Error:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to add friend.'
        );
    }
});

/**
 * Remove a friend by UID (callable function)
 * Removes the friend from both users' friends arrays reciprocally.
 */
export const removeFriend = functions.https.onCall(async (data: RemoveFriendData, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to remove friends.'
        );
    }

    const currentUid = context.auth.uid;
    const { friendUid } = data;

    if (!friendUid || typeof friendUid !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Friend UID is required.'
        );
    }

    if (friendUid === currentUid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid friend UID.'
        );
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
    } catch (error: any) {
        console.error('[removeFriend] Error:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to remove friend.'
        );
    }
});

interface AcceptFriendRequestData {
    requestId: string;
    fromUid: string;
}

const FRIEND_REQUESTS_COLLECTION = 'friend_requests';

/**
 * Accept a friend request (callable function)
 * Adds both users to each other's friends array and deletes the request.
 */
export const acceptFriendRequest = functions.https.onCall(async (data: AcceptFriendRequestData, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to accept friend requests.'
        );
    }

    const currentUid = context.auth.uid;
    const { requestId, fromUid } = data;

    if (!requestId || !fromUid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Request ID and sender UID are required.'
        );
    }

    try {
        // SECURITY: Fetch and validate the request document
        const requestRef = db.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Friend request not found.'
            );
        }

        const requestData = requestDoc.data() as any;

        // SECURITY: Verify the request was sent TO the current user
        if (requestData.toUid !== currentUid) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'You can only accept requests sent to you.'
            );
        }

        // SECURITY: Verify the request is pending
        if (requestData.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'This request has already been processed.'
            );
        }

        // SECURITY: Verify fromUid matches the request document
        if (requestData.fromUid !== fromUid) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Request sender mismatch.'
            );
        }

        // Check if already friends (defense-in-depth)
        const currentUserDoc = await db.collection(USERS_COLLECTION).doc(currentUid).get();
        const currentUserData = currentUserDoc.data();
        if (currentUserData?.friends?.includes(fromUid)) {
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
    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('[acceptFriendRequest] Error:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to accept friend request.'
        );
    }
});

// ============================================
// GAME SCORE VALIDATION
// ============================================

import countriesData from './data/countries.json';

interface Country {
    code: string;
    name: string;
    capital: string;
}

const ALL_COUNTRIES: Country[] = countriesData as Country[];

// Create lookup maps for fast validation
const COUNTRY_BY_CODE = new Map<string, Country>();
const COUNTRY_BY_NAME = new Map<string, Country>();
ALL_COUNTRIES.forEach(country => {
    COUNTRY_BY_CODE.set(country.code, country);
    COUNTRY_BY_NAME.set(country.name.toLowerCase(), country);
});

type GameType = 'flagdash' | 'pindrop';
type Difficulty = 'easy' | 'medium' | 'hard';

interface GameAnswer {
    questionCode: string;  // Country code for flag questions
    selectedAnswer: string; // User's selected answer (country name)
    isCorrect: boolean;     // Client-claimed correctness (we verify this)
}

interface SubmitGameScoreData {
    gameType: GameType;
    difficulty: Difficulty;
    answers: GameAnswer[];
    clientScore: number;  // Client's calculated score (we recalculate)
    gameTimeMs: number;   // How long the game took
}

const LEADERBOARD_COLLECTION = 'game_leaderboard';

/**
 * Submit and validate a game score (callable function)
 * Recalculates score server-side to prevent cheating.
 */
export const submitGameScore = functions.https.onCall(async (data: SubmitGameScoreData, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to submit scores.'
        );
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
        } else {
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
        const existingScore = existingDoc.data()?.score || 0;
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
        username: userData?.username || 'Traveller',
        photoURL: userData?.avatarUrl || null,
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

// ============================================
// CHALLENGE SCORE VALIDATION
// ============================================

interface SubmitChallengeScoreData {
    challengeId: string;
    answers: Array<{ questionCode: string; selectedAnswer: string; isCorrect: boolean }>;
    clientScore: number;
    gameTimeMs: number;
}

const CHALLENGES_COLLECTION = 'game_challenges';

/**
 * Submit and validate a challenge score (callable function)
 * - Validates time limits server-side
 * - Recalculates score
 * - Updates challenge document
 */
export const submitChallengeScore = functions.https.onCall(async (data: SubmitChallengeScoreData, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to submit scores.'
        );
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

    const challenge = challengeDoc.data() as any;
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
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Time limit exceeded. Score rejected.'
        );
    }

    // 5. Server-side score calculation
    let serverScore = 0;
    let streak = 0;

    for (const answer of answers) {
        const country = COUNTRY_BY_CODE.get(answer.questionCode);
        if (!country) continue;

        const isActuallyCorrect = country.name.toLowerCase() === answer.selectedAnswer.toLowerCase();

        if (isActuallyCorrect) {
            serverScore += 10 + (streak * 2);
            streak++;
        } else {
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

    const updateData: any = {
        [scoreField]: serverScore,
    };

    let completed = false;
    let won: boolean | undefined;

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

interface CreateStoryData {
    title: string;
    description?: string;
    pinIds: string[];
    coverPinId?: string;
}

/**
 * Create a story with server-side limit enforcement
 */
export const createStory = functions.https.onCall(async (data: CreateStoryData, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to create stories.'
        );
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
        throw new functions.https.HttpsError(
            'invalid-argument',
            `A story can have at most ${MAX_PINS_PER_STORY} pins.`
        );
    }

    // 3. Enforce story count limit
    const userStoriesSnapshot = await db
        .collection(STORIES_COLLECTION)
        .where('creatorId', '==', uid)
        .get();

    if (userStoriesSnapshot.size >= MAX_STORIES_PER_USER) {
        throw new functions.https.HttpsError(
            'resource-exhausted',
            `You can only have up to ${MAX_STORIES_PER_USER} stories.`
        );
    }

    // 4. Create story
    const timestamp = Date.now();
    const storyRef = db.collection(STORIES_COLLECTION).doc();

    const storyData = {
        id: storyRef.id,
        creatorId: uid,
        title: title.trim(),
        description: description?.trim() || '',
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
const getResendApiKey = () => functions.config().resend?.api_key || process.env.RESEND_API_KEY;

interface WaitlistEntry {
    email: string;
    platform: string;
    userAgent?: string;
    joinedAt: admin.firestore.Timestamp;
    emailSent: boolean;
    source: string;
}

/**
 * Triggered when someone joins the waitlist
 * Sends a personalized welcome email with download link based on their platform
 */
export const onWaitlistSignup = functions.firestore
    .document('waitlist/{email}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() as WaitlistEntry;
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
        } else if (platform === 'ios') {
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

        } catch (error: any) {
            console.error('[onWaitlistSignup] Failed to send email:', error.message);
        }
    });

// ============================================
// CONTENT MODERATION FUNCTIONS
// ============================================

// Admin UID(s) - add your Firebase UID here
const ADMIN_UIDS = ['FVgteJzI1VTVSSQIfNXk5I85Zpj1']; // lee.sam78@gmail.com
const ADMIN_EMAIL = 'lee.sam78@gmail.com'; // Email for report notifications

/**
 * Ban a user (admin only)
 * Sets banned: true on user profile and optionally deletes their content
 */
export const banUser = functions.https.onCall(async (data, context) => {
    // Check admin authentication
    if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can ban users.'
        );
    }

    const { userId, deleteContent = false } = data;

    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'userId is required.'
        );
    }

    try {
        // Update user document
        await db.collection(USERS_COLLECTION).doc(userId).update({
            banned: true,
            bannedAt: admin.firestore.FieldValue.serverTimestamp(),
            bannedBy: context.auth.uid,
        });

        // Optionally delete user's pins
        if (deleteContent) {
            const pinsSnapshot = await db.collection('pins')
                .where('creatorId', '==', userId)
                .get();

            const batch = db.batch();
            pinsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            console.log(`[banUser] Deleted ${pinsSnapshot.size} pins for user ${userId}`);
        }

        console.log(`[banUser] User ${userId} banned by ${context.auth.uid}`);
        return { success: true, message: 'User banned successfully.' };

    } catch (error: any) {
        console.error('[banUser] Error:', error.message);
        throw new functions.https.HttpsError('internal', 'Failed to ban user.');
    }
});

/**
 * Unban a user (admin only)
 */
export const unbanUser = functions.https.onCall(async (data, context) => {
    if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can unban users.'
        );
    }

    const { userId } = data;

    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'userId is required.'
        );
    }

    try {
        await db.collection(USERS_COLLECTION).doc(userId).update({
            banned: false,
            unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
            unbannedBy: context.auth.uid,
        });

        console.log(`[unbanUser] User ${userId} unbanned by ${context.auth.uid}`);
        return { success: true, message: 'User unbanned successfully.' };

    } catch (error: any) {
        console.error('[unbanUser] Error:', error.message);
        throw new functions.https.HttpsError('internal', 'Failed to unban user.');
    }
});

/**
 * Check if current user is banned
 * Called on app startup to prevent banned users from accessing
 */
export const checkBanStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Must be authenticated.'
        );
    }

    try {
        const userDoc = await db.collection(USERS_COLLECTION).doc(context.auth.uid).get();
        const userData = userDoc.data();

        return {
            banned: userData?.banned === true,
            message: userData?.banned ? 'Your account has been suspended.' : null,
        };

    } catch (error: any) {
        console.error('[checkBanStatus] Error:', error.message);
        return { banned: false };
    }
});

/**
 * Admin delete a pin (for removing reported content)
 */
export const adminDeletePin = functions.https.onCall(async (data, context) => {
    if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can delete pins.'
        );
    }

    const { pinId } = data;

    if (!pinId || typeof pinId !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'pinId is required.'
        );
    }

    try {
        await db.collection('pins').doc(pinId).delete();
        console.log(`[adminDeletePin] Pin ${pinId} deleted by ${context.auth.uid}`);
        return { success: true };

    } catch (error: any) {
        console.error('[adminDeletePin] Error:', error.message);
        throw new functions.https.HttpsError('internal', 'Failed to delete pin.');
    }
});

/**
 * Moderate an image using Google Cloud Vision API
 * Call this before saving an image to check for explicit content
 * 
 * NOTE: Requires Cloud Vision API to be enabled in your GCP project
 * https://console.cloud.google.com/apis/library/vision.googleapis.com
 */
export const moderateImage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Must be authenticated.'
        );
    }

    const { imageUrl } = data;

    if (!imageUrl || typeof imageUrl !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'imageUrl is required.'
        );
    }

    try {
        // Import Vision client
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient();

        // Analyze image for safe search annotations
        const [result] = await client.safeSearchDetection(imageUrl);
        const safeSearch = result.safeSearchAnnotation;

        if (!safeSearch) {
            return { approved: true, reason: null };
        }

        // Check for explicit content
        // Likelihood levels: UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY
        const BLOCK_LEVELS = ['LIKELY', 'VERY_LIKELY'];

        const issues: string[] = [];

        if (BLOCK_LEVELS.includes(safeSearch.adult)) {
            issues.push('adult content');
        }
        if (BLOCK_LEVELS.includes(safeSearch.violence)) {
            issues.push('violent content');
        }
        if (BLOCK_LEVELS.includes(safeSearch.racy)) {
            issues.push('racy content');
        }

        if (issues.length > 0) {
            console.log(`[moderateImage] Image blocked: ${issues.join(', ')}`);
            return {
                approved: false,
                reason: `Image contains ${issues.join(', ')}.`,
            };
        }

        return { approved: true, reason: null };

    } catch (error: any) {
        console.error('[moderateImage] Error:', error.message);
        // On error, allow the image (fail open) but log for review
        // In production, you may want to fail closed instead
        return { approved: true, reason: null, error: 'Moderation check failed' };
    }
});

/**
 * Triggered when a new report is created
 * - Sends email notification to admin
 * - Auto-hides reported pin (sets underReview: true)
 */
export const onReportCreated = functions.firestore
    .document('reports/{reportId}')
    .onCreate(async (snapshot, context) => {
        const reportData = snapshot.data();
        const reportId = context.params.reportId;

        console.log(`[onReportCreated] New report ${reportId}:`, reportData.reason);

        try {
            // Get reporter info
            const reporterDoc = await db.collection(USERS_COLLECTION).doc(reportData.reporterId).get();
            const reporterData = reporterDoc.data();
            const reporterName = reporterData?.displayName || reporterData?.username || 'Unknown User';

            // Build report details
            let reportSubject = '';
            let reportDetails = '';
            let targetLink = '';

            if (reportData.reportedPinId) {
                // Pin report - auto-hide the pin
                const pinDoc = await db.collection('pins').doc(reportData.reportedPinId).get();
                const pinData = pinDoc.data();

                // Mark pin as under review
                await db.collection('pins').doc(reportData.reportedPinId).update({
                    underReview: true,
                    reviewTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                reportSubject = `🚨 Pin Reported: ${pinData?.title || 'Untitled'}`;
                reportDetails = `
                    <p><strong>Pin Title:</strong> ${pinData?.title || 'Untitled'}</p>
                    <p><strong>Pin Location:</strong> ${pinData?.locationName || 'Unknown'}</p>
                    <p><strong>Pin Creator:</strong> ${pinData?.creatorName || 'Unknown'}</p>
                `;
                targetLink = `https://console.firebase.google.com/project/days-c4ad4/firestore/data/~2Fpins~2F${reportData.reportedPinId}`;

                console.log(`[onReportCreated] Pin ${reportData.reportedPinId} marked as under review`);
            } else if (reportData.reportedUserId) {
                // User report
                const userDoc = await db.collection(USERS_COLLECTION).doc(reportData.reportedUserId).get();
                const userData = userDoc.data();

                reportSubject = `🚨 User Reported: ${userData?.displayName || userData?.username || 'Unknown'}`;
                reportDetails = `
                    <p><strong>Reported User:</strong> ${userData?.displayName || userData?.username || 'Unknown'}</p>
                    <p><strong>User ID:</strong> ${reportData.reportedUserId}</p>
                `;
                targetLink = `https://console.firebase.google.com/project/days-c4ad4/firestore/data/~2Fusers~2F${reportData.reportedUserId}`;
            }

            // Send email to admin
            const resendApiKey = functions.config().resend?.api_key;
            if (!resendApiKey) {
                console.error('[onReportCreated] RESEND_API_KEY not configured');
                return;
            }

            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 16px; color: #DC2626;">${reportSubject}</h2>
        
        <p><strong>Reason:</strong> ${reportData.reason}</p>
        ${reportData.description ? `<p><strong>Details:</strong> ${reportData.description}</p>` : ''}
        <p><strong>Reported by:</strong> ${reporterName}</p>
        <p><strong>Report ID:</strong> ${reportId}</p>
        
        ${reportDetails}
    </div>
    
    <div style="margin-top: 20px;">
        <a href="${targetLink}" style="display: inline-block; background: #DC2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in Firebase Console</a>
    </div>
    
    <p style="margin-top: 20px; color: #6B7280; font-size: 14px;">
        ${reportData.reportedPinId ? '⚠️ This pin has been automatically hidden from public view until reviewed.' : ''}
    </p>
</body>
</html>
            `;

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'Pinr Moderation <lee@getpinr.com>',
                    to: [ADMIN_EMAIL],
                    subject: reportSubject,
                    html: emailHtml,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[onReportCreated] Email error: ${response.status} - ${errorBody}`);
                return;
            }

            console.log(`[onReportCreated] Admin notification sent for report ${reportId}`);

        } catch (error: any) {
            console.error('[onReportCreated] Error:', error.message);
        }
    });

/**
 * Approve a reported pin (admin only)
 * Removes underReview flag and marks report as resolved
 */
export const approveReportedPin = functions.https.onCall(async (data, context) => {
    if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can approve pins.'
        );
    }

    const { pinId, reportId } = data;

    if (!pinId) {
        throw new functions.https.HttpsError('invalid-argument', 'pinId is required.');
    }

    try {
        // Remove underReview flag from pin
        await db.collection('pins').doc(pinId).update({
            underReview: false,
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: context.auth.uid,
        });

        // Update report status if provided
        if (reportId) {
            await db.collection('reports').doc(reportId).update({
                status: 'resolved',
                resolution: 'approved',
                resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
                resolvedBy: context.auth.uid,
            });
        }

        console.log(`[approveReportedPin] Pin ${pinId} approved by ${context.auth.uid}`);
        return { success: true };

    } catch (error: any) {
        console.error('[approveReportedPin] Error:', error.message);
        throw new functions.https.HttpsError('internal', 'Failed to approve pin.');
    }
});

/**
 * Reject a reported pin (admin only) - deletes the pin
 */
export const rejectReportedPin = functions.https.onCall(async (data, context) => {
    if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can reject pins.'
        );
    }

    const { pinId, reportId } = data;

    if (!pinId) {
        throw new functions.https.HttpsError('invalid-argument', 'pinId is required.');
    }

    try {
        // Delete the pin
        await db.collection('pins').doc(pinId).delete();

        // Update report status if provided
        if (reportId) {
            await db.collection('reports').doc(reportId).update({
                status: 'resolved',
                resolution: 'rejected',
                resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
                resolvedBy: context.auth.uid,
            });
        }

        console.log(`[rejectReportedPin] Pin ${pinId} deleted by ${context.auth.uid}`);
        return { success: true };

    } catch (error: any) {
        console.error('[rejectReportedPin] Error:', error.message);
        throw new functions.https.HttpsError('internal', 'Failed to reject pin.');
    }
});
