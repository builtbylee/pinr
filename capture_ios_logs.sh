#!/bin/bash

echo "=========================================="
echo "iOS Simulator Log Capture"
echo "=========================================="
echo ""
echo "This script will capture logs from the iOS Simulator"
echo "Press Ctrl+C to stop"
echo ""
echo "Looking for booted simulator..."

# Find booted simulator
BOOTED_UDID=$(xcrun simctl list devices | grep -i "booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)

if [ -z "$BOOTED_UDID" ]; then
    echo "❌ No booted simulator found"
    echo "Please start the simulator first"
    exit 1
fi

echo "✅ Found booted simulator: $BOOTED_UDID"
echo ""
echo "Capturing logs (filtering for Firestore/UserService/App)..."
echo "Press Ctrl+C to stop"
echo ""

# Stream logs and filter for relevant messages
xcrun simctl spawn "$BOOTED_UDID" log stream --level=debug --predicate 'processImagePath contains "Pinr" OR processImagePath contains "Expo"' 2>/dev/null | \
    grep -E "\[Firestore\]|\[UserService\]|\[useDataSubscriptions\]|\[App\]|\[Layout\]|\[FirebaseInit\]|Firestore|UserService|subscribeToPins|subscribeToUserProfile|onSnapshot|connectivity|Pins found|Profile update" --line-buffered


