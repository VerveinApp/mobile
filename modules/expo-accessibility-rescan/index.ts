import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

declare class ExpoAccessibilityRescanModule extends NativeModule {
  postScreenChanged(): Promise<void>;
}

const nativeModule =
  Platform.OS === 'ios' ? requireNativeModule<ExpoAccessibilityRescanModule>('ExpoAccessibilityRescan') : null;

// See ios/ExpoAccessibilityRescanModule.swift for why this exists instead of
// AccessibilityInfo.setAccessibilityFocus / announceForAccessibility: those
// post UIAccessibilityLayoutChangedNotification (or an announcement), and
// GitHub Issue #1 already ruled that notification out for content newly
// entering the tree after initial mount. This posts
// UIAccessibilityScreenChangedNotification instead — Apple's own notification
// for "re-derive this screen's accessible hierarchy from scratch."
export function postAccessibilityScreenChanged(): void {
  void nativeModule?.postScreenChanged();
}
