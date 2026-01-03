#!/bin/bash

echo "=========================================="
echo "React Native iOS Log Viewer"
echo "=========================================="
echo ""
echo "Choose how to view logs:"
echo ""
echo "1. View logs from Metro bundler (recommended)"
echo "   - This shows console.log() output"
echo "   - Make sure 'npx expo run:ios' is running in another terminal"
echo ""
echo "2. View device logs directly"
echo "   - This shows native iOS logs"
echo "   - Requires device/simulator to be connected"
echo ""
echo "3. View filtered logs (Auth/Firebase only)"
echo "   - Shows only authentication and Firebase related logs"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "Looking for Metro bundler logs..."
        echo "If you see 'Metro waiting on...', logs should appear here."
        echo "Press Ctrl+C to stop"
        echo ""
        # Try to find and tail the Metro log file if it exists
        if [ -f "ios_debug_logging.log" ]; then
            tail -f ios_debug_logging.log | grep -E "(Auth|Layout|UserService|Firebase|Firestore|ERROR|WARN)"
        else
            echo "No log file found. Make sure you ran 'npx expo run:ios' with logging enabled."
            echo "Or check the terminal where you ran 'npx expo run:ios'"
        fi
        ;;
    2)
        echo ""
        echo "For Expo projects, logs appear in:"
        echo "1. Metro bundler terminal (where you ran 'npx expo run:ios')"
        echo "2. Xcode console (if you opened the project in Xcode)"
        echo ""
        echo "Opening Xcode console instructions..."
        echo "Run: open ios/Pinr.xcworkspace"
        echo "Then run the app from Xcode and check the bottom console panel"
        echo ""
        echo "Or check the terminal where you ran 'npx expo run:ios'"
        ;;
    3)
        echo ""
        echo "To view filtered logs, check the Metro bundler terminal"
        echo "(where you ran 'npx expo run:ios')"
        echo ""
        echo "Or if you have a log file, run:"
        echo "tail -f ios_debug_logging.log | grep -E '(Auth|Layout|UserService|Firebase|Firestore|ERROR|WARN|❌|✅|⚠️)'"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

