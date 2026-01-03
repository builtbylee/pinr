#!/bin/bash

echo "=========================================="
echo "Metro Bundler Log Viewer"
echo "=========================================="
echo ""
echo "Metro is running in terminal session ttys007"
echo ""
echo "Options:"
echo ""
echo "1. Find the Metro terminal window:"
echo "   - Look for a terminal window/tab showing 'Metro' or 'expo start'"
echo "   - It should be showing bundle compilation or 'Metro waiting on...'"
echo ""
echo "2. Restart Metro in this terminal (will stop current Metro):"
echo "   - This will make logs visible in your current terminal"
echo ""
read -p "Restart Metro here? (y/n): " restart

if [ "$restart" = "y" ] || [ "$restart" = "Y" ]; then
    echo ""
    echo "Stopping current Metro process..."
    kill 18416 2>/dev/null || true
    sleep 2
    
    echo "Starting Metro in this terminal..."
    echo "Logs will appear below. Press Ctrl+C to stop."
    echo ""
    npx expo start --dev-client --port 8081
else
    echo ""
    echo "To view logs:"
    echo "1. Find terminal window ttys007 (where Metro is running)"
    echo "2. Or run this script again and choose to restart Metro"
    echo ""
    echo "Current Metro process: PID 18416"
fi

