# BlurView Configuration Backup

This document contains the complete configuration of all `expo-blur` BlurView components in the codebase. This is a backup to enable safe reversion if React Native Skia implementation is not satisfactory.

**Package:** `expo-blur@~14.1.5`

---

## 1. TermsModal.tsx

**Location:** `src/components/TermsModal.tsx`  
**Line:** 32

**Configuration:**
```tsx
{Platform.OS === 'ios' ? (
    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
)}
```

**Details:**
- **Intensity:** `20`
- **Tint:** `"dark"`
- **Style:** `StyleSheet.absoluteFill`
- **Platform:** iOS only (Android uses solid color overlay)
- **Purpose:** Backdrop blur for Terms & Code of Conduct modal

---

## 2. StoryEditorModal.tsx

**Location:** `src/components/StoryEditorModal.tsx`  
**Line:** 197

**Configuration:**
```tsx
<BlurView intensity={20} style={styles.container}>
    {/* Content */}
</BlurView>
```

**Details:**
- **Intensity:** `20`
- **Tint:** Not specified (defaults to "light")
- **Style:** `styles.container` (defined below)
- **Platform:** Both iOS and Android
- **Purpose:** Full-screen modal backdrop for story editor

**Container Style:**
```tsx
container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
}
```

---

## 3. DestinationCard.tsx

**Location:** `src/components/DestinationCard.tsx`  
**Line:** 146-171

**Configuration:**
```tsx
<BlurView
    intensity={Platform.OS === 'ios' ? 40 : 60}
    tint="dark"
    style={styles.blurPill}
>
    <View style={styles.blurOverlay}>
        {/* Frosted pill content */}
    </View>
</BlurView>
```

**Details:**
- **Intensity:** `40` (iOS) / `60` (Android)
- **Tint:** `"dark"`
- **Style:** `styles.blurPill` (defined below)
- **Platform:** Both iOS and Android (different intensities)
- **Purpose:** Frosted glass pill at bottom of destination card showing title, location, and date

**BlurPill Style:**
```tsx
blurPill: {
    borderRadius: 24,
    overflow: 'hidden',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
}
```

**BlurOverlay Style:**
```tsx
blurOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Darker overlay for better text contrast
    width: '100%',
}
```

---

## 4. ManageVisibilityModal.tsx

**Location:** `src/components/ManageVisibilityModal.tsx`  
**Line:** N/A (BlurView imported but NOT used)

**Status:** ⚠️ **UNUSED IMPORT**  
- BlurView is imported but the component uses a solid color backdrop (`rgba(0,0,0,0.5)`) instead
- The modal uses `Animated.View` with `backgroundColor: 'rgba(255, 255, 255, 0.95)'` for the card

---

## 5. ProfileModal.tsx

**Location:** `src/components/ProfileModal.tsx`  
**Line:** N/A (BlurView imported but NOT used)

**Status:** ⚠️ **UNUSED IMPORT**  
- BlurView is imported but not actually rendered in the component
- The modal uses standard `View` components with solid backgrounds

---

## 6. ExploreSearchBar.tsx

**Location:** `src/components/ExploreSearchBar.tsx`  
**Line:** N/A (BlurView imported but NOT used)

**Status:** ⚠️ **UNUSED IMPORT**  
- BlurView is imported but not actually rendered in the component
- The search bar uses a solid white background (`backgroundColor: '#fff'`)

---

## Summary

### Active BlurView Components (3):
1. **TermsModal** - iOS only, dark tint, intensity 20
2. **StoryEditorModal** - Both platforms, light tint (default), intensity 20
3. **DestinationCard** - Both platforms, dark tint, intensity 40 (iOS) / 60 (Android)

### Unused Imports (3):
1. **ManageVisibilityModal** - Imported but not used
2. **ProfileModal** - Imported but not used
3. **ExploreSearchBar** - Imported but not used

---

## Reversion Steps

If React Native Skia implementation needs to be reverted:

1. **Restore BlurView imports:**
   - Ensure `expo-blur@~14.1.5` is in `package.json`
   - Run `npm install` or `yarn install`

2. **Restore component code:**
   - Replace React Native Skia blur components with the configurations above
   - Restore platform-specific logic where applicable

3. **Remove React Native Skia:**
   - Remove `@shopify/react-native-skia` from `package.json`
   - Remove any Skia-related imports and components
   - Run `npm install` or `yarn install`

4. **Test on both platforms:**
   - Verify blur effects match original appearance
   - Check performance characteristics
   - Ensure no visual regressions

---

## Notes

- **Intensity values:** Range from 0-100, where higher values = more blur
- **Tint options:** `"light"`, `"dark"`, or `"default"`
- **Platform differences:** Android typically requires higher intensity values to achieve similar visual effect to iOS
- **Performance:** BlurView uses native blur rendering, which is GPU-accelerated but can be battery-intensive

---

**Last Updated:** 2026-01-07  
**Created for:** React Native Skia migration backup

