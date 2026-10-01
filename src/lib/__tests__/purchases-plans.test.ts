// loadPlans against a mocked RevenueCat SDK: every way getOfferings can
// fail maps to the reason the paywall shows, and only a real connection
// problem is ever reported as one.

const mockGetOfferings = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
  },
  LOG_LEVEL: { WARN: 'WARN' },
  INTRO_ELIGIBILITY_STATUS: {},
  PURCHASES_ERROR_CODE: {
    STORE_PROBLEM_ERROR: '2',
    NETWORK_ERROR: '10',
    CONFIGURATION_ERROR: '23',
    PRODUCT_REQUEST_TIMED_OUT_ERROR: '32',
    OFFLINE_CONNECTION_ERROR: '35',
    PURCHASE_CANCELLED_ERROR: '1',
  },
}));
jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));

type Purchases = typeof import('@/lib/purchases');

function loadModule(withKey: boolean): Purchases {
  const previous = { ...process.env };
  if (withKey) process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY_IOS = 'test_key';
  else {
    delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY_IOS;
    delete process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
  }
  let mod!: Purchases;
  jest.isolateModules(() => {
    // A fresh copy per test: the module reads its API key and keeps its
    // configured flag at module scope.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/purchases');
  });
  process.env = previous;
  return mod;
}

const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY' };
const annual = { identifier: '$rc_annual', packageType: 'ANNUAL' };

beforeEach(() => {
  // initPurchases arms a 5s identity-wait timer; fake timers keep it from
  // outliving the test run.
  jest.useFakeTimers();
  mockGetOfferings.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('loadPlans', () => {
  it('reports an unconfigured SDK as unavailable, not as a connection problem', async () => {
    const purchases = loadModule(false);
    await purchases.initPurchases();
    await expect(purchases.loadPlans()).resolves.toEqual({ kind: 'failed', reason: 'unavailable' });
    expect(mockGetOfferings).not.toHaveBeenCalled();
  });

  it('returns the monthly/annual shortcuts in display order', async () => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    mockGetOfferings.mockResolvedValue({
      current: { monthly, annual, lifetime: undefined, availablePackages: [annual, monthly] },
    });
    const result = await purchases.loadPlans();
    expect(result.kind).toBe('ready');
    expect(result.kind === 'ready' && result.packages).toEqual([monthly, annual]);
  });

  it('falls back to custom packages when the offering has no shortcuts', async () => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    const custom = { identifier: 'plus_quarterly', packageType: 'CUSTOM' };
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [custom] } });
    const result = await purchases.loadPlans();
    expect(result.kind === 'ready' && result.packages).toEqual([custom]);
  });

  it('treats no current offering, or an empty one, as unavailable', async () => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    mockGetOfferings.mockResolvedValue({ current: null });
    await expect(purchases.loadPlans()).resolves.toEqual({ kind: 'failed', reason: 'unavailable' });
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [] } });
    await expect(purchases.loadPlans()).resolves.toEqual({ kind: 'failed', reason: 'unavailable' });
  });

  it.each([
    ['10', 'offline'],
    ['35', 'offline'],
    ['2', 'store'],
    ['32', 'store'],
    ['23', 'unavailable'],
    [undefined, 'unavailable'],
  ])('maps RevenueCat error code %s to %s', async (code, reason) => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    mockGetOfferings.mockRejectedValue(Object.assign(new Error('nope'), { code }));
    await expect(purchases.loadPlans()).resolves.toEqual({ kind: 'failed', reason });
  });

  it('logs the real error code and cause, in the shape the iOS bridge sends', async () => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    mockGetOfferings.mockRejectedValue(
      Object.assign(new Error('There is an issue with your configuration. No App Store products registered.'), {
        code: '23',
        userInfo: {
          readableErrorCode: 'CONFIGURATION_ERROR',
          NSUnderlyingError: {
            code: '0',
            domain: 'SKErrorDomain',
            message: 'underlying error',
            userInfo: { NSLocalizedDescription: 'Cannot connect to iTunes Store' },
            nativeStackIOS: ['0 RevenueCat', '1 RNPurchases'],
          },
        },
      })
    );
    await purchases.loadPlans();
    const logged = (console.warn as jest.Mock).mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('[paywall] plans failed to load: 23');
    expect(logged).toContain('CONFIGURATION_ERROR');
    expect(logged).toContain('No App Store products registered');
    expect(logged).toContain('SKErrorDomain 0: Cannot connect to iTunes Store');
    expect(logged).not.toContain('nativeStackIOS');
  });

  it("falls back to Android's underlyingErrorMessage", async () => {
    const purchases = loadModule(true);
    await purchases.initPurchases();
    mockGetOfferings.mockRejectedValue(
      Object.assign(new Error('Network error.'), { code: '10', userInfo: { underlyingErrorMessage: 'timeout' } })
    );
    await expect(purchases.loadPlans()).resolves.toEqual({ kind: 'failed', reason: 'offline' });
    const logged = (console.warn as jest.Mock).mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('Network error. — timeout');
  });
});
