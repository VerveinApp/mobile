import { recordPolicyApplications } from '@/lib/engine/policy-orchestration';

describe('recordPolicyApplications', () => {
  it('always returns exactly one record per policy, P1 through P5, in order', () => {
    const records = recordPolicyApplications({ p4Applied: false, p5StackingTransition: false, m8Ran: true });
    expect(records.map((r) => r.policy)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
  });

  it('P1/P2/P3 report their fixed governance status regardless of the run context', () => {
    const a = recordPolicyApplications({ p4Applied: true, p5StackingTransition: true, m8Ran: true });
    const b = recordPolicyApplications({ p4Applied: false, p5StackingTransition: false, m8Ran: false });
    expect(a.slice(0, 3)).toEqual(b.slice(0, 3));
    expect(a[0].status).toBe('ran-interim');
    expect(a[1].status).toBe('no-mechanism-v1');
    expect(a[2].status).toBe('deferred-v1.1');
  });

  it('P4 reports a real exclusion when p4Applied is true, and a no-exclusion-needed note when false', () => {
    const applied = recordPolicyApplications({ p4Applied: true, p5StackingTransition: false, m8Ran: true });
    const notApplied = recordPolicyApplications({ p4Applied: false, p5StackingTransition: false, m8Ran: true });
    expect(applied[3].detail).toContain('executed this run');
    expect(notApplied[3].detail).toContain('no exclusion needed');
  });

  it('P5 reports Volume Scaling did not run when m8Ran is false — REGRESSION GUARD: this must never fire on a run where Fallback pre-empted M8', () => {
    const records = recordPolicyApplications({ p4Applied: false, p5StackingTransition: false, m8Ran: false });
    expect(records[4].detail).toContain('Did not execute this run');
  });

  it('P5 reports the real stacking-transition value when m8Ran is true', () => {
    const stacked = recordPolicyApplications({ p4Applied: false, p5StackingTransition: true, m8Ran: true });
    const notStacked = recordPolicyApplications({ p4Applied: false, p5StackingTransition: false, m8Ran: true });
    expect(stacked[4].detail).toContain('Stacking-transition fired: true');
    expect(notStacked[4].detail).toContain('Stacking-transition fired: false');
  });
});
