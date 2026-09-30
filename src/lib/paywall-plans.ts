import type { PurchasesPackage } from 'react-native-purchases';

import type { PlansFailure } from '@/lib/purchases';

/**
 * The paywall's pricing copy — every label, caption and disclosure built
 * from the store's live product data, never a hardcoded price, period or
 * trial length, so whatever App Store Connect has configured shows
 * correctly with no code change.
 */

/**
 * Promises an automatic reload only when the device itself reports being
 * offline (the paywall reloads the moment it's back); a network error the
 * device didn't register is a connection problem to check, not a wait.
 */
export function plansFailureMessage(reason: PlansFailure, deviceOffline: boolean): string {
  if (deviceOffline) return "You're offline. Plans will load when you're back online.";
  if (reason === 'offline') return "Couldn't reach the App Store. Check your connection and try again.";
  if (reason === 'store') return "The App Store didn't respond. Try again in a moment.";
  return "Plans didn't load from the App Store. Try again in a little while.";
}

const BILLING_PERIOD_BY_PACKAGE_TYPE: Partial<Record<string, string>> = {
  ANNUAL: 'year',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  TWO_MONTH: '2 months',
  MONTHLY: 'month',
  WEEKLY: 'week',
};
const ISO_UNIT: Record<string, string> = { D: 'day', W: 'week', M: 'month', Y: 'year' };

/** "month", "year", "3 months" — from the store's own ISO 8601 period
 * (P1M, P1Y…) when it's there, the package type otherwise; null for a
 * one-time purchase. */
export function billingPeriod(pkg: PurchasesPackage): string | null {
  if (pkg.packageType === 'LIFETIME') return null;
  const match = pkg.product.subscriptionPeriod ? /^P(\d+)([DWMY])$/.exec(pkg.product.subscriptionPeriod) : null;
  if (match) {
    const count = Number(match[1]);
    const unit = ISO_UNIT[match[2]];
    return count === 1 ? unit : `${count} ${unit}s`;
  }
  return BILLING_PERIOD_BY_PACKAGE_TYPE[pkg.packageType] ?? null;
}

export function priceWithPeriod(pkg: PurchasesPackage): string {
  const period = billingPeriod(pkg);
  return period ? `${pkg.product.priceString}/${period}` : pkg.product.priceString;
}

export function buyLabel(pkg: PurchasesPackage, trial: string | null): string {
  if (trial) return `Start ${trial}`;
  if (pkg.packageType === 'LIFETIME') return `Buy for ${pkg.product.priceString}`;
  return `Subscribe for ${priceWithPeriod(pkg)}`;
}

/**
 * The auto-renewal terms for the selected plan — live price and period from
 * the store, never hardcoded. A lifetime package is a one-time purchase and
 * says so instead.
 */
export function renewalDisclosure(pkg: PurchasesPackage, trial: string | null): string {
  if (pkg.packageType === 'LIFETIME') {
    return `One-time purchase of ${pkg.product.priceString}, charged to your Apple ID. By purchasing, you agree to the Terms of Service and Privacy Policy.`;
  }
  const agreement = 'By subscribing, you agree to the Terms of Service and Privacy Policy.';
  const period = billingPeriod(pkg) ?? 'billing period';
  return (
    `${trial ? `After your ${trial}, ` : ''}${pkg.product.priceString} per ${period}, charged to your Apple ID. ` +
    'Renews automatically unless canceled at least 24 hours before the current period ends — manage or cancel ' +
    `anytime in your Apple ID subscription settings. ${agreement}`
  );
}

export function packageLabel(pkg: PurchasesPackage): string {
  if (pkg.packageType === 'ANNUAL') return 'Yearly';
  if (pkg.packageType === 'MONTHLY') return 'Monthly';
  if (pkg.packageType === 'LIFETIME') return 'Lifetime';
  return pkg.product.title;
}

/**
 * Real store-configured intro pricing only — a free trial exists exactly
 * when introPrice.price is 0, and its length comes from the store, so
 * whatever trial App Store Connect has (or none) shows correctly.
 */
export function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  return `${intro.periodNumberOfUnits}-${intro.periodUnit.toLowerCase()} free trial`;
}

/**
 * What a year on the yearly plan saves over twelve months of monthly, in
 * the store's own currency — computed from real prices, never a canned
 * percentage, and null unless both exist and yearly is genuinely cheaper.
 */
export function annualSavings(packages: PurchasesPackage[]): string | null {
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const annual = packages.find((p) => p.packageType === 'ANNUAL');
  if (!monthly || !annual) return null;
  const savings = monthly.product.price * 12 - annual.product.price;
  if (savings <= 0.01) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: annual.product.currencyCode }).format(savings);
}

export function planCaption(pkg: PurchasesPackage, trial: string | null, savings: string | null): string | null {
  if (trial) return `Includes a ${trial}`;
  if (pkg.packageType === 'ANNUAL') {
    const perMonth = pkg.product.pricePerMonthString ? `${pkg.product.pricePerMonthString}/mo` : null;
    return [perMonth, savings ? `save ${savings}` : null].filter(Boolean).join(' · ') || null;
  }
  if (pkg.packageType === 'LIFETIME') return 'One-time purchase';
  return null;
}
