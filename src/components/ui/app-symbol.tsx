import boldWeight from 'expo-symbols/androidWeights/bold';
import semiBoldWeight from 'expo-symbols/androidWeights/semiBold';
import { SymbolView as ExpoSymbolView, type SymbolViewProps } from 'expo-symbols';

import { ANDROID_ICON_MAP } from '@/constants/icon-map';

// Only the two SymbolWeight values this app actually passes anywhere —
// every other weight (including the default, unspecified) falls through to
// SymbolView's own Android default (see expo-symbols' utils.ts getFont,
// which resolves to the regular-weight font when no android weight object
// is given), which is a fine default, not a missing one.
const ANDROID_WEIGHT_BY_IOS_WEIGHT: Partial<Record<string, typeof boldWeight>> = {
  bold: boldWeight,
  semibold: semiBoldWeight,
};

/**
 * Drop-in replacement for expo-symbols' own SymbolView — identical props,
 * so every existing call site works unchanged after swapping the import.
 * expo-symbols only resolves an Android icon when `name` is the
 * `{ ios, android }` object form (see icon-map.ts's own doc comment for
 * why); every call site in this app was written passing a bare SF Symbol
 * string, which is iOS-only. This wraps that lookup once, here, instead of
 * touching every call site individually.
 */
export function SymbolView(props: SymbolViewProps) {
  const { name, weight, ...rest } = props;
  const resolvedName = typeof name === 'string' ? { ios: name, android: ANDROID_ICON_MAP[name] } : name;
  const resolvedWeight =
    typeof weight === 'string' && ANDROID_WEIGHT_BY_IOS_WEIGHT[weight]
      ? { ios: weight, android: ANDROID_WEIGHT_BY_IOS_WEIGHT[weight]! }
      : weight;
  return <ExpoSymbolView {...rest} name={resolvedName} weight={resolvedWeight} />;
}
