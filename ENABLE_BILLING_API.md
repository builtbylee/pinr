# Enable Cloud Billing API

## New Error
```
Cloud Billing API has not been used in project 760973100570 before or it is disabled.
```

## Progress! ✅
We're getting further! Now we just need to enable the Cloud Billing API.

## Solution: Enable Cloud Billing API

### Step 1: Enable the API

Click this direct link:
https://console.developers.google.com/apis/api/cloudbilling.googleapis.com/overview?project=days-c4ad4

OR manually:
1. Go to: https://console.cloud.google.com/apis/library?project=days-c4ad4
2. Search for: "Cloud Billing API"
3. Click on it
4. Click "ENABLE"

### Step 2: Wait for Propagation

After enabling:
- Wait 1-2 minutes for the API to propagate
- The API needs to be activated across Google's systems

### Step 3: Retry Deployment

1. Go back to GitHub Actions
2. Click "Re-run jobs"
3. Should work now! ✅

## Important Notes

- **Billing must be enabled** on your Firebase project for this to work
- If billing isn't set up, you'll need to add a payment method first
- Firebase Blaze plan is required for Cloud Functions (but has a free tier)

## Check Billing Status

If you get a billing error:
1. Go to: https://console.firebase.google.com/project/days-c4ad4/settings/usage
2. Ensure billing is enabled
3. Add payment method if needed

