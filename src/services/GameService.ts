
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
    id: string;
    correctOptionId: string;
    options: CountryOption[];
    flagUrl: string;
}

export interface CountryOption {
    code: string;
    name: string;
    capital?: string;
    difficulty?: Difficulty; // easy = common, hard = obscure
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
    difficulty: Difficulty;
}

export interface LeaderboardEntry {
    odUid: string;
    username: string;
    score: number;
    difficulty: Difficulty;
    timestamp: number;
}

import countriesData from '../data/countries.json';
import * as SecureStore from 'expo-secure-store';
import { leaderboardService } from './LeaderboardService';

// Categorize countries by difficulty
const EASY_COUNTRIES = ['US', 'GB', 'FR', 'DE', 'IT', 'ES', 'JP', 'CN', 'BR', 'CA', 'AU', 'IN', 'MX', 'RU', 'KR', 'NL', 'SE', 'NO', 'CH', 'AT'];
const MEDIUM_COUNTRIES = ['AR', 'CL', 'CO', 'PE', 'EG', 'ZA', 'NG', 'KE', 'PH', 'TH', 'VN', 'MY', 'ID', 'PK', 'BD', 'TR', 'GR', 'PL', 'UA', 'CZ', 'PT', 'IE', 'BE', 'DK', 'FI', 'NZ', 'SG', 'AE', 'SA', 'IL'];

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
            difficulty: this.currentDifficulty,
        };
    }

    private getCountriesForDifficulty(): CountryOption[] {
        switch (this.currentDifficulty) {
            case 'easy':
                return ALL_COUNTRIES.filter(c => EASY_COUNTRIES.includes(c.code));
            case 'medium':
                return ALL_COUNTRIES.filter(c => EASY_COUNTRIES.includes(c.code) || MEDIUM_COUNTRIES.includes(c.code));
            case 'hard':
            default:
                return ALL_COUNTRIES;
        }
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
            console.log('[GameService] High score saved:', score, 'difficulty:', this.currentDifficulty);
        } catch (e) {
            console.error('[GameService] Failed to save high score:', e);
        }
    }

    public subscribe(callback: (state: GameState) => void) {
        this.onStateChange = callback;
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

    public startGame(difficulty?: Difficulty) {
        if (difficulty) {
            this.currentDifficulty = difficulty;
        }
        const currentHighScore = this.state.highScore;
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
            const now = Date.now();
            const elapsed = Math.floor((now - this.startTime) / 1000);
            const remaining = this.ROUND_TIME - elapsed;

            if (remaining <= 0) {
                this.state.timeLeft = 0;
                this.endGame();
            } else {
                this.state.timeLeft = remaining;
                this.emit();
            }
        }, 1000);
    }

    public submitAnswer(countryCode: string): boolean {
        if (!this.state.isPlaying || this.state.gameOver) return false;

        const isCorrect = countryCode === this.state.currentQuestion?.correctOptionId;
        this.state.lastAnswerCorrect = isCorrect;

        if (isCorrect) {
            this.state.score += 10 + (this.state.streak * 2);
            this.state.streak += 1;
        } else {
            this.state.streak = 0;
        }

        this.nextQuestion();
        this.emit();

        // Clear lastAnswerCorrect after a short delay (for animation)
        setTimeout(() => {
            this.state.lastAnswerCorrect = null;
            this.emit();
        }, 300);

        return isCorrect;
    }

    private nextQuestion() {
        const countries = this.getCountriesForDifficulty();
        const correct = countries[Math.floor(Math.random() * countries.length)];

        const others = countries.filter(c => c.code !== correct.code)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        const options = [...others, correct].sort(() => 0.5 - Math.random());

        this.state.currentQuestion = {
            id: Date.now().toString(),
            correctOptionId: correct.code,
            options: options,
            flagUrl: `https://flagcdn.com/w320/${correct.code.toLowerCase()}.png`
        };
    }

    public endGame() {
        this.state.isPlaying = false;
        this.state.gameOver = true;
        if (this.timerInterval) clearInterval(this.timerInterval);

        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            this.state.isNewHighScore = true;
            this.saveHighScore(this.state.score);

            // Also save to online leaderboard
            leaderboardService.saveScore(this.state.score, this.currentDifficulty);
        }

        this.emit();
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
}

export const gameService = new GameService();


