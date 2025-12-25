/**
 * Pin Drop Game Service
 * 
 * A geography guessing game where players drop pins on a map
 * and score points based on proximity to the actual location.
 */

import locations from '../data/locations.json';

// Types
export type PinDropDifficulty = 'easy' | 'medium' | 'hard';

export interface Location {
    id: string;
    name: string;
    country: string;
    displayName: string;
    lat: number;
    lon: number;
    difficulty: PinDropDifficulty;
}

export interface PinDropState {
    isPlaying: boolean;
    currentRound: number;
    totalRounds: number;
    score: number;
    timeLeft: number;
    currentLocation: Location | null;
    lastGuess: {
        lat: number;
        lon: number;
        distance: number;
        points: number;
    } | null;
    gameOver: boolean;
    difficulty: PinDropDifficulty;
    roundLocations: Location[]; // Pre-selected locations for this game
    timeoutResult: RoundResult | null; // Result from timeout (auto-submit)
}

export interface RoundResult {
    distance: number;
    points: number;
    timeBonus: number;
    totalPoints: number;
    feedback: string;
    emoji: string;
}

// Configuration
const ROUND_TIME: Record<PinDropDifficulty, number> = {
    easy: 30,
    medium: 20,
    hard: 15,
};

const TOTAL_ROUNDS = 5;

// Scoring thresholds (distance in km -> points)
const SCORING_TIERS = [
    { maxDistance: 50, points: 1000, feedback: 'Perfect!', emoji: '🎯' },
    { maxDistance: 150, points: 750, feedback: 'Excellent!', emoji: '🔥' },
    { maxDistance: 500, points: 500, feedback: 'Great!', emoji: '✨' },
    { maxDistance: 1000, points: 250, feedback: 'Good', emoji: '👍' },
    { maxDistance: 2000, points: 100, feedback: 'Close-ish', emoji: '🤔' },
    { maxDistance: Infinity, points: 0, feedback: 'Too far', emoji: '❌' },
];

