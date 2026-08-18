// M9 — Policy Orchestration Module, ported verbatim from the adaptive-engine
// research vault's src/modules/m9-policy-orchestration.ts.
//
// Records nothing computed elsewhere — only bookkeeps which of P1–P5 fired
// and how, so P1 and P3 can never be silently marked "resolved" without a
// matching governance change. Per Engine Responsibilities' "surfacing, not
// hiding." Wired into plan-preview.ts and persisted per session by
// decision-trace-log.ts, same as M12's gate1Exclusions/fallbackTrigger.

import type { PolicyApplicationRecord } from '@/lib/engine/types';

export function recordPolicyApplications(runContext: {
  p4Applied: boolean; // true if M6 excluded/substituted anything this run
  p5StackingTransition: boolean;
  m8Ran: boolean; // H5 fix: the record must never claim M8 executed on a run where Fallback fired before Volume Scaling
}): PolicyApplicationRecord[] {
  return [
    {
      policy: 'P1',
      status: 'ran-interim',
      detail:
        'Conservative interim (reduce and say so). Undecided pending Concierge Test Protocol — FD-2, evidence-gated, never to be marked resolved without that evidence.',
    },
    {
      policy: 'P2',
      status: 'no-mechanism-v1',
      detail: 'No primary/accessory field exists in Exercise Schema; uniform Volume Scaling only.',
    },
    {
      policy: 'P3',
      status: 'deferred-v1.1',
      detail: 'Policy Resolved/Frozen (FD-5); mechanism formally deferred to Feature Roadmap V1.1. Correct no-op in v1.0, not a bug.',
    },
    {
      policy: 'P4',
      status: 'ran-interim',
      detail: runContext.p4Applied
        ? 'Keep-or-remove interim executed this run (via M6) — at least one exercise was excluded/substituted.'
        : 'Keep-or-remove interim available; no exclusion needed this run.',
    },
    {
      policy: 'P5',
      status: 'ran-interim',
      detail: runContext.m8Ran
        ? `Multiplication interim executed via M8. Stacking-transition fired: ${runContext.p5StackingTransition}.`
        : 'Did not execute this run — Fallback fired at Gate 1 (empty-filter or Energy 1) before Volume Scaling ran.',
    },
  ];
}
