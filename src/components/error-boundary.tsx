import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * The one class component in this codebase — React only supports error
 * boundaries via componentDidCatch/getDerivedStateFromError, no hook
 * equivalent exists. Wraps the WHOLE app in _layout.tsx, outside
 * AppThemeProvider, deliberately: if the theme context itself is ever what
 * throws, a boundary living inside it would never catch that. That's also
 * why the fallback UI below reads the OS color scheme directly (RN's own
 * useColorScheme, not this app's ThemeProvider) rather than depending on
 * app state that might be exactly what's broken.
 *
 * "Try again" resets local state and re-renders the previously-thrown
 * subtree fresh — genuinely fixes anything transient (a bad render caused
 * by one bad payload, a race that resolved by the time this is tapped).
 * There's no expo-updates in this project to force a full JS-bundle reload,
 * so a persistent error still needs a real force-quit — the copy says that
 * honestly rather than promising a "restart" this button can't actually do.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // No crash-reporting service wired up yet (a real gap — see this app's
    // own known-gaps list) — console.error is at least visible in a dev
    // build's logs rather than the crash vanishing silently.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark
    ? { bg: '#0a0a0a', text: '#f5f5f5', textSecondary: '#a3a3a3', button: '#438C63' }
    : { bg: '#ffffff', text: '#171717', textSecondary: '#525252', button: '#438C63' };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        VerveIn hit an unexpected error. Your data is safe — try again, or close and reopen the app if this
        keeps happening.
      </Text>
      <Pressable style={[styles.button, { backgroundColor: colors.button }]} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
