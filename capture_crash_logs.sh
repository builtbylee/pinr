#!/bin/bash
# Crash Log Capture Script for iOS and Android

echo "=== CRASH LOG CAPTURE SCRIPT ==="
echo ""
echo "This script will capture crash logs from both iOS and Android"
echo ""

# iOS Log Capture
echo "=== iOS CRASH LOGS ==="
echo "Starting iOS log stream (will capture for 60 seconds)..."
echo "Press Ctrl+C to stop early"
echo ""

# Capture iOS logs
timeout 60 log stream --predicate 'processImagePath contains "Pinr" OR processImagePath contains "80days" OR subsystem contains "com.builtbylee.app80days"' --level debug --style syslog 2>&1 | tee /tmp/ios_crash_logs.txt

echo ""
echo "iOS logs saved to: /tmp/ios_crash_logs.txt"
echo ""

# Android Log Capture
echo "=== ANDROID CRASH LOGS ==="
if command -v adb &> /dev/null; then
    DEVICE=$(adb devices | grep -v "List" | grep "device$" | head -1 | cut -f1)
    if [ -z "$DEVICE" ]; then
        echo "❌ No Android device connected"
        echo "Connect device and run: adb logcat -d | grep -iE 'pinr|fatal|crash|exception|error' | tail -100"
    else
        echo "Device found: $DEVICE"
        echo "Capturing Android logs..."
        adb logcat -d | grep -iE "pinr|fatal|crash|exception|error|androidruntime" | tail -100 > /tmp/android_crash_logs.txt
        echo "Android logs saved to: /tmp/android_crash_logs.txt"
    fi
else
    echo "❌ adb not found - install Android SDK Platform Tools"
fi

echo ""
echo "=== LOG ANALYSIS ==="
echo "Checking for crash patterns..."

if [ -f /tmp/ios_crash_logs.txt ]; then
    echo ""
    echo "iOS Error Summary:"
    grep -iE "error|exception|crash|fatal|terminated|abort" /tmp/ios_crash_logs.txt | tail -20
fi

if [ -f /tmp/android_crash_logs.txt ]; then
    echo ""
    echo "Android Error Summary:"
    grep -iE "fatal|crash|exception|androidruntime" /tmp/android_crash_logs.txt | tail -20
fi

echo ""
echo "=== COMPLETE ==="
echo "Review logs in /tmp/ios_crash_logs.txt and /tmp/android_crash_logs.txt"

