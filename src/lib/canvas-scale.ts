import { createContext, useContext } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

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

/**
 * The outline width for a fixed-canvas screen. StyleSheet.hairlineWidth is
 * one device pixel before the canvas is scaled; scaled ×1.17 on a 6.9" phone
 * it became 1.17 device pixels, and an outline that lands between pixels
 * renders unevenly around a curve — the onboarding day circles and option
 * pills looked jagged. This is exactly one device pixel after scaling.
 */
export function canvasHairline(scale: number): number {
  return 1 / (PixelRatio.get() * scale);
}

// Style keys whose numbers are lengths on the 375×812 canvas — everything
// scaleCanvasStyles multiplies. Ratios (flex, opacity, aspectRatio, scale,
// zIndex, shadowOpacity) and percentages stay as they are.
const LENGTH_KEYS = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'top', 'left', 'right', 'bottom', 'start', 'end',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical', 'paddingStart', 'paddingEnd',
  'gap', 'rowGap', 'columnGap',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderTopStartRadius', 'borderTopEndRadius', 'borderBottomStartRadius', 'borderBottomEndRadius',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderRightWidth', 'borderStartWidth', 'borderEndWidth',
  'outlineWidth', 'outlineOffset',
  'fontSize', 'lineHeight', 'letterSpacing',
  'shadowRadius', 'textShadowRadius',
  'translateX', 'translateY',
]);

// Border widths land on whole device pixels: 1.5 × 1.17 is between pixels,
// which renders a soft, uneven edge (canvasHairline's single pixel included).
const EDGE_WIDTH_KEYS = new Set([
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderRightWidth', 'borderStartWidth', 'borderEndWidth', 'outlineWidth',
]);

function scaleStyleValue(key: string, value: unknown, scale: number): unknown {
  if (typeof value === 'number') {
    if (!LENGTH_KEYS.has(key)) return value;
    if (EDGE_WIDTH_KEYS.has(key) && value > 0) {
      return Math.max(PixelRatio.roundToNearestPixel(value * scale), 1 / PixelRatio.get());
    }
    return value * scale;
  }
  if (Array.isArray(value)) {
    // transform: [{ translateX: 4 }, { scale: 0.98 }] — only the lengths.
    return value.map((entry) =>
      entry && typeof entry === 'object' ? scaleStyle(entry as Record<string, unknown>, scale) : entry
    );
  }
  if (value && typeof value === 'object' && (key === 'shadowOffset' || key === 'textShadowOffset')) {
    const offset = value as { width?: number; height?: number };
    return { ...offset, width: (offset.width ?? 0) * scale, height: (offset.height ?? 0) * scale };
  }
  return value;
}

function scaleStyle(style: Record<string, unknown>, scale: number): Record<string, unknown> {
  const scaled: Record<string, unknown> = {};
  for (const key of Object.keys(style)) scaled[key] = scaleStyleValue(key, style[key], scale);
  return scaled;
}

/**
 * A fixed-canvas screen's styles, laid out at the real size instead of
 * drawn at 375×812 and magnified.
 *
 * BUG FIX (found by the user: "it shouldn't look like a 64-bit game"):
 * these screens used to scale the whole canvas with a transform. iOS
 * magnifies anything drawn as a bitmap under a transform — and React
 * Native draws an unclipped border as a bitmap with nearest-neighbour
 * magnification (RCTViewComponentView.mm), so every pill and circle
 * outline came out stair-stepped on a large phone; text, SVG icons and the
 * logo were magnified smoothly but soft. Scaling the lengths instead
 * renders every element natively at its final size: the layout is the
 * same, every edge is crisp.
 */
export function scaleCanvasStyles<T extends Record<string, object>>(styles: T, scale: number): T {
  if (scale === 1) return styles;
  const scaled: Record<string, object> = {};
  for (const name of Object.keys(styles)) {
    scaled[name] = scaleStyle(styles[name] as Record<string, unknown>, scale);
  }
  return scaled as T;
}

/**
 * The canvas scale for a shared component rendered inside a fixed-canvas
 * screen (rulers, wheels, gauges, graphics) — 1 everywhere else. A screen
 * provides it around its canvas; a component multiplies its own built-in
 * lengths by it so it matches the screen's scaled styles.
 */
export const CanvasScaleContext = createContext(1);

export function useCanvasUnit(): number {
  return useContext(CanvasScaleContext);
}
