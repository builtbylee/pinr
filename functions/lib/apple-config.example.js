"use strict";
/**
 * Apple Sign-In Configuration
 *
 * INSTRUCTIONS:
 * 1. Copy this file to apple-config.ts (without .example)
 * 2. Copy your private key from Firebase Console → Authentication → Sign-in method → Apple
 * 3. Paste it in the APPLE_PRIVATE_KEY constant below
 * 4. DO NOT commit apple-config.ts to version control (it's in .gitignore)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLE_PRIVATE_KEY = void 0;
exports.APPLE_PRIVATE_KEY = `
-----BEGIN PRIVATE KEY-----
[PASTE YOUR PRIVATE KEY FROM FIREBASE CONSOLE HERE]
-----END PRIVATE KEY-----
`.trim();
//# sourceMappingURL=apple-config.example.js.map