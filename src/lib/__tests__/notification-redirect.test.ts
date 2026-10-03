// notificationRoute decides where a tapped notification may take someone, so
// it only ever returns a screen on the allow-list — never whatever a payload
// happens to carry.

import { notificationRoute } from '@/lib/notification-redirect';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/' }));
jest.mock('@/lib/session-reminders', () => ({ getModule: () => null }));
jest.mock('@/lib/onboarding-draft', () => ({ hasCompletedOnboarding: () => Promise.resolve(true) }));

describe('notificationRoute', () => {
  it('opens today’s check-in for a workout reminder or re-engagement push', () => {
    expect(notificationRoute({ url: '/home/check-in' })).toBe('/home/check-in');
  });

  it('opens the invite screen for a referral notice', () => {
    expect(notificationRoute({ url: '/referral' })).toBe('/referral');
  });

  it('ignores any route that isn’t on the list', () => {
    expect(notificationRoute({ url: '/settings' })).toBeNull();
    expect(notificationRoute({ url: '/paywall' })).toBeNull();
    expect(notificationRoute({ url: 'https://example.com' })).toBeNull();
    expect(notificationRoute({ url: '/home/check-in?anyway=1' })).toBeNull();
  });

  it('ignores a notification with no usable data', () => {
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute({})).toBeNull();
    expect(notificationRoute({ url: 42 })).toBeNull();
    expect(notificationRoute('/home/check-in')).toBeNull();
  });
});
