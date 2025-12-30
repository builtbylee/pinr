
export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuestionType = 'flag' | 'capital' | 'trivia';

export interface Question {
    id: string;
    type: QuestionType;
    text: string;
    correctOptionId: string;
    options: Option[]; // Generic options
    flagUrl?: string;
    imageKey?: string;
}

export interface Option {
    id: string;
    text: string;
}

// Deprecated: Internal use only for country selection
export interface CountryOption {
    code: string;
    name: string;
    capital?: string;
}

export interface GameState {
    isPlaying: boolean;
    score: number;
    streak: number;
    timeLeft: number;
    currentQuestion: Question | null;
    gameOver: boolean;
    highScore: number;
    isNewHighScore: boolean;
    lastAnswerCorrect: boolean | null; // null = no answer yet, true = correct, false = wrong
    lastSelectedOptionId?: string | null; // Optional to track user selection
    difficulty: Difficulty;
}

import countriesData from '../data/countries.json';
import { TRIVIA_QUESTIONS, TriviaQuestion } from '../data/triviaQuestions';
import * as SecureStore from 'expo-secure-store';
import { leaderboardService } from './LeaderboardService';
import { streakService } from './StreakService';
import functions from '@react-native-firebase/functions';
import logger from '../utils/logger';

// Categorize countries by difficulty (Disjoint Sets for strict separation)
// EASY: 20 Common Countries
const EASY_COUNTRIES_CODES = ['US', 'GB', 'FR', 'DE', 'IT', 'ES', 'JP', 'CN', 'BR', 'CA', 'AU', 'IN', 'MX', 'RU', 'KR', 'NL', 'SE', 'NO', 'CH', 'AT'];

// MEDIUM: ~30 Moderately Known Countries (Excluding Easy)
const MEDIUM_COUNTRIES_CODES = ['AR', 'CL', 'CO', 'PE', 'EG', 'ZA', 'NG', 'KE', 'PH', 'TH', 'VN', 'MY', 'ID', 'PK', 'BD', 'TR', 'GR', 'PL', 'UA', 'CZ', 'PT', 'IE', 'BE', 'DK', 'FI', 'NZ', 'SG', 'AE', 'SA', 'IL'];

const ALL_COUNTRIES: CountryOption[] = countriesData;
const HIGH_SCORE_PREFIX = 'flagdash_highscore_';

class GameService {
    private state: GameState;
    private timerInterval: NodeJS.Timeout | null = null;
    private onStateChange: ((state: GameState) => void) | null = null;
    private startTime: number = 0;
    private ROUND_TIME = 30;
    private currentDifficulty: Difficulty = 'medium';

    constructor() {
        this.state = this.getInitialState();
        this.loadHighScore();
    }

    private getInitialState(): GameState {
        return {
            isPlaying: false,
            score: 0,
            streak: 0,
            timeLeft: this.ROUND_TIME,
            currentQuestion: null,
            gameOver: false,
            highScore: 0,
            isNewHighScore: false,
            lastAnswerCorrect: null,
            lastSelectedOptionId: null,
            difficulty: this.currentDifficulty,
        };
    }

    // STRICT DIFFICULTY: Returns only countries for the specific level
    private getCountriesForDifficulty(): CountryOption[] {
        switch (this.currentDifficulty) {
            case 'easy':
                return ALL_COUNTRIES.filter(c => EASY_COUNTRIES_CODES.includes(c.code));
            case 'medium':
                return ALL_COUNTRIES.filter(c => MEDIUM_COUNTRIES_CODES.includes(c.code));
            case 'hard':
            default:
                // Hard = All remaining (Excluding Easy and Medium)
                // OR Hard = Everything else. 
                // Let's make Hard disjoint too for strict separation?
                // User asked: "change the difficulty level logic so that they don't overlap"
                // So Hard should NOT include Easy or Medium.
                return ALL_COUNTRIES.filter(c => !EASY_COUNTRIES_CODES.includes(c.code) && !MEDIUM_COUNTRIES_CODES.includes(c.code));
        }
    }

    // STRICT DIFFICULTY: Returns only trivia for the specific level
    private getTriviaForDifficulty(): TriviaQuestion[] {
        return TRIVIA_QUESTIONS.filter(q => q.difficulty === this.currentDifficulty);
    }

