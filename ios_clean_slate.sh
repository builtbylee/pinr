#!/bin/bash
# iOS Clean Slate Script
# Removes all CocoaPods, DerivedData, and Expo build artifacts for a fresh start

set -e

echo "🧹 Starting iOS clean slate..."

# 1. Remove CocoaPods artifacts
echo "📦 Removing CocoaPods artifacts..."
cd ios
rm -rf Pods
rm -rf Podfile.lock
rm -rf .symlinks
rm -rf build
cd ..

# 2. Remove DerivedData (Xcode build cache)
echo "🗑️  Removing Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 3. Remove Expo build artifacts
echo "📱 Removing Expo build artifacts..."
rm -rf .expo
rm -rf ios/.expo
rm -rf node_modules/.cache

# 4. Clean npm/yarn cache (optional but recommended)
echo "🧼 Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# 5. Reinstall pods
echo "📥 Reinstalling CocoaPods..."
cd ios
pod deintegrate 2>/dev/null || true
pod install --repo-update
cd ..

echo "✅ Clean slate complete!"
echo ""
echo "Next steps:"
echo "1. Run: npx expo prebuild --clean"
echo "2. Run: cd ios && pod install"
echo "3. Open Xcode and build"






