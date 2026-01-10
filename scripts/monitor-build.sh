#!/bin/bash
# EAS Build Monitor Script
# Monitors a running build and reports status
# Usage: ./monitor-build.sh [build-id]
# If no build-id provided, monitors the most recent build

set -e
cd "$(dirname "$0")/.."

export NODE_TLS_REJECT_UNAUTHORIZED=0

BUILD_ID="$1"
PLATFORM="${2:-android}"
STATUS_FILE="/tmp/build-monitor-status.txt"

echo "MONITORING" > "$STATUS_FILE"

# Get the most recent build if no ID provided
if [ -z "$BUILD_ID" ]; then
    echo "Fetching most recent $PLATFORM build..."
    BUILD_INFO=$(eas build:list --platform "$PLATFORM" --limit 1 --non-interactive --json 2>/dev/null | head -1000)
    BUILD_ID=$(echo "$BUILD_INFO" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

    if [ -z "$BUILD_ID" ]; then
        echo "ERROR: Could not find any builds" | tee "$STATUS_FILE"
        exit 1
    fi
fi

echo "Monitoring build: $BUILD_ID"
echo "Build ID: $BUILD_ID" >> "$STATUS_FILE"

# Get build status
BUILD_JSON=$(eas build:view "$BUILD_ID" --json 2>/dev/null || echo '{}')

STATUS=$(echo "$BUILD_JSON" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
ERROR_MSG=$(echo "$BUILD_JSON" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"//')
ARTIFACT_URL=$(echo "$BUILD_JSON" | grep -o '"buildUrl":"[^"]*"' | head -1 | sed 's/"buildUrl":"//;s/"//')

echo "" >> "$STATUS_FILE"
echo "Status: $STATUS" | tee -a "$STATUS_FILE"

case "$STATUS" in
    "FINISHED")
        echo "✅ BUILD SUCCEEDED" | tee -a "$STATUS_FILE"
        if [ -n "$ARTIFACT_URL" ]; then
            echo "Artifact: $ARTIFACT_URL" | tee -a "$STATUS_FILE"
        fi
        echo "SUCCESS" > "$STATUS_FILE"
        ;;
    "ERRORED"|"CANCELED")
        echo "❌ BUILD FAILED" | tee -a "$STATUS_FILE"
        if [ -n "$ERROR_MSG" ]; then
            echo "Error: $ERROR_MSG" | tee -a "$STATUS_FILE"
        fi
        # Fetch log URLs
        LOG_URLS=$(echo "$BUILD_JSON" | grep -o '"logFiles":\[[^]]*\]' | head -1)
        if [ -n "$LOG_URLS" ]; then
            echo "Log files available for analysis" >> "$STATUS_FILE"
        fi
        echo "FAILED" > "$STATUS_FILE"
        echo "$ERROR_MSG" >> "$STATUS_FILE"
        ;;
    "IN_PROGRESS"|"IN_QUEUE"|"NEW")
        echo "⏳ BUILD IN PROGRESS" | tee -a "$STATUS_FILE"
        echo "IN_PROGRESS" > "$STATUS_FILE"
        ;;
    *)
        echo "⏳ Status: $STATUS" | tee -a "$STATUS_FILE"
        echo "IN_PROGRESS" > "$STATUS_FILE"
        ;;
esac

echo ""
echo "Status file: $STATUS_FILE"
