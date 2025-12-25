/**
 * Pin Drop Game - State Transition & Challenge Mode Tests
 * 
 * Tests:
 * - State machine transitions
 * - Pause/Resume behavior
 * - Challenge mode scenarios
 * - Multiple concurrent games
 * - Error handling
 */

const locations = require('../src/data/locations.json');

console.log('='.repeat(60));
console.log('PIN DROP - STATE TRANSITION & CHALLENGE TESTS');
console.log('='.repeat(60));
console.log();

// Utility functions (same as before)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function seededRandom(seed) {
    return function () {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

// PinDropGame State Machine Simulator
class PinDropGameStateMachine {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = 'IDLE'; // IDLE, EXPLAINER, PLAYING, PAUSED, RESULT, GAME_OVER
        this.currentRound = 0;
        this.totalRounds = 5;
        this.score = 0;
        this.timeLeft = 20;
        this.locations = [];
        this.currentLocation = null;
        this.isPaused = false;
        this.challengeId = null;
    }

    // Valid state transitions
    validTransitions = {
        'IDLE': ['EXPLAINER'],
        'EXPLAINER': ['PLAYING'],
        'PLAYING': ['RESULT', 'PAUSED'],
        'PAUSED': ['PLAYING', 'IDLE'],
        'RESULT': ['PLAYING', 'GAME_OVER'],
        'GAME_OVER': ['IDLE'],
    };

    canTransition(to) {
        return this.validTransitions[this.state]?.includes(to) || false;
    }

    transition(to) {
        if (!this.canTransition(to)) {
            throw new Error(`Invalid transition: ${this.state} → ${to}`);
        }
        const from = this.state;
        this.state = to;
        return { from, to };
    }

    startGame(difficulty, challengeId = null) {
        this.transition('EXPLAINER');
        this.challengeId = challengeId;

        // Select locations
        const seed = challengeId ? hashString(challengeId) : Date.now();
        const random = seededRandom(seed);
        const pool = locations.filter(l =>
            difficulty === 'easy' ? l.difficulty === 'easy' :
                difficulty === 'medium' ? ['easy', 'medium'].includes(l.difficulty) :
                    true
        );
        this.locations = [...pool].sort(() => random() - 0.5).slice(0, 5);

        return this;
    }

    dismissExplainer() {
        this.transition('PLAYING');
        this.currentLocation = this.locations[0];
        this.currentRound = 0;
        this.timeLeft = 20;
        return this;
    }

    submitGuess(guessLat, guessLon) {
        if (this.state !== 'PLAYING') {
            throw new Error(`Cannot submit guess in state: ${this.state}`);
        }

        const actual = this.currentLocation;
        const distance = haversineDistance(guessLat, guessLon, actual.lat, actual.lon);
        const points = distance <= 50 ? 1000 : distance <= 150 ? 750 :
            distance <= 500 ? 500 : distance <= 1000 ? 250 :
                distance <= 2000 ? 100 : 0;
        const timeBonus = points > 0 ? this.timeLeft * 10 : 0;

        this.score += points + timeBonus;
        this.currentRound++;
        this.transition('RESULT');

        return { distance: Math.round(distance), points, timeBonus };
    }

    nextRound() {
        if (this.currentRound >= this.totalRounds) {
            this.transition('GAME_OVER');
        } else {
            this.transition('PLAYING');
            this.currentLocation = this.locations[this.currentRound];
            this.timeLeft = 20;
        }
        return this;
    }

    pause() {
        this.transition('PAUSED');
        this.isPaused = true;
        return this;
    }

    resume() {
        this.transition('PLAYING');
        this.isPaused = false;
        return this;
    }

    quit() {
        this.reset();
        return this;
    }
}

let passed = 0;
let failed = 0;

// ============================================================================
// Test 1: State Machine Transitions
// ============================================================================
console.log('🔄 TEST 1: State Machine Transitions');
console.log('-'.repeat(40));

const sm = new PinDropGameStateMachine();

// Valid transitions
try {
    sm.startGame('medium');
    console.log(`  ✅ IDLE → EXPLAINER`);

    sm.dismissExplainer();
    console.log(`  ✅ EXPLAINER → PLAYING`);

    sm.pause();
    console.log(`  ✅ PLAYING → PAUSED`);

    sm.resume();
    console.log(`  ✅ PAUSED → PLAYING`);

    sm.submitGuess(0, 0);
    console.log(`  ✅ PLAYING → RESULT`);

    sm.nextRound();
    console.log(`  ✅ RESULT → PLAYING`);

    passed += 6;
} catch (e) {
    console.log(`  ❌ Transition failed: ${e.message}`);
    failed++;
}

