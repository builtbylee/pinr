# Firebase Login - Step by Step Instructions

## Current Status

You've started `firebase login` and it's asking about Gemini features.

## Steps to Complete:

### 1. Answer Gemini Question
- Type `n` (or `Y` if you want Gemini features)
- Press Enter

### 2. Complete Browser Authentication
The CLI will either:
- **Option A**: Automatically open your browser
  - Sign in with your Google account
  - Grant permissions
  - You'll see "Success! Logged in as [your-email]"

- **Option B**: Show a URL and code
  - Copy the URL shown
  - Open it in your browser
  - Enter the code when prompted
  - Sign in with your Google account
  - Grant permissions

### 3. Verify Success
After authentication, you should see:
```
✅ Success! Logged in as [your-email]
```

### 4. Run Deployment Script
Once you see the success message, run:

```bash
./scripts/firebase-complete-auth.sh
```

Or if you want to deploy directly:

```bash
firebase deploy --only functions:getAppleAuthUrl,functions:exchangeAppleAuthCode
```

## Troubleshooting

### If you see "Unable to fetch the CLI MOTD"
This is a **non-fatal warning**. It means the CLI couldn't fetch the message of the day, but authentication should still work.

### If authentication fails:
1. Make sure you're connected to the internet
2. Try: `firebase logout` then `firebase login` again
3. Check that you're using the correct Google account

### If browser doesn't open:
Use the `--no-localhost` flag:
```bash
firebase login --no-localhost
```
This will show you a URL and code to use manually.

## After Authentication

Once authenticated, credentials will be saved to:
- `~/.config/firebase/activeAccounts.json`
- `~/.config/firebase/config.json`

These files will persist, so you won't need to log in again for future deployments.

