#!/bin/bash
# Test 3 consecutive app launches on the same simulator

SIMULATOR_ID="4640BAC5-B185-4567-AFCF-9B5C3245AE3A" # iPhone 16
BUNDLE_ID="com.builtbylee.app80days"
LOG_FILE="/tmp/three_launch_test.log"

echo "=== THREE LAUNCH STABILITY TEST ===" | tee -a "$LOG_FILE"
echo "Simulator: iPhone 16 ($SIMULATOR_ID)" | tee -a "$LOG_FILE"
echo "Bundle ID: $BUNDLE_ID" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Boot simulator if not already booted
echo "1. Ensuring simulator is booted..." | tee -a "$LOG_FILE"
xcrun simctl boot "$SIMULATOR_ID" 2>&1 | tee -a "$LOG_FILE"
sleep 3

# Open Simulator app (if not already open)
open -a Simulator 2>/dev/null
sleep 2

# Function to launch app and wait for main menu
launch_and_verify() {
    local attempt=$1
    echo "" | tee -a "$LOG_FILE"
    echo "=== LAUNCH ATTEMPT $attempt ===" | tee -a "$LOG_FILE"
    echo "Time: $(date)" | tee -a "$LOG_FILE"
    
    # Start log capture in background
    echo "Starting log capture..." | tee -a "$LOG_FILE"
    xcrun simctl spawn "$SIMULATOR_ID" log stream --predicate 'processImagePath contains "Pinr" OR subsystem contains "com.builtbylee.app80days"' --level debug --style syslog > "/tmp/launch_${attempt}_logs.txt" 2>&1 &
    LOG_PID=$!
    sleep 1
    
    # Launch app
    echo "Launching app..." | tee -a "$LOG_FILE"
    xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG_FILE"
    
    # Wait for app to start
    echo "Waiting 15 seconds for app to load..." | tee -a "$LOG_FILE"
    sleep 15
    
    # Check if app process is running
    APP_RUNNING=$(xcrun simctl spawn "$SIMULATOR_ID" ps aux | grep -i "Pinr\|$BUNDLE_ID" | grep -v grep | wc -l | tr -d ' ')
    echo "App processes found: $APP_RUNNING" | tee -a "$LOG_FILE"
    
    # Check for crashes in logs
    echo "Checking for crashes..." | tee -a "$LOG_FILE"
    CRASH_FOUND=$(tail -100 "/tmp/launch_${attempt}_logs.txt" | grep -iE "crash|fatal|exception|terminated|abort|assertion" | grep -v "Mapbox\|OneSignal" | wc -l | tr -d ' ')
    echo "Crash indicators found: $CRASH_FOUND" | tee -a "$LOG_FILE"
    
    if [ "$CRASH_FOUND" -gt 0 ]; then
        echo "❌ CRASH DETECTED in launch $attempt!" | tee -a "$LOG_FILE"
        tail -50 "/tmp/launch_${attempt}_logs.txt" | grep -iE "crash|fatal|exception|terminated|abort" | head -10 | tee -a "$LOG_FILE"
        kill $LOG_PID 2>/dev/null
        return 1
    fi
    
    # Check if app is still running after 15 seconds
    sleep 5
    APP_STILL_RUNNING=$(xcrun simctl spawn "$SIMULATOR_ID" ps aux | grep -i "Pinr\|$BUNDLE_ID" | grep -v grep | wc -l | tr -d ' ')
    echo "App still running after 20s: $APP_STILL_RUNNING processes" | tee -a "$LOG_FILE"
    
    if [ "$APP_STILL_RUNNING" -eq 0 ]; then
        echo "❌ App terminated unexpectedly in launch $attempt!" | tee -a "$LOG_FILE"
        kill $LOG_PID 2>/dev/null
        return 1
    fi
    
    # Check for main menu indicators (look for console logs indicating successful load)
    echo "Checking for successful main menu load..." | tee -a "$LOG_FILE"
    MAIN_MENU_INDICATORS=$(tail -200 "/tmp/launch_${attempt}_logs.txt" | grep -iE "main menu|index|auth.*success|session.*set|profile.*validated" | wc -l | tr -d ' ')
    echo "Main menu indicators: $MAIN_MENU_INDICATORS" | tee -a "$LOG_FILE"
    
    kill $LOG_PID 2>/dev/null
    sleep 1
    
    if [ "$APP_STILL_RUNNING" -gt 0 ] && [ "$CRASH_FOUND" -eq 0 ]; then
        echo "✅ Launch $attempt: App running, no crashes detected" | tee -a "$LOG_FILE"
        return 0
    else
        echo "❌ Launch $attempt: Failed" | tee -a "$LOG_FILE"
        return 1
    fi
}

# Function to close app
close_app() {
    local attempt=$1
    echo "" | tee -a "$LOG_FILE"
    echo "=== CLOSING APP (after launch $attempt) ===" | tee -a "$LOG_FILE"
    xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG_FILE"
    sleep 3
    echo "App closed" | tee -a "$LOG_FILE"
}

# Test sequence
SUCCESS_COUNT=0
FAILED=false

# Launch 1
if launch_and_verify 1; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    close_app 1
else
    FAILED=true
fi

# Launch 2
if [ "$FAILED" = false ]; then
    if launch_and_verify 2; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        close_app 2
    else
        FAILED=true
    fi
fi

# Launch 3
if [ "$FAILED" = false ]; then
    if launch_and_verify 3; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        # Don't close after final launch - leave it running
    else
        FAILED=true
    fi
fi

# Final summary
echo "" | tee -a "$LOG_FILE"
echo "=== TEST SUMMARY ===" | tee -a "$LOG_FILE"
echo "Successful launches: $SUCCESS_COUNT / 3" | tee -a "$LOG_FILE"

if [ "$SUCCESS_COUNT" -eq 3 ]; then
    echo "✅ ALL 3 LAUNCHES SUCCESSFUL - APP IS STABLE" | tee -a "$LOG_FILE"
    exit 0
else
    echo "❌ TEST FAILED - Only $SUCCESS_COUNT successful launches" | tee -a "$LOG_FILE"
    echo "Check logs in /tmp/launch_*_logs.txt for details" | tee -a "$LOG_FILE"
    exit 1
fi

