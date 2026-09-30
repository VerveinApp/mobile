import { router } from 'expo-router';

import { isPlusFeature, openPaywall, PLUS_FEATURES } from '@/lib/plus-features';

// Hoisted above the imports by babel-jest.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('Plus features', () => {
  it('has one row per feature, each with a title and a one-line detail', () => {
    const ids = PLUS_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const feature of PLUS_FEATURES) {
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.detail.length).toBeGreaterThan(0);
      // Apple's naming rule: user-facing text says Apple Health, never the framework.
      expect(`${feature.title} ${feature.detail}`).not.toMatch(/HealthKit/);
    }
  });

  it('only accepts known feature ids from a route param', () => {
    expect(isPlusFeature('goals')).toBe(true);
    expect(isPlusFeature('Goals')).toBe(false);
    expect(isPlusFeature(undefined)).toBe(false);
    expect(isPlusFeature(['goals'])).toBe(false);
  });

  it('opens the paywall leading with the tapped feature', () => {
    openPaywall('history');
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/paywall', params: { feature: 'history' } });
    openPaywall();
    expect(router.push).toHaveBeenLastCalledWith('/paywall');
  });
});
