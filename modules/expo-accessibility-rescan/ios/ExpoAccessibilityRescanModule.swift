import ExpoModulesCore
import UIKit

// GitHub Issue #1 (VerveinApp/mobile): content that first enters the native
// tree via a post-mount state flip (not present on the very first render)
// never becomes discoverable by VoiceOver or XCUITest-based automation,
// even though it renders and responds to touch. Four prior attempts — a
// key-forced remount, AccessibilityInfo.setAccessibilityFocus, the
// Fabric-correct sendAccessibilityEvent(ref, 'focus'), and removing the
// Reanimated FadeIn/FadeOut wrapper entirely — were all confirmed
// ineffective. Reading RCTMountingManager.mm showed every one of those
// routes ends up posting UIAccessibilityLayoutChangedNotification, which is
// Apple's own guidance for content that MOVED or CHANGED within an already
// known screen — not for a node that is newly entering the tree. Apple's
// documented notification for that second case is
// UIAccessibilityScreenChangedNotification, which forces VoiceOver to fully
// re-derive the current screen's accessible hierarchy from scratch rather
// than patch its cached one. React Native's own AccessibilityInfo has no JS
// entry point for `.screenChanged` (only `.layoutChanged`, via
// setAccessibilityFocus, and `.announcement`, via announceForAccessibility)
// — hence this small local native module, the one route not yet tried.
public class ExpoAccessibilityRescanModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAccessibilityRescan")

    AsyncFunction("postScreenChanged") {
      UIAccessibility.post(notification: .screenChanged, argument: nil)
    }
    .runOnQueue(.main)
  }
}
