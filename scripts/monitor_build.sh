BUILD_ID="dd6eea35-536d-4cd1-a756-021b403afe15"
while true; do
  # Capture full JSON output
  JSON=$(NODE_TLS_REJECT_UNAUTHORIZED=0 eas build:view $BUILD_ID --json)
  
  # Extract status (simple grep approach or use jq if available, user has mac so likely not jq by default or maybe yes, but grep is safer)
  STATUS=$(echo "$JSON" | grep '"status":' | head -n 1 | awk -F '"' '{print $4}')
  
  echo "$(date): Status is $STATUS"
  
  if [ "$STATUS" == "finished" ]; then
    echo "BUILD SUCCESS"
    exit 0
  fi
  
  if [ "$STATUS" == "errored" ]; then
    echo "BUILD FAILED"
    exit 1
  fi
  
  if [ "$STATUS" == "canceled" ]; then
    echo "BUILD CANCELED"
    exit 1
  fi

  sleep 30
done
