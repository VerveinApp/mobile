import type { PurchasesPackage } from 'react-native-purchases';

import {
  annualSavings,
  billingPeriod,
  buyLabel,
  planCaption,
  plansFailureMessage,
  priceWithPeriod,
  renewalDisclosure,
  trialLabel,
} from '@/lib/paywall-plans';

function pkg(
  packageType: string,
  product: {
    price: number;
    priceString: string;
    subscriptionPeriod?: string | null;
    pricePerMonthString?: string | null;
    introPrice?: { price: number; periodNumberOfUnits: number; periodUnit: string } | null;
  }
): PurchasesPackage {
  return {
    identifier: `$rc_${packageType.toLowerCase()}`,
    packageType,
    product: {
      identifier: `vervein_${packageType.toLowerCase()}`,
      title: `VerveIn Plus (${packageType})`,
      currencyCode: 'USD',
      subscriptionPeriod: null,
      pricePerMonthString: null,
      introPrice: null,
      ...product,
    },
  } as unknown as PurchasesPackage;
}

const MONTHLY = pkg('MONTHLY', { price: 7.99, priceString: '$7.99', subscriptionPeriod: 'P1M' });
const MONTHLY_WITH_TRIAL = pkg('MONTHLY', {
  price: 7.99,
  priceString: '$7.99',
  subscriptionPeriod: 'P1M',
  introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' },
});
const ANNUAL = pkg('ANNUAL', {
  price: 49.99,
  priceString: '$49.99',
  subscriptionPeriod: 'P1Y',
  pricePerMonthString: '$4.16',
});
const LIFETIME = pkg('LIFETIME', { price: 99, priceString: '$99.00' });

describe('billing period', () => {
  it("reads the store's ISO period, and says how many when it's more than one", () => {
    expect(billingPeriod(MONTHLY)).toBe('month');
    expect(billingPeriod(ANNUAL)).toBe('year');
    expect(billingPeriod(pkg('THREE_MONTH', { price: 20, priceString: '$20', subscriptionPeriod: 'P3M' }))).toBe(
      '3 months'
    );
  });

  it('falls back to the package type, and has none for a one-time purchase', () => {
    expect(billingPeriod(pkg('ANNUAL', { price: 49.99, priceString: '$49.99' }))).toBe('year');
    expect(billingPeriod(LIFETIME)).toBeNull();
    expect(priceWithPeriod(LIFETIME)).toBe('$99.00');
    expect(priceWithPeriod(MONTHLY)).toBe('$7.99/month');
  });
});

describe('trial and button copy', () => {
  it('only calls a zero-price intro offer a free trial, with its real length', () => {
    expect(trialLabel(MONTHLY_WITH_TRIAL)).toBe('3-day free trial');
    expect(trialLabel(MONTHLY)).toBeNull();
    const paidIntro = pkg('MONTHLY', {
      price: 7.99,
      priceString: '$7.99',
      introPrice: { price: 0.99, periodNumberOfUnits: 1, periodUnit: 'MONTH' },
    });
    expect(trialLabel(paidIntro)).toBeNull();
  });

  it('says what the button does: the trial, or the price and period', () => {
    expect(buyLabel(MONTHLY_WITH_TRIAL, '3-day free trial')).toBe('Start 3-day free trial');
    expect(buyLabel(ANNUAL, null)).toBe('Subscribe for $49.99/year');
    expect(buyLabel(LIFETIME, null)).toBe('Buy for $99.00');
  });
});

describe('plan captions', () => {
  it('prices yearly per month and names the real saving', () => {
    const savings = annualSavings([MONTHLY, ANNUAL]);
    expect(savings).toBe('$45.89');
    expect(planCaption(ANNUAL, null, savings)).toBe('$4.16/mo · save $45.89');
    expect(planCaption(MONTHLY_WITH_TRIAL, '3-day free trial', savings)).toBe('Includes a 3-day free trial');
    expect(planCaption(MONTHLY, null, savings)).toBeNull();
  });

  it('claims no saving unless yearly is genuinely cheaper and both exist', () => {
    expect(annualSavings([ANNUAL])).toBeNull();
    const pricey = pkg('ANNUAL', { price: 120, priceString: '$120', subscriptionPeriod: 'P1Y' });
    expect(annualSavings([MONTHLY, pricey])).toBeNull();
  });
});

describe('renewal disclosure', () => {
  it('states price, period, auto-renewal and how to cancel — with the trial first when there is one', () => {
    const text = renewalDisclosure(MONTHLY_WITH_TRIAL, '3-day free trial');
    expect(text.startsWith('After your 3-day free trial, $7.99 per month, charged to your Apple ID.')).toBe(true);
    expect(text).toContain('Renews automatically unless canceled at least 24 hours before the current period ends');
    expect(text).toContain('Apple ID subscription settings');
    expect(text).toContain('Terms of Service and Privacy Policy');
    expect(renewalDisclosure(ANNUAL, null).startsWith('$49.99 per year')).toBe(true);
  });

  it('calls a lifetime package a one-time purchase, agreed to by purchasing', () => {
    const text = renewalDisclosure(LIFETIME, null);
    expect(text.startsWith('One-time purchase of $99.00, charged to your Apple ID.')).toBe(true);
    expect(text).toContain('By purchasing');
    expect(text).not.toContain('subscrib');
  });
});

describe('failure copy', () => {
  it('only blames the connection when the connection is the cause', () => {
    expect(plansFailureMessage('unavailable', false)).not.toMatch(/connection|offline/);
    expect(plansFailureMessage('store', false)).not.toMatch(/connection|offline/);
    expect(plansFailureMessage('offline', false)).toMatch(/connection/);
  });

  it("promises an automatic reload only when the device itself is offline", () => {
    expect(plansFailureMessage('offline', true)).toMatch(/when you're back online/);
    expect(plansFailureMessage('unavailable', true)).toMatch(/when you're back online/);
    expect(plansFailureMessage('offline', false)).not.toMatch(/back online/);
  });
});
