import { BACKUP_VERSION, parseBackupPayload, type BackupPayload } from '@/lib/data-backup';

function makeValidPayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: null,
    calibration: { userId: 'u', multiplier: 1, sampleCount: 0 },
    lastCheckIn: null,
    sessionHistory: [],
    workoutLog: [],
    weightLog: [],
    decisionTraceLog: [],
    milestones: { count: 0, shown: [] },
    exercisePerformance: {},
    notes: [],
    bodyMeasurements: [],
    conditionLog: [],
    ...overrides,
  };
}

describe('parseBackupPayload', () => {
  it('accepts a well-formed payload at the current version', () => {
    const result = parseBackupPayload(JSON.stringify(makeValidPayload()));
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parseBackupPayload('not json{');
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object (e.g. a JSON array or primitive)', () => {
    expect(parseBackupPayload('[1,2,3]').ok).toBe(false);
    expect(parseBackupPayload('"just a string"').ok).toBe(false);
    expect(parseBackupPayload('42').ok).toBe(false);
  });

  it('rejects a mismatched version — REGRESSION GUARD: an old export (missing exercisePerformance) must never silently pass with that field undefined', () => {
    const oldShapePayload = makeValidPayload({ version: BACKUP_VERSION - 1 });
    // @ts-expect-error simulating a real pre-fix export that never had this field
    delete oldShapePayload.exercisePerformance;
    const result = parseBackupPayload(JSON.stringify(oldShapePayload));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing exportedAt', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    delete payload.exportedAt;
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('rejects a malformed profile (not null, not an object)', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.profile = 'not an object';
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('accepts a null profile (a device with no completed onboarding yet)', () => {
    const payload = makeValidPayload({ profile: null });
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(true);
  });

  it('rejects malformed calibration data', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.calibration = { multiplier: 'not a number' };
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('rejects a non-array sessionHistory/workoutLog/weightLog/decisionTraceLog', () => {
    for (const key of ['sessionHistory', 'workoutLog', 'weightLog', 'decisionTraceLog'] as const) {
      const payload = makeValidPayload();
      // @ts-expect-error deliberately malformed for the test
      payload[key] = 'not an array';
      expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
    }
  });

  it('rejects malformed milestones', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.milestones = { count: 'not a number', shown: [] };
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('REGRESSION GUARD: rejects a payload whose exercisePerformance is missing/not an object — the exact bug fix this field closed', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.exercisePerformance = ['not', 'an', 'object'];
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('rejects a non-array notes', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.notes = 'not an array';
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('rejects a non-array bodyMeasurements', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.bodyMeasurements = 'not an array';
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });

  it('rejects a non-array conditionLog', () => {
    const payload = makeValidPayload();
    // @ts-expect-error deliberately malformed for the test
    payload.conditionLog = 'not an array';
    expect(parseBackupPayload(JSON.stringify(payload)).ok).toBe(false);
  });
});

describe('BACKUP_VERSION guard', () => {
  // Every past field addition to BackupPayload (exercisePerformance, notes,
  // bodyMeasurements, conditionLog) bumped BACKUP_VERSION alongside it — see
  // data-backup.ts's own version-history comment. That pairing is a human
  // convention, not something TypeScript enforces, so it's easy to add a
  // field to the type/buildBackupPayload/parseBackupPayload without
  // remembering the version bump — exactly the silent-gap pattern
  // data-backup.ts's header comment already calls out for other stores.
  // This pins the exact field set BACKUP_VERSION 5 expects: adding, removing,
  // or renaming a BackupPayload field fails this test until the list below
  // is updated to match — which is the prompt to also bump BACKUP_VERSION
  // and add a version-history line, not just silence this assertion.
  it(`version ${BACKUP_VERSION}'s payload has exactly the fields this version was bumped for — update this list AND bump BACKUP_VERSION together`, () => {
    expect(Object.keys(makeValidPayload()).sort()).toEqual(
      [
        'version',
        'exportedAt',
        'profile',
        'calibration',
        'lastCheckIn',
        'sessionHistory',
        'workoutLog',
        'weightLog',
        'decisionTraceLog',
        'milestones',
        'exercisePerformance',
        'notes',
        'bodyMeasurements',
        'conditionLog',
      ].sort()
    );
  });
});
