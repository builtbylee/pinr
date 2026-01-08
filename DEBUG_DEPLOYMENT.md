# Debug Function Deployment

## Issue
Deployment completes but doesn't show the functions being created. Firebase CLI might not be detecting them.

## Updated Workflow

I've added debug steps to:
1. Verify functions are in the built code
2. Show detailed deployment output
3. Filter for function-specific messages

## Update in GitHub

Update `.github/workflows/deploy-functions-simple.yml` with these changes:

**After "Build functions" step, add:**
```yaml
      - name: Verify functions are built
        working-directory: ./functions
        run: |
          echo "Checking for functions in built code..."
          node -e "const f = require('./lib/index.js'); console.log('getAppleAuthUrl:', typeof f.getAppleAuthUrl); console.log('exchangeAppleAuthCode:', typeof f.exchangeAppleAuthCode);"
```

**Update "Deploy Functions" step to:**
```yaml
      - name: Deploy Functions
        run: |
          firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive --force --debug 2>&1 | tee deploy.log || true
          echo "=== Deployment Log ==="
          cat deploy.log | grep -i "getAppleAuthUrl\|exchangeAppleAuthCode\|creating\|updating\|successful" || echo "No function deployment messages found"
```

This will help us see:
- If functions are in the built code
- What Firebase CLI actually does during deployment
- Whether functions are created or if there's an error

