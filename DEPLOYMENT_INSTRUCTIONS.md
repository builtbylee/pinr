# Apple Sign-In on Android - Final Deployment Instructions

## ✅ Status: Code Complete, Deployment Pending

All code is implemented and ready. The only remaining step is deploying the Cloud Functions.

## 🚀 Quick Deployment (Choose One Method)

### Method 1: GitHub Actions (Recommended - Automated)

**Step 1: Update Workflow in GitHub UI**
1. Go to: https://github.com/builtbylee/pinr/blob/firestore-ios-optimization/.github/workflows/deploy-functions-simple.yml
2. Click the pencil icon (Edit)
3. Replace entire file with the content from the local file (already committed)
4. Click "Commit changes"

**Step 2: Trigger Workflow**
1. Go to: https://github.com/builtbylee/pinr/actions
2. Click "Deploy Firebase Functions" in left sidebar
3. Click "Run workflow" button (top right)
4. Select branch: `firestore-ios-optimization` (or merge to `main` first)
5. Click green "Run workflow" button

**Step 3: Monitor Deployment**
- Watch the workflow run
- Check "Verify Apple Functions Deployed" step
- Should show: `✅ Apple functions are deployed!`

### Method 2: Local Deployment (If Firebase CLI is Authenticated)

```bash
cd /Users/lee/Projects/primal-singularity
bash scripts/deploy-apple-functions.sh
```

Or manually:
```bash
cd functions
npm ci
npm run build
cd ..
firebase deploy --only functions --project days-c4ad4
```

## ✅ Verification

After deployment, verify functions exist:

```bash
firebase functions:list --project days-c4ad4 | grep -i "getAppleAuthUrl\|exchangeAppleAuthCode"
```

Or check Firebase Console:
- Go to: https://console.firebase.google.com/project/days-c4ad4/functions
- Look for: `getAppleAuthUrl` and `exchangeAppleAuthCode`

## 🧪 Testing

Once deployed, test on Android device:
1. Open app
2. Tap "Sign in with Apple"
3. Should open browser for Apple authentication
4. After authentication, should sign into Firebase

## 📋 What's Already Done

✅ Cloud Functions implemented (`getAppleAuthUrl`, `exchangeAppleAuthCode`)
✅ Android client code implemented (`signInWithAppleAndroid`)
✅ GitHub Actions workflow updated
✅ Deployment script created
✅ TypeScript compilation fixed
✅ All code committed to `firestore-ios-optimization` branch

## 🐛 If Deployment Fails

1. **Functions not discovered**: The workflow now deploys ALL functions, which forces discovery
2. **Build errors**: Check TypeScript compilation (should only have minor warnings)
3. **Permission errors**: Verify service account has correct permissions
4. **Functions not appearing**: Check Firebase Console directly

## 📞 Next Steps After Deployment

1. Verify functions appear in Firebase Console
2. Test on Android device
3. Monitor Cloud Functions logs for any errors
4. If successful, merge `firestore-ios-optimization` to `main`

---

**Note**: The workflow file cannot be pushed via git due to PAT scope limitations. It must be updated manually in GitHub UI (takes 30 seconds).
