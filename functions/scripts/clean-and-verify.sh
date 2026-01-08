#!/bin/bash
# Scorched Earth Cleanup and Verification Script
# This ensures a clean build and verifies functions are properly exported

set -e

echo "🧹 Scorched Earth Cleanup"
cd "$(dirname "$0")/.."

# Remove all build artifacts
echo "  → Removing lib/ directory..."
rm -rf lib/
echo "  → Removing node_modules/.cache..."
rm -rf node_modules/.cache 2>/dev/null || true
echo "  → Removing .tsbuildinfo files..."
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo ""
echo "📦 Reinstalling dependencies..."
npm ci

echo ""
echo "🔨 Building functions..."
npm run build

echo ""
echo "✅ Verifying functions are exported..."
node -e "
const f = require('./lib/index.js');
const appleFunctions = ['getAppleAuthUrl', 'exchangeAppleAuthCode'];
let allFound = true;

for (const funcName of appleFunctions) {
    if (typeof f[funcName] === 'function') {
        console.log('✅', funcName, 'EXISTS');
    } else {
        console.log('❌', funcName, 'MISSING');
        allFound = false;
    }
}

if (!allFound) {
    console.error('ERROR: Some functions are missing!');
    process.exit(1);
}

console.log('✅ All Apple Sign-In functions are properly exported!');
"

echo ""
echo "🎯 Verification complete!"