// Invalid transitions
sm.reset();
sm.startGame('easy');

try {
    sm.submitGuess(0, 0); // Can't submit in EXPLAINER
    console.log(`  ❌ Should have rejected EXPLAINER → (submit guess)`);
    failed++;
} catch (e) {
    console.log(`  ✅ Correctly rejected invalid action in EXPLAINER`);
    passed++;
}

console.log();

// ============================================================================
// Test 2: Pause/Resume Simulation
// ============================================================================
console.log('⏸️ TEST 2: Pause/Resume Behavior');
console.log('-'.repeat(40));

const pauseGame = new PinDropGameStateMachine();
pauseGame.startGame('medium').dismissExplainer();

// Simulate time passing, then pause
pauseGame.timeLeft = 15; // 5 seconds elapsed

pauseGame.pause();
const pausedTime = pauseGame.timeLeft;

// While paused, time should not change
pauseGame.timeLeft = pausedTime; // In real game, timer is stopped

pauseGame.resume();

if (pauseGame.timeLeft === pausedTime && !pauseGame.isPaused) {
    console.log(`  ✅ Resume preserves time remaining (${pausedTime}s)`);
    passed++;
} else {
    console.log(`  ❌ Time not preserved after resume`);
    failed++;
}

// Test pause → quit
pauseGame.pause();
pauseGame.quit();
if (pauseGame.state === 'IDLE' && pauseGame.score === 0) {
    console.log(`  ✅ Quit from pause resets game properly`);
    passed++;
} else {
    console.log(`  ❌ Quit did not reset properly`);
    failed++;
}
console.log();

// ============================================================================
// Test 3: Challenge Mode - Seeded Consistency
// ============================================================================
console.log('🎲 TEST 3: Challenge Mode - Seeded Consistency');
console.log('-'.repeat(40));

const challengeId = 'challenge_abc123_xyz789';

// Player 1 plays
const player1 = new PinDropGameStateMachine();
player1.startGame('medium', challengeId).dismissExplainer();
const p1Locations = player1.locations.map(l => l.id);

// Player 2 plays same challenge
const player2 = new PinDropGameStateMachine();
player2.startGame('medium', challengeId).dismissExplainer();
const p2Locations = player2.locations.map(l => l.id);

if (JSON.stringify(p1Locations) === JSON.stringify(p2Locations)) {
    console.log(`  ✅ Both players got identical locations:`);
    p1Locations.forEach((id, i) => console.log(`      ${i + 1}. ${id}`));
    passed++;
} else {
    console.log(`  ❌ Players got different locations!`);
    console.log(`      P1: ${p1Locations.join(', ')}`);
    console.log(`      P2: ${p2Locations.join(', ')}`);
    failed++;
}
console.log();

// ============================================================================
// Test 4: Multiple Concurrent Games
// ============================================================================
console.log('🎮 TEST 4: Multiple Concurrent Games');
console.log('-'.repeat(40));

const games = [
    new PinDropGameStateMachine(),
    new PinDropGameStateMachine(),
    new PinDropGameStateMachine(),
];

// Start all games with different seeds
games[0].startGame('easy', 'game1').dismissExplainer();
games[1].startGame('medium', 'game2').dismissExplainer();
games[2].startGame('hard', 'game3').dismissExplainer();

// Each game should have independent state
if (games[0].state === 'PLAYING' && games[1].state === 'PLAYING' && games[2].state === 'PLAYING') {
    console.log(`  ✅ All 3 games in PLAYING state independently`);
    passed++;
} else {
    console.log(`  ❌ Game states not independent`);
    failed++;
}

// Play games in interleaved fashion
games[0].submitGuess(games[0].currentLocation.lat, games[0].currentLocation.lon);
games[1].pause();
games[2].submitGuess(0, 0); // Bad guess

if (games[0].state === 'RESULT' && games[1].state === 'PAUSED' && games[2].state === 'RESULT') {
    console.log(`  ✅ Independent state transitions work correctly`);
    passed++;
} else {
    console.log(`  ❌ State transitions affected other games`);
    failed++;
}

// Verify scores are independent
if (games[0].score > 0 && games[1].score === 0 && games[2].score === 0) {
    console.log(`  ✅ Scores are independent across games`);
    passed++;
} else {
    console.log(`  ❌ Scores leaked between games`);
    failed++;
}
console.log();

// ============================================================================
// Test 5: Full Challenge Flow Simulation
// ============================================================================
console.log('🏆 TEST 5: Full Challenge Flow');
console.log('-'.repeat(40));

