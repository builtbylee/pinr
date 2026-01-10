#!/bin/bash
# Fetch EAS Build Logs for Analysis
# Usage: ./fetch-build-logs.sh [build-id]

set -e
cd "$(dirname "$0")/.."

export NODE_TLS_REJECT_UNAUTHORIZED=0

BUILD_ID="$1"
OUTPUT_FILE="/tmp/build-logs-$(date +%Y%m%d%H%M%S).txt"

if [ -z "$BUILD_ID" ]; then
    echo "Fetching most recent failed build..."
    BUILD_INFO=$(eas build:list --platform android --status errored --limit 1 --non-interactive --json 2>/dev/null)
    BUILD_ID=$(echo "$BUILD_INFO" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
fi

if [ -z "$BUILD_ID" ]; then
    echo "ERROR: No build ID found"
    exit 1
fi

echo "Fetching logs for build: $BUILD_ID"
echo "========================================" > "$OUTPUT_FILE"
echo "Build Logs for: $BUILD_ID" >> "$OUTPUT_FILE"
echo "Fetched: $(date)" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"

# Get build details including log URLs
BUILD_JSON=$(eas build:view "$BUILD_ID" --json 2>/dev/null)

# Extract error info
ERROR_CODE=$(echo "$BUILD_JSON" | grep -o '"errorCode":"[^"]*"' | sed 's/"errorCode":"//;s/"//')
ERROR_MSG=$(echo "$BUILD_JSON" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//')

echo "" >> "$OUTPUT_FILE"
echo "ERROR CODE: $ERROR_CODE" >> "$OUTPUT_FILE"
echo "ERROR MESSAGE: $ERROR_MSG" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract log URLs and fetch them
LOG_URLS=$(echo "$BUILD_JSON" | grep -o 'https://job-logs[^"]*' | head -5)

if [ -n "$LOG_URLS" ]; then
    echo "Fetching log files..." >> "$OUTPUT_FILE"
    LOG_NUM=1
    for URL in $LOG_URLS; do
        echo "" >> "$OUTPUT_FILE"
        echo "--- LOG FILE $LOG_NUM ---" >> "$OUTPUT_FILE"
        # Fetch log content (curl with timeout)
        LOG_CONTENT=$(curl -s --max-time 30 "$URL" 2>/dev/null | tail -200 || echo "Failed to fetch log")
        echo "$LOG_CONTENT" >> "$OUTPUT_FILE"
        LOG_NUM=$((LOG_NUM + 1))
    done
fi

echo "" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"
echo "END OF LOGS" >> "$OUTPUT_FILE"

echo "Logs saved to: $OUTPUT_FILE"
echo ""
echo "Summary:"
echo "  Error Code: $ERROR_CODE"
echo "  Error Message: $ERROR_MSG"
