#!/bin/bash

echo "=========================================="
echo "JavaScript Console Log Capture"
echo "=========================================="
echo ""
echo "This will capture JavaScript console.log output from Metro"
echo ""
echo "Metro is running on port 8081"
echo "Press Ctrl+C to stop"
echo ""

# Try to connect to Metro's logging endpoint
# Note: Metro doesn't expose logs via HTTP by default, but we can try
# The best way is to restart Metro in this terminal

echo "Option 1: Restart Metro in this terminal (recommended)"
echo "This will stop the current Metro and start a new one here"
echo ""
read -p "Restart Metro here to see logs? (y/n): " restart

if [ "$restart" = "y" ] || [ "$restart" = "Y" ]; then
    echo ""
    echo "Stopping current Metro (PID 18416)..."
    kill 18416 2>/dev/null || true
    sleep 2
    
    echo "Starting Metro in this terminal..."
    echo "JavaScript console.log messages will appear below"
    echo "Press Ctrl+C to stop Metro"
    echo ""
    echo "=========================================="
    echo ""
    
    npx expo start --dev-client --port 8081
else
    echo ""
    echo "To see JavaScript logs, you need to:"
    echo ""
    echo "1. Find the Metro terminal window (ttys007)"
    echo "   - Look for a terminal showing 'Metro' or 'expo start'"
    echo "   - JavaScript console.log messages appear there"
    echo ""
    echo "2. Or restart Metro in this terminal:"
    echo "   ./capture_js_logs.sh"
    echo ""
    echo "3. Or use React Native Debugger (if installed):"
    echo "   - Open React Native Debugger app"
    echo "   - Connect to Metro on port 8081"
    echo ""
    echo "Note: Xcode console only shows native iOS logs, not JavaScript logs"
fi



