# Fix Workflow - Updated Authentication

## Issue
Firebase CLI needs proper authentication. I've updated the workflow to use Google Cloud authentication tokens.

## Updated Workflow

The workflow file has been updated. You need to update it in GitHub:

### Steps:

1. **Go to your repository:**
   - https://github.com/builtbylee/pinr

2. **Navigate to the workflow file:**
   - Click on `.github/workflows/deploy-functions-simple.yml`
   - Click the pencil icon to edit

3. **Replace the "Deploy Functions" step** with this:

```yaml
      - name: Authenticate with Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
      
      - name: Deploy Functions
        run: |
          firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode --project days-c4ad4 --non-interactive --token "$(gcloud auth print-access-token)"
```

4. **Commit the changes**

5. **Run the workflow again**

## Alternative: Check the Actual Error First

Before updating, please:
1. Click on the failed "deploy" job
2. Expand each step to see which one failed
3. Copy the error message
4. Share it with me so I can provide a more targeted fix

The error message will tell us exactly what went wrong!

