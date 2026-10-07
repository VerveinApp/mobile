import { PixelRatio } from 'react-native';

import { canvasHairline, scaleCanvasStyles } from '@/lib/canvas-scale';

describe('scaleCanvasStyles', () => {
  it('scales lengths and leaves ratios, colors and percentages alone', () => {
    const scaled = scaleCanvasStyles(
      {
        pill: {
          position: 'absolute',
          left: 16,
          top: 284,
          width: 60,
          height: '50%',
          borderRadius: 30,
          borderWidth: 1,
          paddingHorizontal: 12,
          fontSize: 15,
          lineHeight: 20,
          letterSpacing: 0.6,
          flex: 1,
          opacity: 0.5,
          zIndex: 2,
          aspectRatio: 1,
          shadowOpacity: 0.3,
          color: '#fff',
        },
      },
      2
    );
    expect(scaled.pill).toEqual({
      position: 'absolute',
      left: 32,
      top: 568,
      width: 120,
      height: '50%',
      borderRadius: 60,
      borderWidth: 2,
      paddingHorizontal: 24,
      fontSize: 30,
      lineHeight: 40,
      letterSpacing: 1.2,
      flex: 1,
      opacity: 0.5,
      zIndex: 2,
      aspectRatio: 1,
      shadowOpacity: 0.3,
      color: '#fff',
    });
  });

  it('scales translations but not scale or rotation inside transforms', () => {
    const scaled = scaleCanvasStyles(
      { arrow: { transform: [{ translateX: 4 }, { translateY: -2 }, { scale: 0.98 }, { rotate: '45deg' }] } },
      1.5
    );
    expect(scaled.arrow).toEqual({
      transform: [{ translateX: 6 }, { translateY: -3 }, { scale: 0.98 }, { rotate: '45deg' }],
    });
  });

  it('scales shadow offsets and radius', () => {
    const scaled = scaleCanvasStyles(
      { card: { shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, textShadowOffset: { width: 1, height: 1 } } },
      2
    );
    expect(scaled.card).toEqual({
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      textShadowOffset: { width: 2, height: 2 },
    });
  });

  it('lands border widths on whole device pixels, never below one', () => {
    const ratio = PixelRatio.get();
    const scale = 1.1733;
    const { box } = scaleCanvasStyles({ box: { borderWidth: 1.5, borderTopWidth: canvasHairline(scale), outlineWidth: 0 } }, scale);
    const pixels = (width: number) => width * ratio;
    expect(Number.isInteger(Math.round(pixels(box.borderWidth) * 1e6) / 1e6)).toBe(true);
    expect(pixels(box.borderTopWidth)).toBeCloseTo(1);
    expect(box.outlineWidth).toBe(0);
  });

  it('returns the same styles when nothing needs scaling', () => {
    const styles = { a: { width: 10 } };
    expect(scaleCanvasStyles(styles, 1)).toBe(styles);
  });
});
