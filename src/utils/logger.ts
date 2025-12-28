/**
 * Logging utility that only logs in development mode
 * Prevents sensitive information from being logged in production
 */

const isDev = __DEV__;

export const logger = {
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    error: (...args: any[]) => {
        // Only log errors in dev mode to prevent stack trace exposure
        if (isDev) {
            console.error(...args);
        }
    },

    /**
     * Safe error logging - only prints error message, not full stack trace
     * Use this for user-facing error handling in production
     */
    safeError: (prefix: string, error: unknown) => {
        if (isDev) {
            console.error(prefix, error);
        } else {
            // In production, only log simple message
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`${prefix} ${message}`);
        }
    },

    debug: (...args: any[]) => {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    },
};

export default logger;
