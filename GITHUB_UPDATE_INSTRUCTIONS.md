# Update Workflow in GitHub

## Current Issue
The GitHub version still has the old command. You need to update line 44.

## Steps to Update

1. **Go to the file in GitHub:**
   - https://github.com/builtbylee/pinr/blob/main/.github/workflows/deploy-functions-simple.yml

2. **Click the pencil icon** (Edit) in the top right

3. **Find line 44** - it currently says:
   ```yaml
   firebase deploy --only functions --project days-c4ad4 --non-interactive
   ```

4. **Replace it with:**
   ```yaml
   firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive --force
   ```

5. **Make sure the indentation is correct** - it should have spaces before it (aligned under `run: |`)

6. **Scroll down and click "Commit changes"**

## After Updating

1. Go to GitHub Actions
2. Click "Deploy Firebase Functions"
3. Click "Run workflow"
4. The new functions should be created!