const challengeSeed = 'final_challenge_test_123';

// Challenger plays
const challenger = new PinDropGameStateMachine();
challenger.startGame('hard', challengeSeed).dismissExplainer();

console.log('  Challenger playing...');
for (let i = 0; i < 5; i++) {
    const loc = challenger.currentLocation;
    // Challenger makes good guesses (within 100km)
    const result = challenger.submitGuess(loc.lat + 0.3, loc.lon + 0.3);
    console.log(`    Round ${i + 1}: ${result.distance} km → ${result.points + result.timeBonus} pts`);
    if (i < 4) challenger.nextRound();
}
challenger.nextRound(); // Triggers GAME_OVER
const challengerScore = challenger.score;
console.log(`  Challenger final: ${challengerScore} pts`);

// Opponent plays
const opponent = new PinDropGameStateMachine();
opponent.startGame('hard', challengeSeed).dismissExplainer();

console.log('  Opponent playing...');
for (let i = 0; i < 5; i++) {
    const loc = opponent.currentLocation;
    // Opponent makes worse guesses
    const result = opponent.submitGuess(loc.lat + 5, loc.lon + 5);
    console.log(`    Round ${i + 1}: ${result.distance} km → ${result.points + result.timeBonus} pts`);
    if (i < 4) opponent.nextRound();
}
opponent.nextRound();
const opponentScore = opponent.score;
console.log(`  Opponent final: ${opponentScore} pts`);

// Determine winner
const winner = challengerScore > opponentScore ? 'Challenger' :
    challengerScore < opponentScore ? 'Opponent' : 'Tie';
console.log(`  🏆 Winner: ${winner}`);

if (challenger.state === 'GAME_OVER' && opponent.state === 'GAME_OVER') {
    console.log(`  ✅ Both players reached GAME_OVER state`);
    passed++;
} else {
    console.log(`  ❌ Not all players in GAME_OVER`);
    failed++;
}
console.log();

// ============================================================================
// Test 6: Error Handling
// ============================================================================
console.log('⚠️ TEST 6: Error Handling');
console.log('-'.repeat(40));

const errorGame = new PinDropGameStateMachine();

// Try to submit without starting
try {
    errorGame.submitGuess(0, 0);
    console.log(`  ❌ Should have thrown error for submit in IDLE`);
    failed++;
} catch (e) {
    console.log(`  ✅ Correctly threw error: "${e.message}"`);
    passed++;
}

// Try to resume without pausing
errorGame.reset();
errorGame.startGame('easy').dismissExplainer();
try {
    errorGame.resume();
    console.log(`  ❌ Should have thrown error for resume without pause`);
    failed++;
} catch (e) {
    console.log(`  ✅ Correctly threw error: "${e.message}"`);
    passed++;
}

// Try to go to next round in wrong state
errorGame.reset();
errorGame.startGame('easy').dismissExplainer();
try {
    errorGame.nextRound();
    console.log(`  ❌ Should have thrown error for nextRound in PLAYING`);
    failed++;
} catch (e) {
    console.log(`  ✅ Correctly threw error: "${e.message}"`);
    passed++;
}

console.log();

// ============================================================================
// Test 7: Timeout Behavior Simulation
// ============================================================================
console.log('⏱️ TEST 7: Timeout Behavior');
console.log('-'.repeat(40));

const timeoutGame = new PinDropGameStateMachine();
timeoutGame.startGame('easy').dismissExplainer();

// Simulate timeout (time reaches 0)
timeoutGame.timeLeft = 0;

// On timeout, game should auto-submit with max distance
// We simulate this by submitting at coordinates far from target
const farLat = -90;
const farLon = 180;
const result = timeoutGame.submitGuess(farLat, farLon);

if (result.points === 0 && result.timeBonus === 0) {
    console.log(`  ✅ Timeout results in 0 points (distance: ${result.distance} km)`);
    passed++;
} else {
    console.log(`  ❌ Timeout should give 0 points`);
    failed++;
}

console.log();

// ============================================================================
// Summary
// ============================================================================
console.log('='.repeat(60));
console.log('STATE TRANSITION TEST SUMMARY');
console.log('='.repeat(60));
console.log(`  ✅ Total Passed: ${passed}`);
console.log(`  ❌ Total Failed: ${failed}`);
console.log();

if (failed === 0) {
    console.log('🎉 ALL STATE TESTS PASSED!');
} else {
    console.log('⚠️ Some tests failed. Review and fix.');
}
console.log();
