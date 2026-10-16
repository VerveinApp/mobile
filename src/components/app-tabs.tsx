import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppColors } from '@/lib/theme-context';

/**
 * Four real tabs — Summary (the Apple-Health-style dashboard), Train,
 * Progress, Profile. Icons are SF Symbols (+ Material Icons as the
 * Android/web fallback), not custom image assets — no icon files to
 * generate or keep in sync with the tab list.
 */
export default function AppTabs() {
  const colors = useAppColors();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      // indicatorColor/rippleColor are Android-only (the Material "active
      // pill" and ripple). tintColor is NOT: iOS passes it on as the tab
      // bar's tint (NativeTabsView.ios.js), so it colors the selected icon.
      // The brand green #5FBE84 was about 2:1 on the light tab bar; the
      // theme's accent text green is the same #5FBE84 in dark mode and an
      // AA-passing shade in light mode.
      indicatorColor="rgba(95,190,132,0.18)"
      rippleColor="rgba(95,190,132,0.28)"
      tintColor={colors.accentText}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Summary</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="train">
        <NativeTabs.Trigger.Label>Train</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.run" md="directions_run" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
