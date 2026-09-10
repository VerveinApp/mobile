import { useWindowDimensions } from 'react-native';

// Every fixed-canvas screen in this app (onboarding, check-in, paywall,
// auth/verify) was designed against exactly one reference device's real
// point size — 375×812 is iPhone X/XS/11 Pro/12 mini/13 mini, not an
// arbitrary number.
const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * BUG FIX (found in a later full-app audit): every one of these screens
 * used to scale by width alone (`windowWidth / CANVAS_WIDTH`), which is
 * only safe on a device whose aspect ratio is close to the reference
 * device's. On an iPhone SE (375×667 — same width as the reference, so
 * width-only scaling landed on exactly 1.0, no shrinking at all), the
 * 812pt-tall canvas didn't fit a 667pt-tall screen: ~72.5pt got clipped off
 * both the top and bottom by the physical screen edge, with no scroll to
 * reach it. On step-5.tsx specifically, that clipped the back button
 * entirely out of the tappable area.
 *
 * Scaling by whichever dimension is more constraining (min of the two
 * ratios) guarantees the whole canvas always fits inside the real
 * viewport — on a device shorter (relative to its width) than the
 * reference, this uniformly shrinks everything a bit more and letterboxes
 * the sides, which is a real, deliberate tradeoff (smaller UI, visible
 * margins) but never crops content out of reach the way clipping did.
 */
export function useCanvasScale(): number {
  const { width, height } = useWindowDimensions();
  return Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
}
