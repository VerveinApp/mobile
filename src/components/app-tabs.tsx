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
      // indicatorColor/rippleColor/tintColor are Android-only concepts (the
      // Material "active pill" behind a selected icon, and native ripple
      // feedback) — expo-router's iOS appearance builder never reads any of
      // these three fields, so setting them here cannot change anything
      // about the current iOS tab bar. Left as Android's own dynamic
      // Material color by default otherwise, which reads as generic —
      // tinting both toward the brand green is the single most-visible
      // touch available, since this bar is on every screen.
      indicatorColor="rgba(95,190,132,0.18)"
      rippleColor="rgba(95,190,132,0.28)"
      tintColor="#5FBE84"
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
