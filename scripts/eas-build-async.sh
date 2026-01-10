#!/bin/bash
# EAS Build Async Wrapper for Antigravity
# This script runs EAS build in a way that avoids agent timeouts

set -e

PLATFORM="${1:-android}"
PROFILE="${2:-production}"
LOG_FILE="/tmp/eas-build-${PLATFORM}-$(date +%Y%m%d%H%M%S).log"
STATUS_FILE="/tmp/eas-build-status.txt"

echo "STARTING" > "$STATUS_FILE"
echo "Log file: $LOG_FILE"
echo "Status file: $STATUS_FILE"

# Run EAS build in background with nohup
cd "$(dirname "$0")/.."

nohup bash -c "
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  echo 'Build started at: $(date)' > '$LOG_FILE'
  echo 'Platform: $PLATFORM' >> '$LOG_FILE'
  echo 'Profile: $PROFILE' >> '$LOG_FILE'
  echo '---' >> '$LOG_FILE'

  if eas build --platform '$PLATFORM' --profile '$PROFILE' --non-interactive --no-wait >> '$LOG_FILE' 2>&1; then
    echo 'SUBMITTED' > '$STATUS_FILE'
    echo '---' >> '$LOG_FILE'
    echo 'Build submitted successfully at: $(date)' >> '$LOG_FILE'
    # Extract build URL from log
    grep -E 'https://expo.dev.*builds' '$LOG_FILE' >> '$STATUS_FILE' 2>/dev/null || true
  else
    echo 'FAILED' > '$STATUS_FILE'
    echo '---' >> '$LOG_FILE'
    echo 'Build submission failed at: $(date)' >> '$LOG_FILE'
  fi
" > /dev/null 2>&1 &

echo "Build process started in background (PID: $!)"
echo "Check status: cat $STATUS_FILE"
echo "View log: tail -f $LOG_FILE"
