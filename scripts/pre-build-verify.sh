#!/bin/bash
# Pre-Build Verification Script for EAS Builds
# This script performs comprehensive local checks BEFORE submitting to EAS
# Exit code 0 = safe to build, non-zero = issues found

set -e
cd "$(dirname "$0")/.."

ERRORS=0
WARNINGS=0
REPORT_FILE="/tmp/pre-build-report-$(date +%Y%m%d%H%M%S).txt"

echo "========================================" | tee "$REPORT_FILE"
echo "EAS Pre-Build Verification Report" | tee -a "$REPORT_FILE"
echo "$(date)" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# -----------------------------------------------------------------------------
# PHASE 1: TypeScript Compilation Check
# -----------------------------------------------------------------------------
echo "[Phase 1/7] TypeScript Compilation Check..." | tee -a "$REPORT_FILE"

TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || true)

if [ "$TSC_ERRORS" -gt 0 ]; then
    echo "  ❌ TypeScript errors found: $TSC_ERRORS" | tee -a "$REPORT_FILE"
    echo "$TSC_OUTPUT" | grep -E "(error TS|\.tsx?:[0-9]+)" | head -20 >> "$REPORT_FILE"
    ERRORS=$((ERRORS + TSC_ERRORS))
else
    echo "  ✅ TypeScript: No errors" | tee -a "$REPORT_FILE"
fi

# -----------------------------------------------------------------------------
# PHASE 2: JavaScript Syntax Check (Metro Bundler Dry Run)
# -----------------------------------------------------------------------------
echo "[Phase 2/7] JavaScript Bundle Check..." | tee -a "$REPORT_FILE"

# Export bundle to check for syntax errors (faster than full build)
# Note: output-dir must be inside the project
BUNDLE_OUTPUT=$(npx expo export --platform android --no-bytecode --no-minify --output-dir .expo-bundle-check 2>&1 || true)
BUNDLE_ERROR=$(echo "$BUNDLE_OUTPUT" | grep -i "error\|SyntaxError\|failed" | head -5 || true)

if [ -n "$BUNDLE_ERROR" ]; then
    echo "  ❌ Bundle errors found:" | tee -a "$REPORT_FILE"
    echo "$BUNDLE_ERROR" | tee -a "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ JavaScript bundle: OK" | tee -a "$REPORT_FILE"
fi

# Cleanup
rm -rf .expo-bundle-check 2>/dev/null || true
rm -rf /tmp/expo-bundle-check 2>/dev/null || true

# -----------------------------------------------------------------------------
# PHASE 3: app.json Configuration Check
# -----------------------------------------------------------------------------
echo "[Phase 3/7] app.json Configuration Check..." | tee -a "$REPORT_FILE"

# Check for known problematic fields
if grep -q "predictiveBackGestureEnabled" app.json; then
    echo "  ❌ Invalid field: predictiveBackGestureEnabled (remove from android config)" | tee -a "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
fi

# Verify required files exist
GOOGLE_SERVICES=$(cat app.json | grep -o '"googleServicesFile"[^,]*' | head -1 || true)
if echo "$GOOGLE_SERVICES" | grep -q "google-services.json"; then
    if [ ! -f "google-services.json" ]; then
        echo "  ❌ Missing: google-services.json (required for Android)" | tee -a "$REPORT_FILE"
        ERRORS=$((ERRORS + 1))
    else
        echo "  ✅ google-services.json: Found" | tee -a "$REPORT_FILE"
    fi
fi

# Verify icon files
ICON_FILE=$(cat app.json | grep -o '"icon"[^,]*' | sed 's/.*"\.\//\.\//' | tr -d '"' | head -1)
if [ -n "$ICON_FILE" ] && [ ! -f "$ICON_FILE" ]; then
    echo "  ❌ Missing icon: $ICON_FILE" | tee -a "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ App icon: Found" | tee -a "$REPORT_FILE"
fi

# -----------------------------------------------------------------------------
# PHASE 4: eas.json Configuration Check
# -----------------------------------------------------------------------------
echo "[Phase 4/7] eas.json Configuration Check..." | tee -a "$REPORT_FILE"

if [ ! -f "eas.json" ]; then
    echo "  ❌ Missing: eas.json" | tee -a "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ eas.json: Found" | tee -a "$REPORT_FILE"
