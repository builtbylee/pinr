#!/bin/bash

# Monitor iOS build progress
echo "Monitoring iOS build..."
echo "Press Ctrl+C to stop"
echo ""

LOG_FILE="ios_login_fix_final.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "No build log found. Starting new build..."
    npx expo run:ios --device "iPhone 16 Pro" 2>&1 | tee "$LOG_FILE"
else
    echo "Tailing build log..."
    tail -f "$LOG_FILE" | while IFS= read -r line; do
        echo "$line"
        # Check for completion
        if echo "$line" | grep -q "BUILD SUCCEEDED\|Installing on\|Launching"; then
            echo ""
            echo "✅ Build appears to be completing!"
        fi
        if echo "$line" | grep -q "BUILD FAILED\|error:"; then
            echo ""
            echo "❌ Build error detected!"
        fi
    done
fi

