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
        // Always log errors, but in production could send to crash reporting
        console.error(...args);
    },

    debug: (...args: any[]) => {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    },
};

export default logger;
