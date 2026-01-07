#!/bin/bash
# Verification Script - Tests all fixes before rebuild

echo "=== VERIFICATION SCRIPT ==="
echo "Testing all fixes before rebuild..."
echo ""

ERRORS=0

# Test 1: Check for top-level expo-apple-authentication imports
echo "1. Checking for top-level expo-apple-authentication imports..."
if grep -r "^import.*expo-apple-authentication\|^import.*AppleAuthentication" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "require("; then
    echo "   ❌ FAIL: Found top-level import"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ PASS: No top-level imports found"
fi

# Test 2: Check for lazy require in authService
echo ""
echo "2. Checking for lazy require in authService..."
if grep -q "require('expo-apple-authentication')" src/services/authService.ts; then
    echo "   ✅ PASS: Lazy require found"
else
    echo "   ❌ FAIL: Lazy require not found"
    ERRORS=$((ERRORS + 1))
fi

# Test 3: Check for OneSignal lazy import
echo ""
echo "3. Checking for OneSignal lazy import..."
if grep -q "require('react-native-onesignal')" app/_layout.tsx; then
    echo "   ✅ PASS: OneSignal uses lazy require"
else
    echo "   ❌ FAIL: OneSignal still uses top-level import"
    ERRORS=$((ERRORS + 1))
fi

# Test 4: Verify native module linking
echo ""
echo "4. Verifying native module linking..."
if grep -q "ExpoAppleAuthentication" ios/Podfile.lock 2>/dev/null; then
    echo "   ✅ PASS: expo-apple-authentication is linked"
else
    echo "   ⚠️  WARN: expo-apple-authentication not found in Podfile.lock"
    echo "   (May need to run: cd ios && pod install)"
fi

# Test 5: Check if modules exist
echo ""
echo "5. Checking if modules exist in node_modules..."
if [ -d "node_modules/expo-apple-authentication" ]; then
    echo "   ✅ PASS: expo-apple-authentication exists"
else
    echo "   ❌ FAIL: expo-apple-authentication missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "node_modules/expo-crypto" ]; then
    echo "   ✅ PASS: expo-crypto exists"
else
    echo "   ❌ FAIL: expo-crypto missing"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=== VERIFICATION SUMMARY ==="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Ready to rebuild."
    exit 0
else
    echo "❌ Found $ERRORS error(s). Please fix before rebuilding."
    exit 1
fi

