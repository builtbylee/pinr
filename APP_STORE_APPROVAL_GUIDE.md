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
- [ ] **Privacy Policy URL** - **MISSING** (must be publicly accessible) ⚠️
- [ ] **Terms of Service** - **MISSING** ⚠️
- [ ] **Support Contact** - **MISSING** ⚠️
- [ ] **Support URL** - **MISSING** ⚠️

#### Content Guidelines
- [x] **No Offensive Content** - App appears clean ✅
- [x] **No Copyright Violations** - Original content ✅
- [x] **User-Generated Content** - Photos/pins (need moderation plan) ⚠️
- [ ] **Content Moderation** - **MISSING** (for user photos/pins) ⚠️

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

2. **Legal & Support**
   - Privacy Policy URL (must be publicly accessible)
   - Terms of Service
   - Support URL
   - Contact information

3. **Content Moderation**
   - Plan for moderating user-generated content (photos, pins)
   - Reporting mechanism for inappropriate content

4. **Age Rating**
   - Must complete age rating questionnaire in App Store Connect

---

## Missing Requirements

### 🔴 **Critical (Must Have Before Submission)**

1. **Privacy Policy URL**
   - **Status:** Privacy policy exists but not hosted
   - **Action:** Host `privacy-policy.html` on a public URL
   - **Recommendation:** Use GitHub Pages (builtbylee.github.io/pinr/privacy-policy)
   - **Required in:** App Store Connect → App Information → Privacy Policy URL

2. **Support URL**
   - **Status:** Missing
   - **Action:** Create support page or use email
   - **Recommendation:** `https://builtbylee.github.io/pinr/support` or `mailto:support@yourdomain.com`
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
   - **Status:** Missing
   - **Action:** Create terms of service document
   - **Should cover:**
     - User responsibilities
     - Content ownership
     - Prohibited uses
     - Account termination
     - Limitation of liability

8. **Content Moderation Plan**
   - **Status:** Missing
   - **Action:** Implement reporting mechanism for inappropriate content
   - **Consider:**
     - In-app reporting feature
     - Automated content filtering
     - Manual review process
     - User blocking capabilities

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

1. **Host Privacy Policy**
   ```bash
   # Option 1: GitHub Pages
   # Copy privacy-policy.html to docs/ folder
   # Push to GitHub
   # Access at: https://builtbylee.github.io/pinr/privacy-policy.html
   
   # Option 2: Your own domain
   # Upload to your web server
   ```

2. **Create Terms of Service**
   - Use template or legal service
   - Host at: `https://builtbylee.github.io/pinr/terms.html`
   - Include in app settings (optional but recommended)

3. **Create Support Page**
   - Simple HTML page with contact form or email
   - Host at: `https://builtbylee.github.io/pinr/support.html`
   - Or use: `mailto:support@yourdomain.com`

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

### Phase 3: Content Moderation (Week 2)

7. **Implement Reporting Feature**
   - Add "Report" button to pins/photos
   - Create admin dashboard for reviewing reports
   - Set up email notifications for reports

8. **Add Content Guidelines**
   - Create user guidelines page
   - Link from app settings
   - Include in terms of service

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

