import type { Attempt, ModuleState, ResponseRecord, TestSpec } from './types';
import { uid } from './store';

export const BREAK_MS = 10 * 60 * 1000;

export function createAttempt(test: TestSpec, profileId: string, now: number): Attempt {
  return {
    id: uid('att'),
    profileId,
    testId: test.id,
    mode: test.mode,
    testSnapshot: JSON.parse(JSON.stringify(test)) as TestSpec,
    createdAt: now,
    status: 'in_progress',
    currentModule: 0,
    modules: test.modules.map((_, index) => ({ index, status: 'not_started', responses: {} })),
  };
}

function withModule(a: Attempt, index: number, m: ModuleState): Attempt {
  return { ...a, modules: a.modules.map((x, i) => (i === index ? m : x)) };
}

export function startModule(a: Attempt, index: number, now: number): Attempt {
  const m = a.modules[index];
  if (!m || m.status !== 'not_started' || a.status !== 'in_progress') return a;
  const dur = a.testSnapshot.modules[index]?.durationSec ?? null;
  const next: ModuleState = { ...m, status: 'active', startedAt: now };
  if (dur != null) next.deadline = now + dur * 1000;
  return withModule(a, index, next);
}

export function remainingMs(m: ModuleState, now: number): number | null {
  if (m.deadline == null) return null;
  return Math.max(0, m.deadline - now);
}

export function updateResponse(a: Attempt, itemId: string, patch: Partial<ResponseRecord>, now: number): Attempt {
  const idx = a.currentModule;
  const m = a.modules[idx];
  if (a.status !== 'in_progress' || !m || m.status !== 'active') return a;
  if (m.deadline != null && now >= m.deadline) return a;
  if (!a.testSnapshot.modules[idx]?.itemIds.includes(itemId)) return a;
  const prev: ResponseRecord = m.responses[itemId] ?? {
    itemId, raw: null, flagged: false, eliminated: [], activeMs: 0, hintLevel: 0, explanationSeen: false, changedAt: now,
  };
  const rec: ResponseRecord = { ...prev, ...patch, itemId, changedAt: 'raw' in patch ? now : prev.changedAt };
  return withModule(a, idx, { ...m, responses: { ...m.responses, [itemId]: rec } });
}

export function submitModule(a: Attempt, index: number, now: number, reason: 'manual' | 'expired'): Attempt {
  const m = a.modules[index];
  if (!m || m.status !== 'active') return a; // idempotent: already submitted/expired (or never started)
  let next = withModule(a, index, { ...m, status: reason === 'expired' ? 'expired' : 'submitted', submittedAt: now });
  const last = index >= a.modules.length - 1;
  if (last) next = { ...next, status: 'completed', completedAt: now };
  else if (index === a.testSnapshot.breakAfterModuleIndex) next = { ...next, status: 'on_break', breakEndsAt: now + BREAK_MS, currentModule: index };
  else next = { ...next, currentModule: index + 1 };
  return next;
}

export function endBreak(a: Attempt, _now: number): Attempt {
  if (a.status !== 'on_break') return a;
  const { breakEndsAt: _b, ...rest } = a;
  return { ...rest, status: 'in_progress', currentModule: Math.min(a.currentModule + 1, a.modules.length - 1) };
}

/** Called when an attempt is reopened. Strict tests never pause: a passed deadline expires the module. */
export function resumeAttempt(a: Attempt, now: number): Attempt {
  let next: Attempt = { ...a, interrupted: true };
  const m = next.modules[next.currentModule];
  if (next.status === 'in_progress' && m && m.status === 'active' && m.deadline != null && now >= m.deadline) {
    next = submitModule(next, next.currentModule, now, 'expired');
  }
  return next;
}
