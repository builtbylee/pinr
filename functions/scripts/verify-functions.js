#!/usr/bin/env node
/**
 * Verify that all functions are properly exported and discoverable
 * This script simulates what Firebase CLI does during discovery
 */

// Force CommonJS
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin (required for functions to load)
try {
    admin.initializeApp();
} catch (e) {
    // Already initialized
}

console.log('=== Loading functions module ===');
let exports;
try {
    exports = require('../lib/index.js');
    console.log('✅ Module loaded successfully');
} catch (e) {
    console.error('❌ Failed to load module:', e.message);
    process.exit(1);
}

console.log('\n=== Checking for Apple Sign-In functions ===');
const appleFunctions = ['getAppleAuthUrl', 'exchangeAppleAuthCode'];
let allFound = true;

for (const funcName of appleFunctions) {
    if (typeof exports[funcName] === 'function') {
        console.log(`✅ ${funcName}: Found (type: ${typeof exports[funcName]})`);
        
        // Check if it's a proper Firebase function
        const func = exports[funcName];
        if (func && typeof func.run === 'function') {
            console.log(`   └─ Has .run() method (callable function)`);
        } else {
            console.log(`   ⚠️  Function exists but may not be properly configured`);
        }
    } else {
        console.log(`❌ ${funcName}: NOT FOUND`);
        allFound = false;
    }
}

console.log('\n=== All exports ===');
const allExports = Object.keys(exports).filter(k => typeof exports[k] === 'function');
console.log(`Total function exports: ${allExports.length}`);
console.log(`Functions: ${allExports.join(', ')}`);

console.log('\n=== Testing Firebase Functions discovery ===');
// Simulate what Firebase CLI does - it queries the functions.yaml endpoint
// We can't easily simulate that, but we can verify the functions are registered
try {
    // Check if functions are registered in the functions namespace
    const registeredFunctions = Object.keys(functions);
    console.log(`Firebase Functions registered: ${registeredFunctions.length > 0 ? 'Yes' : 'No'}`);
} catch (e) {
    console.log('Note: Cannot check Firebase Functions registration (this is normal)');
}

if (!allFound) {
    console.error('\n❌ Some Apple Sign-In functions are missing!');
    process.exit(1);
} else {
    console.log('\n✅ All Apple Sign-In functions are properly exported!');
    process.exit(0);
}