    private async loadHighScore() {
        try {
            const saved = await SecureStore.getItemAsync(HIGH_SCORE_PREFIX + this.currentDifficulty);
            if (saved) {
                this.state.highScore = parseInt(saved, 10);
                this.emit();
            }
        } catch (e) {
            console.error('[GameService] Failed to load high score:', e);
        }
    }

    private async saveHighScore(score: number) {
        try {
            await SecureStore.setItemAsync(HIGH_SCORE_PREFIX + this.currentDifficulty, score.toString());
            logger.log('[GameService] High score saved:', score, 'difficulty:', this.currentDifficulty);
        } catch (e) {
            console.error('[GameService] Failed to save high score:', e);
        }
    }

    public subscribe(callback: (state: GameState) => void): () => void {
        this.onStateChange = callback;
        return () => {
            this.onStateChange = null;
        };
    }

    private emit() {
        if (this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    public setDifficulty(difficulty: Difficulty) {
        this.currentDifficulty = difficulty;
        this.state.difficulty = difficulty;
        this.loadHighScore(); // Load high score for new difficulty
    }

    public getState(): GameState {
        return { ...this.state };
    }
    private gameMode: 'flagdash' | 'travelbattle' = 'flagdash';

    private correctAnswersCount: number = 0; // Anti-cheat tracking
    private gameAnswers: Array<{ questionCode: string; selectedAnswer: string; isCorrect: boolean }> = [];
    private usedQuestionIds: Set<string> = new Set(); // Track questions used in current session

    public startGame(difficulty?: Difficulty, gameMode: 'flagdash' | 'travelbattle' = 'flagdash') {
        if (difficulty) {
            this.currentDifficulty = difficulty;
        }
        this.gameMode = gameMode;

        const currentHighScore = this.state.highScore;
        this.correctAnswersCount = 0; // Reset count
        this.gameAnswers = []; // Reset answers
        this.usedQuestionIds.clear(); // Reset used questions
        this.state = this.getInitialState();
        this.state.highScore = currentHighScore;
        this.state.difficulty = this.currentDifficulty;
        this.state.isPlaying = true;
        this.startTime = Date.now();

        this.nextQuestion();
        this.startTimer();
        this.emit();
    }

    private startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft -= 1;
                this.emit();
            } else {
                this.endGame();
            }
        }, 1000);
    }

    public submitAnswer(optionId: string): boolean {
        if (!this.state.isPlaying || this.state.gameOver) return false;

        const isCorrect = optionId === this.state.currentQuestion?.correctOptionId;
        this.state.lastAnswerCorrect = isCorrect;
        this.state.lastSelectedOptionId = optionId;

        if (isCorrect) {
            this.state.score += 10 + (this.state.streak * 2);
            this.state.streak += 1;
            this.correctAnswersCount++; // Track for validation
        } else {
            this.state.streak = 0;
        }

        // Track answer for server validation
        if (this.state.currentQuestion) {
            this.gameAnswers.push({
                questionCode: this.state.currentQuestion.correctOptionId,
                selectedAnswer: this.state.currentQuestion.options.find(o => o.id === optionId)?.text || '',
                isCorrect,
            });
        }

        // Emit immediately to show feedback (animation plays for ~900ms)
        this.emit();

        // Delay moving to next question so user sees the feedback
        setTimeout(() => {
            if (!this.state.gameOver) {
                this.nextQuestion();
            }
            // Reset feedback flags
            this.state.lastAnswerCorrect = null;
            this.state.lastSelectedOptionId = null;
            this.emit();
        }, 200);

        return isCorrect;
    }

    public endGame() {
        this.state.isPlaying = false;
        this.state.gameOver = true;
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Anti-Cheat Validation (Risk #6)
        // Max theoretical score per question is ~40 (assuming high streak).
        // If score is impossibly high relative to correct answers, reject it.
        const maxPossibleScore = this.correctAnswersCount * 100; // Generous buffer

        if (this.state.score > maxPossibleScore) {
            console.error('[GameService] Security Alert: Score calculation mismatch.');
            // Silently fail to save high score
            this.emit();
            return;
        }

        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            this.state.isNewHighScore = true;
            this.saveHighScore(this.state.score);
        }

        // Submit to Cloud Function for server-side validation
        const gameTimeMs = Date.now() - this.startTime;
        this.submitScoreToServer(this.state.score, gameTimeMs);

        // Record daily streak
        streakService.recordGamePlayed().catch(console.error);

        this.emit();
    }

    /**
     * Submit score to server for validation
     */
    private async submitScoreToServer(clientScore: number, gameTimeMs: number) {
        try {
            const result = await functions().httpsCallable('submitGameScore')({
                gameType: this.gameMode,
                difficulty: this.currentDifficulty,
                answers: this.gameAnswers,
                clientScore,
                gameTimeMs,
            });

            logger.log('[GameService] Server score submission:', result.data);
        } catch (error) {
            console.error('[GameService] Failed to submit score to server:', error);
            // Fallback: Score is still saved locally, just not on leaderboard
        }
    }

    public resumeGame() {
        if (this.state.gameOver) return;

        // Recalculate startTime so the timer continues from where it left off
        const now = Date.now();
        const elapsedSeconds = this.ROUND_TIME - this.state.timeLeft;
        this.startTime = now - (elapsedSeconds * 1000);

        this.state.isPlaying = true;
        this.startTimer();
        this.emit();
    }

    public stopGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.state.isPlaying = false;
        this.emit();
    }

    public getDifficulty(): Difficulty {
        return this.currentDifficulty;
    }
    private nextQuestion() {
        if (this.gameMode === 'flagdash') {
            let countries = this.getCountriesForDifficulty();

            // Filter out used questions
            let available = countries.filter(c => !this.usedQuestionIds.has(c.code));

            // Reshuffle / Reset if ran out
            if (available.length === 0) {
                this.usedQuestionIds.clear(); // Reset used questions to allow loop
                // But add back the ones from *this* game? No, just clear and start over. 
                // Alternatively, we could just fallback to all countries.
                available = countries;
            }

            const correct = available[Math.floor(Math.random() * available.length)];
            this.usedQuestionIds.add(correct.code); // Mark as used

            const distractors: CountryOption[] = [];

            // Simple distractor logic (could be improved to be similar countries)
            // Distractors CAN be previously used countries, that's fine.
            while (distractors.length < 3) {
                const c = countries[Math.floor(Math.random() * countries.length)];
                if (c.code !== correct.code && !distractors.some(d => d.code === c.code)) {
                    distractors.push(c);
                }
            }

            const optionsRaw = [correct, ...distractors].sort(() => Math.random() - 0.5);
            const options = optionsRaw.map(c => ({
                id: c.code,
                text: c.name
            }));

            this.state.currentQuestion = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'flag',
                text: "Which country does this flag belong to?",
                correctOptionId: correct.code,
                options: options,
                flagUrl: `https://flagcdn.com/w320/${correct.code.toLowerCase()}.png`
            };
        } else {
            let questions = this.getTriviaForDifficulty();

            // Filter out used questions
            let available = questions.filter(q => !this.usedQuestionIds.has(q.id));

            if (available.length === 0) {
                this.usedQuestionIds.clear();
                available = questions;
            }

            const q = available[Math.floor(Math.random() * available.length)];
            this.usedQuestionIds.add(q.id); // Mark as used

            // Transform options from string[] to {id, text}[]
            // We use the text itself as the ID for trivia options since strictly string matching is fine here
            // OR we can generate IDs. Let's use text as ID for simplicity as it matches how we checked it before?
            // Wait, previous code used `correctAnswerId` but data has `correctAnswer` (string value).
            // So option ID should be the text itself.

            const options = q.options.map(opt => ({
                id: opt, // Use the text as the ID
                text: opt
            }));

            this.state.currentQuestion = {
                id: q.id,
                type: 'trivia',
                text: q.text, // TriviaQuestion uses 'text', not 'question'
                correctOptionId: q.correctAnswer, // TriviaQuestion uses 'correctAnswer', not 'correctAnswerId'
                options: options,
                imageKey: q.imageKey
            };
        }
    }
}

export const gameService = new GameService();


