# GitHub Actions Workflow - Manual Creation

Since your Personal Access Token doesn't have the `workflow` scope, create the workflow file directly in GitHub's web UI.

## Steps:

1. **Go to your repository on GitHub:**
   - https://github.com/builtbylee/pinr

2. **Click "Add file" → "Create new file"**

3. **Enter the path:**
   ```
   .github/workflows/deploy-functions-simple.yml
   ```

4. **Copy and paste this content:**

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
      
      - name: Authenticate with Firebase
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
      
      - name: Deploy Functions
        run: |
          firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive
```

5. **Scroll down and click "Commit new file"**

6. **After committing, go to Actions tab and trigger the workflow**

## Alternative: Update PAT with workflow scope

If you prefer to push via CLI:

1. Go to: https://github.com/settings/tokens
2. Edit your Personal Access Token
3. Check the `workflow` scope
4. Save and try pushing again

