import { canAccessAnyHealthData, type HealthKitAccessProbe } from '@/lib/health-kit';

// What iOS reports after each answer to the permission sheet: the workout
// write status is real, while denied reads just come back empty.
function probe({
  workoutStatus = 1, // sharingDenied
  samples = {},
  failing = [],
}: {
  workoutStatus?: number;
  samples?: Record<string, number>;
  failing?: string[];
}) {
  const query = (type: string) =>
    failing.includes(type)
      ? Promise.reject(new Error('query failed'))
      : Promise.resolve(Array.from({ length: samples[type] ?? 0 }, () => ({})));
  return {
    authorizationStatusFor: jest.fn(() => workoutStatus),
    queryQuantitySamples: jest.fn((type: string) => query(type)),
    queryCategorySamples: jest.fn((type: string) => query(type)),
  } as unknown as HealthKitAccessProbe;
}

describe('canAccessAnyHealthData', () => {
  it("is false after Don't Allow — workout writing denied and no readable data", async () => {
    await expect(canAccessAnyHealthData(probe({}))).resolves.toBe(false);
  });

  it('is true when workout writing was allowed, without needing any data', async () => {
    const healthKit = probe({ workoutStatus: 2 });
    await expect(canAccessAnyHealthData(healthKit)).resolves.toBe(true);
    expect(healthKit.queryQuantitySamples).not.toHaveBeenCalled();
  });

  it('is true when only reads were allowed and any one type has data', async () => {
    await expect(
      canAccessAnyHealthData(probe({ samples: { HKCategoryTypeIdentifierSleepAnalysis: 1 } }))
    ).resolves.toBe(true);
    await expect(
      canAccessAnyHealthData(probe({ samples: { HKQuantityTypeIdentifierStepCount: 1 } }))
    ).resolves.toBe(true);
  });

  it('treats an undetermined status like a denial', async () => {
    await expect(canAccessAnyHealthData(probe({ workoutStatus: 0 }))).resolves.toBe(false);
  });

  it('ignores a failing query instead of rejecting', async () => {
    const healthKit = probe({
      failing: ['HKQuantityTypeIdentifierStepCount'],
      samples: { HKQuantityTypeIdentifierRestingHeartRate: 2 },
    });
    await expect(canAccessAnyHealthData(healthKit)).resolves.toBe(true);
    await expect(canAccessAnyHealthData(probe({ failing: ['HKQuantityTypeIdentifierStepCount'] }))).resolves.toBe(
      false
    );
  });

  it('falls back to the data probe when the status check throws', async () => {
    const healthKit = probe({ samples: { HKQuantityTypeIdentifierActiveEnergyBurned: 1 } });
    (healthKit.authorizationStatusFor as jest.Mock).mockImplementation(() => {
      throw new Error('unavailable');
    });
    await expect(canAccessAnyHealthData(healthKit)).resolves.toBe(true);
  });

  it('only looks back a bounded window, one sample per type', async () => {
    const healthKit = probe({});
    await canAccessAnyHealthData(healthKit);
    const [, options] = (healthKit.queryQuantitySamples as jest.Mock).mock.calls[0];
    expect(options.limit).toBe(1);
    const days = (Date.now() - options.filter.date.startDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);
    expect(healthKit.queryQuantitySamples).toHaveBeenCalledTimes(3);
    expect(healthKit.queryCategorySamples).toHaveBeenCalledTimes(1);
  });
});