fi

# -----------------------------------------------------------------------------
# PHASE 5: Gradle Configuration Check (Android-specific)
# -----------------------------------------------------------------------------
echo "[Phase 5/7] Android/Gradle Configuration Check..." | tee -a "$REPORT_FILE"

if [ -d "android" ]; then
    # Check for Kotlin version issues
    KOTLIN_VER=$(cat app.json | grep -A5 "expo-build-properties" | grep -o "kotlinVersion[^,]*" | grep -o "[0-9.]*" || true)
    if [ -n "$KOTLIN_VER" ]; then
        echo "  ℹ️  Kotlin version: $KOTLIN_VER" | tee -a "$REPORT_FILE"
        # Known problematic versions
        if [ "$KOTLIN_VER" = "1.9.25" ]; then
            echo "  ⚠️  Warning: Kotlin 1.9.25 may cause issues. Consider 1.9.24 or 2.0.0" | tee -a "$REPORT_FILE"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi

    # Check Gradle version
    GRADLE_VER=$(cat app.json | grep -A10 "expo-build-properties" | grep -o "gradleVersion[^,]*" | grep -o "[0-9.]*" || true)
    if [ -n "$GRADLE_VER" ]; then
        echo "  ℹ️  Gradle version: $GRADLE_VER" | tee -a "$REPORT_FILE"
    fi

    echo "  ✅ Android directory: Found" | tee -a "$REPORT_FILE"
else
    echo "  ⚠️  No android/ directory (will be generated during EAS build)" | tee -a "$REPORT_FILE"
fi

# -----------------------------------------------------------------------------
# PHASE 6: Dependencies Check
# -----------------------------------------------------------------------------
echo "[Phase 6/7] Dependencies Check..." | tee -a "$REPORT_FILE"

# Check for expo-modules-core (should not be directly installed)
if grep -q '"expo-modules-core"' package.json; then
    echo "  ⚠️  Warning: expo-modules-core should not be directly installed" | tee -a "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
else
    echo "  ✅ No problematic direct dependencies" | tee -a "$REPORT_FILE"
fi

# Check node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  ❌ Missing: node_modules (run npm install or yarn)" | tee -a "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ node_modules: Present" | tee -a "$REPORT_FILE"
fi

# -----------------------------------------------------------------------------
# PHASE 7: Source Code Syntax Scan
# -----------------------------------------------------------------------------
echo "[Phase 7/7] Source Code Syntax Scan..." | tee -a "$REPORT_FILE"

# Look for common syntax issues that break builds
SYNTAX_ISSUES=0

# Check for orphaned comment characters
ORPHAN_COMMENTS=$(grep -rn "^[[:space:]]*\*[[:space:]]" --include="*.ts" --include="*.tsx" src/ | grep -v "^\s*/\*" | grep -v "^\s*\*/" | head -5 || true)
if [ -n "$ORPHAN_COMMENTS" ]; then
    echo "  ⚠️  Potential orphaned comment markers found:" | tee -a "$REPORT_FILE"
    echo "$ORPHAN_COMMENTS" >> "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for common import errors
IMPORT_ISSUES=$(grep -rn "^import.*from[[:space:]]*$" --include="*.ts" --include="*.tsx" src/ | head -5 || true)
if [ -n "$IMPORT_ISSUES" ]; then
    echo "  ❌ Incomplete import statements:" | tee -a "$REPORT_FILE"
    echo "$IMPORT_ISSUES" >> "$REPORT_FILE"
    ERRORS=$((ERRORS + 1))
fi

echo "  ✅ Source scan: Complete" | tee -a "$REPORT_FILE"

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
echo "" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo "SUMMARY" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo "Errors: $ERRORS" | tee -a "$REPORT_FILE"
echo "Warnings: $WARNINGS" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ "$ERRORS" -gt 0 ]; then
    echo "❌ PRE-BUILD FAILED - Fix $ERRORS error(s) before building" | tee -a "$REPORT_FILE"
    echo "Report saved to: $REPORT_FILE"
    exit 1
else
    echo "✅ PRE-BUILD PASSED - Safe to submit build" | tee -a "$REPORT_FILE"
    echo "Report saved to: $REPORT_FILE"
    exit 0
fi
