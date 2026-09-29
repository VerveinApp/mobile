import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { type ForwardedRef, type RefObject, useImperativeHandle, useRef } from 'react';

/**
 * Every settings sheet re-reads what's saved each time it opens, so it never
 * shows a stale value from the last visit. BUG FIX: that read used to live
 * in the modal's onChange, which @gorhom/bottom-sheet only fires once the
 * open animation has finished — so each sheet slid up showing its
 * placeholders (170 cm / 73 kg / 30, empty pills, the "you skipped this"
 * hint) and rewrote itself after landing. Worse, a HorizontalRuler mounted
 * on the placeholder index and kept stepping from it, so a VoiceOver
 * increment went 73 → 74 kg instead of 90 → 91, and Save could write a
 * value the ruler wasn't showing.
 *
 * The handle this gives the caller runs `load` first and presents after,
 * so the sheet's content (which the modal only mounts on present) mounts
 * already holding the saved values and the slide carries the final content.
 * The reads are AsyncStorage — a few ms between tap and slide. Everything
 * else on the handle forwards to the live modal, so callers keep their
 * plain `useRef<BottomSheetModal>` and `.present()`.
 */
export function usePreloadedSheet(
  forwardedRef: ForwardedRef<BottomSheetModal>,
  sheetRef: RefObject<BottomSheetModal | null>,
  load: () => Promise<void>
) {
  // A second tap while the first open is still reading is dropped, not
  // queued into a second present().
  const opening = useRef(false);
  useImperativeHandle(
    forwardedRef,
    (): BottomSheetModal => ({
      present: async () => {
        if (opening.current) return;
        opening.current = true;
        try {
          await load();
        } finally {
          // Opens even if the read failed — the sheet's own defaults beat a
          // row that does nothing when tapped.
          opening.current = false;
          sheetRef.current?.present();
        }
      },
      dismiss: (config) => sheetRef.current?.dismiss(config),
      snapToIndex: (...args) => sheetRef.current?.snapToIndex(...args),
      snapToPosition: (...args) => sheetRef.current?.snapToPosition(...args),
      expand: (config) => sheetRef.current?.expand(config),
      collapse: (config) => sheetRef.current?.collapse(config),
      close: (config) => sheetRef.current?.close(config),
      forceClose: (config) => sheetRef.current?.forceClose(config),
    }),
    [sheetRef, load]
  );
}
