# Workflow File Content for GitHub UI

Since workflow files cannot be pushed via git due to PAT scope limitations, copy this content into GitHub UI.

## Steps

1. Go to: https://github.com/builtbylee/pinr/tree/firestore-ios-optimization
2. Navigate to `.github/workflows/` folder (create it if it doesn't exist)
3. Click "Add file" → "Create new file"
4. Name it: `deploy-functions-simple.yml`
5. Paste the content below
6. Click "Commit new file"

## File Content

```yaml
name: Deploy Firebase Functions

on:
  workflow_dispatch: # Manual trigger only
  push:
    branches:
      - main
    paths:
      - 'functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools@latest
      
      - name: Install function dependencies
        working-directory: ./functions
        run: npm ci
      
      - name: Build functions
        working-directory: ./functions
        run: npm run build
      
      - name: Verify functions in built code
        working-directory: ./functions
        run: |
          echo "=== Verifying Apple functions in built code ==="
          node -e "
          const f = require('./lib/index.js');
          const appleFunctions = ['getAppleAuthUrl', 'exchangeAppleAuthCode'];
          let allFound = true;
          for (const funcName of appleFunctions) {
              if (typeof f[funcName] === 'function') {
                  console.log('✅', funcName, 'EXISTS in built code');
              } else {
                  console.log('❌', funcName, 'MISSING from built code');
                  allFound = false;
              }
          }
          if (!allFound) {
              console.error('ERROR: Functions missing from built code!');
              process.exit(1);
          }
          "
      
      - name: Authenticate with Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
      
      - name: Deploy ALL Functions (Force Discovery)
        run: |
          echo "=== Deploying ALL functions to force discovery ==="
          firebase deploy --only functions --project days-c4ad4 --non-interactive 2>&1 | tee deploy-all.log
          echo ""
          echo "=== Checking deployment results ==="
          if grep -q "getAppleAuthUrl\|exchangeAppleAuthCode" deploy-all.log; then
            echo "✅ Apple functions found in deployment log"
            grep -i "getAppleAuthUrl\|exchangeAppleAuthCode" deploy-all.log
          else
            echo "⚠️  Apple functions not mentioned in deployment log"
          fi
      
      - name: Verify Apple Functions Deployed
        run: |
          echo "=== Verifying functions exist in Firebase ==="
          firebase functions:list --project days-c4ad4 2>&1 | tee functions-list.log
          echo ""
          if grep -qi "getAppleAuthUrl\|exchangeAppleAuthCode" functions-list.log; then
            echo "✅ Apple functions are deployed!"
            grep -i "getAppleAuthUrl\|exchangeAppleAuthCode" functions-list.log
          else
            echo "❌ Apple functions NOT found in deployed functions"
            echo "Full function list:"
            cat functions-list.log
            exit 1
          fi
```

## After Creating the File

1. Go to: https://github.com/builtbylee/pinr/actions
2. Click "Deploy Firebase Functions"
3. Click "Run workflow"
4. Select branch: `firestore-ios-optimization`
5. Click "Run workflow"

The workflow will deploy all functions, including the Apple Sign-In functions.

