import { schedulePrCelebration } from '@/lib/pr-celebration';
import type { RecordPerformanceResult } from '@/lib/exercise-performance';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
}));

function performanceResult(overrides: Partial<RecordPerformanceResult['current']> = {}): {
  exerciseName: string;
  result: RecordPerformanceResult;
} {
  return {
    exerciseName: 'Bench Press',
    result: {
      previous: null,
      current: {
        weightKg: 60,
        reps: 5,
        estimatedOneRepMax: 70,
        date: '2026-01-01',
        improved: false,
        ...overrides,
      },
      oneRepMaxRatio: 1,
    },
  };
}

describe('schedulePrCelebration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('schedules nothing when no exercise improved', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    await schedulePrCelebration([performanceResult({ improved: false })]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a delayed notification naming the improved exercise', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    await schedulePrCelebration([performanceResult({ improved: true })]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.body).toBe('You moved more weight on Bench Press than last time.');
    expect(call.trigger.type).toBe('date');
    // Roughly an hour out — not asserting an exact timestamp since the
    // function reads Date.now() internally, not an injectable clock.
    const fireInMs = call.trigger.date.getTime() - Date.now();
    expect(fireInMs).toBeGreaterThan(59 * 60 * 1000);
    expect(fireInMs).toBeLessThan(61 * 60 * 1000);
  });

  it('schedules nothing without notification permission already granted', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await schedulePrCelebration([performanceResult({ improved: true })]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never throws even if scheduling itself fails', async () => {
    const Notifications = jest.requireMock('expo-notifications');
    Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(schedulePrCelebration([performanceResult({ improved: true })])).resolves.toBeUndefined();
  });
});
