# Apple App Store Approval Guide for Pinr

**Last Updated:** 2026-01-07  
**App Name:** Pinr  
**Bundle ID:** com.builtbylee.app80days  
**Current Version:** 1.0.0 (Build 5)

---

## 📋 Table of Contents

1. [App Store Review Process](#app-store-review-process)
2. [Required Information Checklist](#required-information-checklist)
3. [Current Status Assessment](#current-status-assessment)
4. [Missing Requirements](#missing-requirements)
5. [Action Items](#action-items)
6. [Common Rejection Reasons](#common-rejection-reasons)

---

## App Store Review Process

### Overview
Apple reviews all apps before they appear in the App Store. The review process typically takes **24-48 hours** but can take up to 7 days for complex apps.

### Steps:
1. **Submit for Review** - Upload build via App Store Connect
2. **In Review** - Apple reviews your app (24-48 hours typically)
3. **Pending Developer Release** - Approved, waiting for you to release
4. **Ready for Sale** - App is live in the App Store
5. **Rejected** - Issues found, must fix and resubmit

### Review Criteria:
- **Functionality** - App works as described
- **Content** - No offensive, illegal, or inappropriate content
- **Privacy** - Proper privacy policy and data handling
- **Guidelines Compliance** - Follows Apple's Human Interface Guidelines
- **Legal** - No copyright violations, proper licensing

---

## Required Information Checklist

### ✅ **1. App Store Connect Information**

#### App Information
- [ ] **App Name** (30 characters max) - Currently: "Pinr" ✅
- [ ] **Subtitle** (30 characters max) - Optional but recommended
- [ ] **Category** - Primary: Travel, Secondary: Social Networking
- [ ] **Age Rating** - Must complete questionnaire
- [ ] **App Description** (4000 characters max) - **MISSING**
- [ ] **Keywords** (100 characters max) - **MISSING**
- [ ] **Support URL** - **MISSING** ⚠️
- [ ] **Marketing URL** - Optional
- [ ] **Privacy Policy URL** - **MISSING** ⚠️
- [ ] **Promotional Text** (170 characters) - Optional

#### App Icon & Screenshots
- [ ] **App Icon** (1024x1024px) - ✅ Exists
- [ ] **iPhone Screenshots** (6.7", 6.5", 5.5" displays) - **MISSING**
- [ ] **iPad Screenshots** (12.9", 11") - **MISSING** (app supports iPad)
- [ ] **App Preview Video** - Optional but recommended

#### Pricing & Availability
- [ ] **Price** - Free or paid
- [ ] **Availability** - Countries/regions
- [ ] **In-App Purchases** - None (app doesn't have IAP) ✅

---

### ✅ **2. Technical Requirements**

#### Build Configuration
- [x] **Bundle Identifier** - `com.builtbylee.app80days` ✅
- [x] **Version Number** - 1.0.0 ✅
- [x] **Build Number** - 5 ✅
- [x] **Minimum iOS Version** - iOS 12.0 ✅
- [x] **App Icon** - Configured ✅
- [x] **Launch Screen** - Configured ✅

#### Permissions & Privacy
- [x] **Location Permission** - `NSLocationWhenInUseUsageDescription` ✅
- [x] **Camera Permission** - `NSCameraUsageDescription` ✅
- [x] **Photo Library Permission** - `NSPhotoLibraryUsageDescription` ✅
- [x] **Microphone Permission** - `NSMicrophoneUsageDescription` ✅
- [x] **Face ID Permission** - `NSFaceIDUsageDescription` ✅
- [x] **Privacy Manifest** - `PrivacyInfo.xcprivacy` ✅
- [ ] **Privacy Policy URL** - **MISSING** ⚠️
- [x] **No Tracking** - `NSPrivacyTracking = false` ✅

#### Required APIs Declaration
- [x] **File Timestamp APIs** - Declared in PrivacyInfo.xcprivacy ✅
- [x] **UserDefaults APIs** - Declared in PrivacyInfo.xcprivacy ✅
- [x] **System Boot Time APIs** - Declared in PrivacyInfo.xcprivacy ✅
- [x] **Disk Space APIs** - Declared in PrivacyInfo.xcprivacy ✅

---

### ✅ **3. Content Requirements**

#### Legal & Privacy
- [x] **Privacy Policy** - Exists (`privacy-policy.html`) ✅
- [x] **Privacy Policy URL** - Exists in app (`https://builtbylee.github.io/pinr/`) ✅
- [x] **Terms of Service** - Exists (`TermsModal` component) ✅
- [x] **Support Contact** - Exists (email: `pinr.builtbylee@gmail.com`) ✅
- [x] **Support URL** - Exists (email link in app) ✅

#### Content Guidelines
- [x] **No Offensive Content** - App appears clean ✅
- [x] **No Copyright Violations** - Original content ✅
- [x] **User-Generated Content** - Photos/pins ✅
- [x] **Content Moderation Infrastructure** - Backend ready (`moderateImage` Cloud Function) ✅
- [ ] **Content Moderation Active** - **NOT INTEGRATED** (needs activation in upload flow) ⚠️

---

### ✅ **4. Functionality Requirements**

#### Core Features
- [x] **App Launches** - ✅
- [x] **Authentication** - Google/Apple Sign-In ✅
- [x] **Core Functionality Works** - Map, pins, photos ✅
- [x] **No Crashes** - Should be tested thoroughly ⚠️
- [x] **Network Handling** - Graceful offline handling ⚠️

#### Third-Party Services
- [x] **Firebase** - Configured ✅
- [x] **Mapbox** - Configured ✅
- [x] **OneSignal** - Configured ✅
- [x] **Google Sign-In** - Configured ✅
- [x] **Apple Sign-In** - Configured ✅

---

## Current Status Assessment

### ✅ **What's Already Done**

1. **Technical Setup**
   - Bundle identifier configured
   - Permissions properly declared
   - Privacy manifest (PrivacyInfo.xcprivacy) exists
   - No tracking declared
   - App icon and launch screen configured
   - Minimum iOS version set (12.0)

2. **Privacy Compliance**
   - Privacy policy document exists
   - PrivacyInfo.xcprivacy properly configured
   - No tracking (NSPrivacyTracking = false)
   - Required API usage reasons declared

3. **Authentication**
   - Google Sign-In configured
   - Apple Sign-In configured
   - Proper permission descriptions

### ⚠️ **What's Missing**

1. **App Store Connect Metadata**
   - App description
   - Keywords
   - Screenshots (all required sizes)
   - App preview video (optional but recommended)

2. **Privacy Policy URL Verification**
   - Privacy Policy URL exists in app (`https://builtbylee.github.io/pinr/`)
   - **Action:** Verify this URL actually serves the privacy policy page
   - **Note:** App currently links to landing page, may need direct link to `privacy-policy.html`

3. **Content Moderation Activation**
   - Moderation infrastructure exists but is **NOT ACTIVE**
   - `moderateImage` Cloud Function is deployed
   - `ModerationService.ts` exists
   - **Action:** Integrate moderation into `uploadImage` flow in `storageService.ts`
   - **Flow:** Upload → Moderate → If fails, delete image and show error

4. **Age Rating**
   - Must complete age rating questionnaire in App Store Connect

---

## Missing Requirements

### 🔴 **Critical (Must Have Before Submission)**

1. **Privacy Policy URL Verification**
   - **Status:** URL exists in app (`https://builtbylee.github.io/pinr/`) but may need direct link
   - **Action:** Verify URL serves privacy policy correctly
   - **Current:** App links to landing page, which has privacy policy link
   - **Recommendation:** Use direct URL: `https://builtbylee.github.io/pinr/privacy-policy.html`
   - **Update:** Change Settings link to direct privacy policy URL
   - **Required in:** App Store Connect → App Information → Privacy Policy URL

2. **Support URL**
   - **Status:** ✅ Exists (email: `pinr.builtbylee@gmail.com`)
   - **Action:** Use email URL: `mailto:pinr.builtbylee@gmail.com?subject=Pinr Support Request`
   - **Note:** Apple accepts email URLs for support
   - **Required in:** App Store Connect → App Information → Support URL

3. **App Description**
   - **Status:** Missing
   - **Action:** Write compelling description (4000 characters max)
   - **Should include:**
     - What the app does
     - Key features
     - Who it's for
     - Why users should download it

4. **Keywords**
   - **Status:** Missing
   - **Action:** Research and add relevant keywords (100 characters max)
   - **Examples:** travel, map, memories, pins, social, friends, globe, journey

5. **Screenshots**
   - **Status:** Missing
   - **Action:** Create screenshots for all required device sizes:
     - iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max)
     - iPhone 6.5" (iPhone 11 Pro Max, XS Max)
     - iPhone 5.5" (iPhone 8 Plus)
     - iPad 12.9" (if supporting iPad)
     - iPad 11" (if supporting iPad)
   - **Tip:** Use Simulator or physical device to capture

6. **Age Rating**
   - **Status:** Not completed
   - **Action:** Complete age rating questionnaire in App Store Connect
   - **Likely Rating:** 4+ (no objectionable content, but user-generated content may require 12+)

### 🟡 **Important (Strongly Recommended)**

7. **Terms of Service**
   - **Status:** ✅ Exists (`TermsModal` component in app)
   - **Action:** Verify terms are comprehensive and cover all necessary areas
   - **Note:** Terms are shown in-app, which is acceptable for App Store

8. **Content Moderation Activation** ⚠️ **REQUIRED**
   - **Status:** Infrastructure ready but **NOT ACTIVE**
   - **Backend:** `moderateImage` Cloud Function deployed ✅
   - **Service:** `ModerationService.ts` exists ✅
   - **Integration:** **MISSING** - Not called in upload flow ❌
   - **Action:** Integrate moderation into `storageService.ts` upload flow:
     ```typescript
     // After uploadImage in storageService.ts:
     1. Upload image to Firebase Storage
     2. Get download URL
     3. Call moderateImage(downloadUrl)
     4. If not approved:
        - Delete image from Storage
        - Show error to user
        - Return error
     5. If approved:
        - Return download URL
     ```
   - **Files to modify:**
     - `src/services/storageService.ts` - Add moderation check after upload
     - `src/services/StoryService.ts` - Handle moderation errors

9. **App Preview Video**
   - **Status:** Missing (optional)
   - **Action:** Create 15-30 second video showcasing app features
   - **Benefit:** Significantly increases conversion rate

10. **Subtitle**
    - **Status:** Missing (optional)
    - **Action:** Add catchy subtitle (30 characters max)
    - **Example:** "Share your travel journey"

### 🟢 **Nice to Have**

11. **Marketing URL**
    - **Status:** Missing (optional)
    - **Action:** Create landing page for app marketing

12. **Promotional Text**
    - **Status:** Missing (optional)
    - **Action:** Add promotional text that can be updated without resubmission

---

## Action Items

### Phase 1: Legal & Support (Week 1)

1. **Verify Privacy Policy URL**
   - **Status:** URL exists but may need direct link
   - **Action:** Update Settings link to: `https://builtbylee.github.io/pinr/privacy-policy.html`
   - **Verify:** URL is publicly accessible and serves privacy policy
   - **File:** `src/components/SettingsModal.tsx` line ~1019

2. **Terms of Service** ✅
   - **Status:** Already exists in `TermsModal` component
   - **Action:** Review terms for completeness
   - **Note:** In-app terms are acceptable for App Store

3. **Support Contact** ✅
   - **Status:** Already exists (email: `pinr.builtbylee@gmail.com`)
   - **Action:** Use this email URL in App Store Connect

### Phase 2: App Store Connect Setup (Week 1-2)

4. **Complete App Information**
   - Log into App Store Connect
   - Navigate to your app
   - Fill in all required fields:
     - App description
     - Keywords
     - Privacy Policy URL
     - Support URL
     - Category
     - Age rating questionnaire

5. **Create Screenshots**
   - Use iOS Simulator or physical device
   - Capture key screens:
     - Map view with pins
     - Pin creation flow
     - Profile/settings
     - Friends/social features
   - Create for all required sizes
   - Use design tool to add captions/annotations (optional)

6. **Create App Preview Video** (Optional)
   - Record 15-30 second demo
   - Show key features
   - Add captions/text overlays

### Phase 3: Content Moderation (Week 2) ⚠️ **CRITICAL**

7. **Activate Image Moderation** 🔴 **REQUIRED BEFORE SUBMISSION**
   - **Status:** Infrastructure ready, integration missing
   - **Action:** Integrate `ModerationService` into upload flow
   - **Steps:**
     1. Modify `src/services/storageService.ts`:
        - After `uploadImage` gets download URL
        - Call `moderateImage(downloadUrl)` from `ModerationService`
        - If not approved: delete image, throw error
        - If approved: return URL
     2. Update error handling in `StoryService.ts` to show user-friendly messages
     3. Test with inappropriate images (ensure they're blocked)
   - **Files to modify:**
     - `src/services/storageService.ts`
     - `src/services/StoryService.ts` (error handling)

8. **Content Reporting** ✅
   - **Status:** Reporting feature exists (reports collection in Firestore)
   - **Action:** Verify reporting flow works end-to-end
   - **Note:** `onReportCreated` Cloud Function handles reports

### Phase 4: Final Testing (Week 2-3)

9. **Comprehensive Testing**
   - Test on multiple iOS devices
   - Test all features
   - Test offline scenarios
   - Test edge cases
   - Ensure no crashes

10. **Prepare for Submission**
    - Build production version
    - Archive in Xcode or use EAS Build
    - Upload to App Store Connect
    - Submit for review

---

## Common Rejection Reasons

### 1. **Privacy Policy Issues**
- **Issue:** Privacy policy not accessible or incomplete
- **Fix:** Ensure URL is publicly accessible and policy is comprehensive

### 2. **Missing Support Information**
- **Issue:** Support URL invalid or no contact method
- **Fix:** Provide valid support URL or email

### 3. **Incomplete App Information**
- **Issue:** Missing description, keywords, or screenshots
- **Fix:** Complete all required fields in App Store Connect

### 4. **Crashes or Bugs**
- **Issue:** App crashes during review
- **Fix:** Thoroughly test app before submission

### 5. **User-Generated Content**
- **Issue:** No moderation plan for user content
- **Fix:** Implement reporting mechanism and content guidelines

### 6. **Misleading Functionality**
- **Issue:** App doesn't work as described
- **Fix:** Ensure app description matches actual functionality

### 7. **Inappropriate Content**
- **Issue:** User can post offensive content
- **Fix:** Implement content filtering and moderation

### 8. **Missing Permissions Justification**
- **Issue:** Permission descriptions not clear
- **Fix:** Ensure all permission descriptions explain why access is needed

---

## Quick Reference: App Store Connect URLs

- **App Store Connect:** https://appstoreconnect.apple.com
- **App Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Human Interface Guidelines:** https://developer.apple.com/design/human-interface-guidelines/

---

## Next Steps

1. **Immediate:** Host privacy policy and create support URL
2. **This Week:** Complete App Store Connect metadata
3. **Next Week:** Create screenshots and test thoroughly
4. **Before Submission:** Review all requirements checklist items

---

**Note:** This guide is based on current App Store requirements as of January 2026. Requirements may change, so always check the latest Apple documentation before submission.

