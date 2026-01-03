#import <Firebase.h>
#import <Foundation/Foundation.h>

@interface FirebaseEarlyConfig : NSObject
@end

@implementation FirebaseEarlyConfig

+ (void)load {
  // We need to verify if [FIRApp configure] is necessary.
  // The user reported "No ID token" when this was disabled, so we MUST enable
  // it. However, we will NOT touch Firestore settings here, to allow JS to
  // configure Long Polling.

  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
    NSLog(@"✅ [FirebaseEarlyConfig] [FIRApp configure] called manually for "
          @"Auth readiness.");
  } else {
    NSLog(@"ℹ️ [FirebaseEarlyConfig] App already configured.");
  }

  // NOTE: We do NOT configure Firestore here.
  // We leave Firestore configuration to `firebaseInitService.ts` (JS)
  // so it can enable `experimentalForceLongPolling` without native conflicts.
}

@end
