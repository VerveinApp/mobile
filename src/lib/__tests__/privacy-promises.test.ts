// Code paths that back a specific Privacy Policy promise. Each test names the
// promise it holds the app to, so a failure here reads as "the policy is now
// wrong", not just "a function changed".

import { stripRequestQuery } from '@/lib/error-monitoring';
import { remoteProfileRow } from '@/lib/profile-sync';
import type { UserProfile } from '@/lib/user-profile';

// Hoisted above the imports by babel-jest.
jest.mock('@sentry/react-native', () => ({ init: jest.fn() }));

const HEALTH_COLUMNS = ['sex', 'height_cm', 'weight_kg', 'age', 'conditions', 'movement_restrictions'] as const;

const profileWithHealthInfo: UserProfile = {
  name: 'Alex',
  goal: 'build-physique',
  sex: 'female',
  heightCm: '170',
  weightKg: '64',
  age: '29',
  conditions: ['asthma'],
  movementRestrictions: ['overhead'],
};

describe('Privacy Policy §2/§10: health fields are stored with the account only after consent', () => {
  it('withholds every health field when consent was never given', () => {
    const row = remoteProfileRow({ ...profileWithHealthInfo, healthConsent: 'false' }, 'user-1');
    for (const column of HEALTH_COLUMNS) expect(row[column]).toBeNull();
    expect(row.user_id).toBe('user-1');
    // The rest of the training profile still syncs.
    expect(row.name).toBe('Alex');
    expect(row.goal).toBe('build-physique');
  });

  it('withholds them when the consent flag is missing entirely', () => {
    const row = remoteProfileRow(profileWithHealthInfo, 'user-1');
    for (const column of HEALTH_COLUMNS) expect(row[column]).toBeNull();
  });

  it('syncs them once consent is given', () => {
    const row = remoteProfileRow({ ...profileWithHealthInfo, healthConsent: 'true' }, 'user-1');
    expect(row.sex).toBe('female');
    expect(row.weight_kg).toBe('64');
    expect(row.conditions).toEqual(['asthma']);
    expect(row.movement_restrictions).toEqual(['overhead']);
  });
});

describe('Privacy Policy §7: crash reports aren’t tied to an account through request URLs', () => {
  it('drops the query string, which can carry the account ID, from request breadcrumbs', () => {
    const crumb = stripRequestQuery({
      category: 'fetch',
      data: { url: 'https://example.supabase.co/rest/v1/profiles?user_id=eq.user-1&select=*', method: 'GET' },
    });
    expect(crumb.data).toEqual({ url: 'https://example.supabase.co/rest/v1/profiles', method: 'GET' });
  });

  it('leaves other breadcrumbs alone', () => {
    const crumb = { category: 'navigation', data: { from: 'a', to: 'b' } };
    expect(stripRequestQuery(crumb)).toBe(crumb);
  });
});
