# Fix Node.js SSL Certificate Issue for Firebase CLI

## Problem
Node.js can't verify SSL certificates, causing Firebase CLI login to fail with:
```
Error: Failed to make request to https://auth.firebase.tools/attest
```

Root cause: `unable to get local issuer certificate`

## Solutions (Try in Order)

### Solution 1: Update Node.js Certificates (Recommended)

```bash
# If using Homebrew Node.js
brew reinstall node

# Or update certificates manually
npm config set cafile ""
npm config set strict-ssl true
```

### Solution 2: Use NVM to Reinstall Node.js

```bash
# Install/update nvm if needed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install latest LTS Node.js
nvm install --lts
nvm use --lts

# Verify
node --version
```

### Solution 3: Temporary Workaround (NOT for Production)

```bash
# Set environment variable to skip SSL verification (TEMPORARY ONLY)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Try login
firebase login --no-localhost

# IMPORTANT: Unset after use
unset NODE_TLS_REJECT_UNAUTHORIZED
```

### Solution 4: Use Service Account (Best Long-term Solution)

Skip login entirely by using a service account:

1. Download service account key from Firebase Console
2. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
   ```
3. Deploy without login:
   ```bash
   firebase deploy --only functions,firestore:rules
   ```

## Quick Test

After trying a solution, test Node.js SSL:

```bash
node -e "const https = require('https'); https.get('https://auth.firebase.tools/attest', (r) => console.log('SUCCESS:', r.statusCode)).on('error', (e) => console.error('ERROR:', e.message));"
```

If you see "SUCCESS: 400" (not an error), SSL is working!










