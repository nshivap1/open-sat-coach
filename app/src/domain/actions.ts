// App-level actions: the only place that connects engine, grading, evidence and persistence.
import type { Attempt, Profile, TestSpec, FormRole } from './types';
import { getState, setState, uid, activeProfile } from './store';
import { createAttempt, startModule, resumeAttempt, submitModule } from './attempts';
import { gradeAttempt } from './grading';
import { observationsFromAttempt, nextReview } from './evidence';
import { ITEM_BY_ID, TEST_BY_ID } from '../content';

export function createProfile(input: { nickname: string; targetDate?: string; scoreGoal?: number; takenInBluebook?: number[] }, roles?: Record<number, FormRole>): Profile {
  const p: Profile = {
    id: uid('p'),
    nickname: input.nickname.trim() || 'Student',
    createdAt: Date.now(),
    targetDate: input.targetDate || undefined,
    scoreGoal: input.scoreGoal || undefined,
    focusSkillIds: [],
    onboarded: true,
  };
  setState((s) => ({
    ...s,
    profiles: [...s.profiles, p],
    activeProfileId: p.id,
    formRoles: roles ? { ...s.formRoles, [p.id]: roles } : s.formRoles,
  }));
  return p;
}

export function switchProfile(id: string) {
  setState((s) => ({ ...s, activeProfileId: id }));
}

export function deleteProfile(id: string) {
  setState((s) => {
    const formRoles = { ...s.formRoles }; delete formRoles[id];
    const remembered = { ...s.remembered }; delete remembered[id];
    const attemptIds = new Set(s.attempts.filter((a) => a.profileId === id).map((a) => a.id));
    const missReasons = Object.fromEntries(Object.entries(s.missReasons).filter(([k]) => !attemptIds.has(k.split(':')[0])));
    const profiles = s.profiles.filter((p) => p.id !== id);
    return {
      ...s,
      profiles,
      activeProfileId: s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId,
      attempts: s.attempts.filter((a) => a.profileId !== id),
      observations: s.observations.filter((o) => o.profileId !== id),
      reviews: s.reviews.filter((r) => r.profileId !== id),
      bluebook: s.bluebook.filter((b) => b.profileId !== id),
      problemReports: s.problemReports.filter((r) => r.profileId !== id),
      missReasons, formRoles, remembered,
    };
  });
}

export function updateProfile(id: string, patch: Partial<Profile>) {
  setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function startTest(testId: string): string | null {
  const profile = activeProfile();
  const test = TEST_BY_ID[testId];
  if (!profile || !test) return null;
  const a = createAttempt(test, profile.id, Date.now());
  setState((s) => ({ ...s, attempts: [...s.attempts, a] }));
  return a.id;
}

export function startPracticeAttempt(test: TestSpec): string | null {
  const profile = activeProfile();
  if (!profile) return null;
  const now = Date.now();
  const a = startModule(createAttempt(test, profile.id, now), 0, now);
  setState((s) => ({ ...s, attempts: [...s.attempts, a] }));
  return a.id;
}

export function getAttempt(id: string): Attempt | undefined {
  return getState().attempts.find((a) => a.id === id);
}

/** Resume after relaunch: strict timers keep running while the app is closed. */
export function resume(id: string): Attempt | undefined {
  const a = getAttempt(id);
  if (!a || a.status === 'completed') return a;
  const next = resumeAttempt(a, Date.now());
  saveAttempt(next);
  return next;
}

export function saveAttempt(next: Attempt) {
  setState((s) => ({ ...s, attempts: s.attempts.map((a) => (a.id === next.id ? next : a)) }));
  if (next.status === 'completed') finalizeAttempt(next.id);
}

export function finishPractice(a: Attempt): Attempt {
  const next = submitModule(a, a.currentModule, Date.now(), 'manual');
  saveAttempt(next);
  return next;
}

/** Grade once, append observations, update review schedule for practiced skills. Idempotent. */
export function finalizeAttempt(attemptId: string) {
  const s = getState();
  const a = s.attempts.find((x) => x.id === attemptId);
  if (!a || a.status !== 'completed') return;
  if (s.observations.some((o) => o.attemptId === attemptId)) return;
  const graded = gradeAttempt(a, ITEM_BY_ID);
  const now = Date.now();
  const obs = observationsFromAttempt(a, graded, ITEM_BY_ID, s.observations, s.remembered[a.profileId] ?? [], now);
  let reviews = s.reviews;
  if (a.mode === 'practice') {
    const bySkill = new Map<string, { c: number; n: number }>();
    for (const g of graded) {
      if (g.outcome === 'omitted') continue;
      const e = bySkill.get(g.skillId) ?? { c: 0, n: 0 };
      e.n += 1; if (g.outcome === 'correct') e.c += 1;
      bySkill.set(g.skillId, e);
    }
    const target = a.testSnapshot.id.split('|')[1];
    const t = target ? bySkill.get(target) : undefined;
    if (target && t && t.n > 0) {
      const prev = reviews.find((r) => r.profileId === a.profileId && r.skillId === target);
      const nr = nextReview(prev, t.c / t.n >= 0.7, a.profileId, target, now);
      reviews = [...reviews.filter((r) => !(r.profileId === a.profileId && r.skillId === target)), nr];
    }
  }
  setState((st) => ({ ...st, observations: [...st.observations, ...obs], reviews }));
}

export function gradedFor(a: Attempt) {
  return gradeAttempt(a, ITEM_BY_ID);
}

export function setMissReason(attemptId: string, itemId: string, reason: import('./types').MissReason) {
  setState((s) => ({ ...s, missReasons: { ...s.missReasons, [`${attemptId}:${itemId}`]: reason } }));
}

export function markRemembered(itemId: string) {
  const p = activeProfile();
  if (!p) return;
  setState((s) => {
    const list = new Set(s.remembered[p.id] ?? []); list.add(itemId);
    return { ...s, remembered: { ...s.remembered, [p.id]: [...list] } };
  });
}

export function reportProblem(itemId: string, kind: string, comment: string) {
  const p = activeProfile();
  if (!p) return;
  setState((s) => ({ ...s, problemReports: [...s.problemReports, { id: uid('rp'), profileId: p.id, itemId, kind, comment, at: Date.now() }] }));
}

export function exportProfileJson(profileId: string): string {
  const s = getState();
  const attemptIds = new Set(s.attempts.filter((a) => a.profileId === profileId).map((a) => a.id));
  return JSON.stringify({
    format: 'open-sat-coach/profile-export', version: 1, exportedAt: new Date().toISOString(),
    profile: s.profiles.find((p) => p.id === profileId),
    attempts: s.attempts.filter((a) => a.profileId === profileId),
    observations: s.observations.filter((o) => o.profileId === profileId),
    reviews: s.reviews.filter((r) => r.profileId === profileId),
    bluebook: s.bluebook.filter((b) => b.profileId === profileId),
    formRoles: s.formRoles[profileId] ?? {},
    remembered: s.remembered[profileId] ?? [],
    missReasons: Object.fromEntries(Object.entries(s.missReasons).filter(([k]) => attemptIds.has(k.split(':')[0]))),
  }, null, 2);
}