// Haversine formula for calculating distance between two coordinates
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// Seeded random number generator for consistent challenge locations
function seededRandom(seed: number): () => number {
    return function () {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

class PinDropService {
    private state: PinDropState;
    private timerInterval: NodeJS.Timeout | null = null;
    private startTime: number = 0;
    private listeners: ((state: PinDropState) => void)[] = [];

    constructor() {
        this.state = this.getInitialState();
    }

    private getInitialState(): PinDropState {
        return {
            isPlaying: false,
            currentRound: 0,
            totalRounds: TOTAL_ROUNDS,
            score: 0,
            timeLeft: ROUND_TIME.medium,
            currentLocation: null,
            lastGuess: null,
            gameOver: false,
            difficulty: 'medium',
            roundLocations: [],
            timeoutResult: null,
        };
    }

    // Subscribe to state changes
    subscribe(listener: (state: PinDropState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private emit() {
        this.listeners.forEach(l => l({ ...this.state }));
    }

    getState(): PinDropState {
        return { ...this.state };
    }

    // Get locations filtered by difficulty
    // All locations in the database are pre-verified to be within reachable globe range (±38°)
    private getLocationsByDifficulty(difficulty: PinDropDifficulty): Location[] {
        const allLocations = locations as Location[];

        // Filter by difficulty
        switch (difficulty) {
            case 'easy':
                return allLocations.filter(l => l.difficulty === 'easy');
            case 'medium':
                return allLocations.filter(l => l.difficulty === 'easy' || l.difficulty === 'medium');
            case 'hard':
                return allLocations; // All difficulties
        }
    }

    // Select random locations for a game (optionally seeded for challenges)
    private selectLocations(difficulty: PinDropDifficulty, seed?: string): Location[] {
        const pool = this.getLocationsByDifficulty(difficulty);
        const selected: Location[] = [];
        const random = seed ? seededRandom(hashString(seed)) : Math.random;

        // Shuffle and pick
        const shuffled = [...pool].sort(() => (typeof random === 'function' ? random() : Math.random()) - 0.5);

        for (let i = 0; i < TOTAL_ROUNDS && i < shuffled.length; i++) {
            selected.push(shuffled[i]);
        }

        return selected;
    }

    // Start a new game
    startGame(difficulty: PinDropDifficulty, challengeSeed?: string) {
        const roundLocations = this.selectLocations(difficulty, challengeSeed);

        this.state = {
            ...this.getInitialState(),
            difficulty,
            roundLocations,
            totalRounds: TOTAL_ROUNDS,
        };

        this.startRound();
    }

    // Start a new round
    private startRound() {
        if (this.state.currentRound >= this.state.totalRounds) {
            this.endGame();
            return;
        }

        const location = this.state.roundLocations[this.state.currentRound];

        this.state = {
            ...this.state,
            isPlaying: true,
            currentLocation: location,
            lastGuess: null,
            timeLeft: ROUND_TIME[this.state.difficulty],
            timeoutResult: null, // Clear any previous timeout result
        };

        this.startTime = Date.now();
        this.startTimer();
        this.emit();
    }

    private startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const remaining = ROUND_TIME[this.state.difficulty] - elapsed;

            if (remaining <= 0) {
                // Time's up - set timeLeft to 0 and auto-submit
                this.state.timeLeft = 0;
                this.emit();

                // Auto-submit with max distance and store result
                const result = this.submitGuess(0, 0, true);

                // Store result so component can react to it
                this.state.timeoutResult = result;
                this.emit();
            } else {
                this.state.timeLeft = remaining;
                this.emit();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Submit a guess
    submitGuess(guessLat: number, guessLon: number, timeout: boolean = false): RoundResult {
        this.stopTimer();

        const location = this.state.currentLocation!;

        // Calculate distance
        const distance = timeout
            ? 99999 // Max distance for timeout
            : haversineDistance(guessLat, guessLon, location.lat, location.lon);

        // Calculate points
        const tier = SCORING_TIERS.find(t => distance <= t.maxDistance)!;
        const basePoints = tier.points;

        // Time bonus: 10 points per second remaining (only if scored points)
        const timeBonus = basePoints > 0 ? this.state.timeLeft * 10 : 0;
        const totalPoints = basePoints + timeBonus;

        // Update state
        this.state = {
            ...this.state,
            isPlaying: false,
            score: this.state.score + totalPoints,
            lastGuess: {
                lat: guessLat,
                lon: guessLon,
                distance: Math.round(distance),
                points: totalPoints,
            },
            currentRound: this.state.currentRound + 1,
        };

        this.emit();

        return {
            distance: Math.round(distance),
            points: basePoints,
            timeBonus,
            totalPoints,
            feedback: tier.feedback,
            emoji: tier.emoji,
        };
    }

    // Move to next round
    nextRound() {
        this.startRound();
    }

    // End the game
    private endGame() {
        this.stopTimer();
        this.state = {
            ...this.state,
            isPlaying: false,
            gameOver: true,
            currentLocation: null,
        };
        this.emit();
    }

    // Reset the game
    reset() {
        this.stopTimer();
        this.state = this.getInitialState();
        this.emit();
    }

    // Pause game (for quit confirmation)
    pause() {
        this.stopTimer();
        this.state.isPlaying = false;
        this.emit();
    }

    // Resume game (after canceling quit)
    resume() {
        if (this.state.currentLocation && !this.state.gameOver) {
            // Recalculate start time based on remaining time
            this.startTime = Date.now() - ((ROUND_TIME[this.state.difficulty] - this.state.timeLeft) * 1000);
            this.state.isPlaying = true;
            this.startTimer();
            this.emit();
        }
    }

    // Get scoring info for UI
    static getScoringInfo(): { distance: string; points: number; emoji: string }[] {
        return SCORING_TIERS.filter(t => t.maxDistance !== Infinity).map(t => ({
            distance: t.maxDistance < 1000 ? `< ${t.maxDistance} km` : `< ${t.maxDistance / 1000}k km`,
            points: t.points,
            emoji: t.emoji,
        }));
    }
}

// Simple string hash for seeding
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export const pinDropService = new PinDropService();
