import { type ReactNode, useCallback, useRef } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { hapticSelect } from '@/lib/haptics';

// How far left, in points, a row has to be dragged for a full swipe: the
// Mail-style gesture that runs the row's primary action without a second
// tap. Past it the row is armed (with a haptic tick); letting go while armed
// runs the action, and dragging back before letting go cancels it.
const FULL_SWIPE_THRESHOLD = -220;

type SwipeRowProps = {
  /** The actions a left swipe reveals behind the row. `close` slides the row shut again. */
  renderActions: (close: () => void) => ReactNode;
  /** The row's primary action (delete, archive…), run when a full swipe is let go. It should remove the row. */
  onFullSwipe: () => void;
  children: ReactNode;
};

/**
 * A list row with swipe actions, shared by every swipe-to-delete list
 * (Notes, Archive, the Log histories). Built on ReanimatedSwipeable: the
 * legacy Swipeable each screen used before is deprecated and gone in Gesture
 * Handler 3, and each screen carried its own copy of the full-swipe
 * bookkeeping (a ref map, a listener map, listeners added during render).
 *
 * The full swipe used to commit the moment the drag crossed the threshold,
 * snapping the row shut under the finger and acting once it closed. It now
 * arms at the threshold and acts on release, as Mail does, so it can still
 * be called off by dragging back.
 */
export function SwipeRow({ renderActions, onFullSwipe, children }: SwipeRowProps) {
  // Armed state as JS last heard it. Arm/disarm messages and the release
  // callback travel from the UI thread to JS in order, so at release this is
  // the state the finger let go in, even though the spring that follows
  // pulls the row back across the threshold a frame later.
  const armed = useRef(false);
  const handleArmedChange = useCallback((next: boolean) => {
    armed.current = next;
    if (next) hapticSelect();
  }, []);

  return (
    <ReanimatedSwipeable
      overshootRight
      renderRightActions={(_progress, translation, methods) => (
        <FullSwipeWatcher translation={translation} onArmedChange={handleArmedChange}>
          {renderActions(methods.close)}
        </FullSwipeWatcher>
      )}
      onSwipeableWillOpen={() => {
        if (!armed.current) return;
        armed.current = false;
        onFullSwipe();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

// Renders the actions untouched (a fragment, so the swipeable lays them out
// and measures them exactly as if they were returned directly) and reports
// each crossing of the full-swipe threshold to JS.
function FullSwipeWatcher({
  translation,
  onArmedChange,
  children,
}: {
  translation: SharedValue<number>;
  onArmedChange: (armed: boolean) => void;
  children: ReactNode;
}) {
  useAnimatedReaction(
    () => translation.value < FULL_SWIPE_THRESHOLD,
    (isPast, wasPast) => {
      if (wasPast !== null && isPast !== wasPast) scheduleOnRN(onArmedChange, isPast);
    }
  );
  return <>{children}</>;
}
