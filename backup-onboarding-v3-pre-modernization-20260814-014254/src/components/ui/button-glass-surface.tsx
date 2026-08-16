import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * `isLiquidGlassAvailable()` resolves to the correct platform file at build
 * time (native check on iOS, hard `false` everywhere else), so this is safe
 * to read once at module scope — no platform branching needed at call sites.
 */
export const isButtonGlassAvailable = isLiquidGlassAvailable();

type ButtonGlassSurfaceProps = {
  borderRadius: number;
  tintColor?: string;
};

/**
 * A subtle Liquid Glass material for a single button's own surface — not a
 * page-level or transition effect. Tinted toward Vervein's existing button
 * green rather than a neutral/frosted look, and left non-interactive (no
 * native ripple) so it doesn't compete with the app's existing hover/press
 * wash system, which stays the sole interaction feedback.
 *
 * Renders nothing when Liquid Glass isn't available (web, pre-iOS 26) —
 * callers keep their current flat-fill style as the fallback.
 */
export function ButtonGlassSurface({ borderRadius, tintColor = '#1c3d29' }: ButtonGlassSurfaceProps) {
  if (!isButtonGlassAvailable) return null;
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      tintColor={tintColor}
      // zIndex -2: the existing hover/press wash overlays sit at -1 (see
      // `behindContent` in each screen's styles), so this has to sit one
      // layer further back to stay the base material rather than covering them.
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius, zIndex: -2 }}
    />
  );
}
