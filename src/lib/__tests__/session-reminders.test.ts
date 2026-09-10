import AsyncStorage from '@react-native-async-storage/async-storage';

import { disableSessionReminders, enableSessionReminders, isReminderEnabled } from '@/lib/session-reminders';

// Decoupled from the real M20 fold — this file is only exercising the
// scheduling mutex (schedulingChain/runChained), not engine correctness,
// which has its own dedicated tests (engine/__tests__/training-state.test.ts).
// jest.mock calls are hoisted above these imports by babel-plugin-jest-hoist
// regardless of source order, so this reads top-to-bottom like a normal
// module while still mocking before session-reminders.ts is ever loaded.
jest.mock('@/lib/training-state-loader', () => ({
  getTrainingState: jest.fn(async () => ({})),
}));
jest.mock('@/lib/engine/training-state', () => ({
  getMostNeglectedBodyArea: jest.fn(() => null),
}));

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Drains the microtask queue without relying on real/fake timers — every
// hop between here and the mutex's blocking point (requestPermissionsAsync
// -> runChained -> scheduleRollingWindowInner -> cancelAllReminders ->
// getAllScheduledNotificationsAsync) is a plain promise resolution, so
// awaiting an already-resolved promise enough times reliably lets all of
// it run before the deferred below is manually resolved.
async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

/**
 * Regression coverage for the schedulingChain/runChained mutex — see
 * session-reminders.ts's own BUG FIX comment above `schedulingChain`. Before
 * that fix, enableSessionReminders and disableSessionReminders each ran
 * their own cancel/reschedule/storage-write sequence with no mutual
 * exclusion, so a disable landing while an enable's reschedule was still
 * in flight could finish first and then get silently clobbered by enable's
 * own unconditional final write — leaving reminders live-scheduled even
 * though the user's real last action was turning them off.
 */
describe('session-reminders scheduling mutex', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Mocks above are wiped by clearAllMocks() (not just call history reset,
    // since these are jest.fn() with a real implementation, clearAllMocks
    // only clears mock.calls/instances — implementations survive). Restore
    // the ones later tests still need, since clearAllMocks doesn't touch
    // the factory-provided implementation, only recorded calls — kept here
    // explicit for clarity rather than relying on that distinction silently.
    const Notifications = jest.requireMock('expo-notifications');
    Notifications.requestPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    Notifications.getAllScheduledNotificationsAsync.mockImplementation(async () => []);
    Notifications.scheduleNotificationAsync.mockImplementation(async () => 'notification-id');
    Notifications.cancelScheduledNotificationAsync.mockImplementation(async () => {});
    Notifications.setNotificationChannelAsync.mockImplementation(async () => {});
  });

  it('a disable issued while an enable is still mid-flight is never clobbered by the enable finishing later', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    const deferred = createDeferred<unknown[]>();
    // Blocks enable's own scheduleRollingWindowInner -> cancelAllReminders
    // -> getAllScheduledNotificationsAsync call — the same await point the
    // real race originally happened around.
    Notifications.getAllScheduledNotificationsAsync.mockImplementationOnce(() => deferred.promise);

    const enablePromise = enableSessionReminders(['monday']);
    await flushMicrotasks();

    // Enable's chained unit should now be blocked inside cancelAllReminders,
    // having already consumed the one-time deferred implementation.
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

    const disablePromise = disableSessionReminders();
    await flushMicrotasks();

    // If the mutex is broken, disable's own cancelAllReminders (a second,
    // independent call) and its ENABLED_KEY='false' write would already
    // have run here, racing enable's still-pending write. The fix means
    // disable's work is queued behind enable's and genuinely has not
    // started yet.
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();

    // Let enable's blocked call resolve and both operations finish.
    deferred.resolve([]);
    await Promise.all([enablePromise, disablePromise]);

    // disable was issued after enable, so its effect must be the one that
    // sticks — never silently reverted by enable's own later write.
    expect(await isReminderEnabled()).toBe(false);
    // Both chained units really ran in full, serialized, not one skipped or
    // torn mid-way: enable got far enough to actually schedule (the real
    // window logic reads a real 'monday' from the schedule), then disable's
    // own independent cancelAllReminders call ran after it finished.
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });

  it('two concurrent enables never interleave — the second only starts cancelling after the first fully finishes scheduling', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    const deferred = createDeferred<unknown[]>();
    Notifications.getAllScheduledNotificationsAsync.mockImplementationOnce(() => deferred.promise);

    const firstEnable = enableSessionReminders(['monday']);
    await flushMicrotasks();
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

    const secondEnable = enableSessionReminders(['tuesday']);
    await flushMicrotasks();

    // The second call's own cancelAllReminders must not have started yet —
    // it's queued behind the first call's still-pending chained unit.
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

    deferred.resolve([]);
    await Promise.all([firstEnable, secondEnable]);

    // Both eventually completed, strictly one after the other.
    expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(await isReminderEnabled()).toBe(true);
  });
});
