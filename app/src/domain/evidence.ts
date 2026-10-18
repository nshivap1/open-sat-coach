import type {
  Attempt, Difficulty, EvidenceLabel, GradedResponse, Item, Observation, ReviewSchedule, SkillEvidence,
} from './types';
import { SKILLS } from '../content/ontology';

const DAY_MS = 86_400_000;
export const EVIDENCE_WINDOW = 20;
export const MIN_ELIGIBLE = 5;
const REVIEW_INTERVALS = [1, 3, 7, 14];

/** One observation per graded response. Repeats are recorded but are not first attempts. */
export function observationsFromAttempt(
  attempt: Attempt,
  graded: GradedResponse[],
  itemById: Record<string, Item>,
  prior: Observation[],
  rememberedItemIds: string[],
  now: number,
): Observation[] {
  const seen = new Set(prior.filter((o) => o.profileId === attempt.profileId).map((o) => o.itemId));
  const remembered = new Set(rememberedItemIds);
  const out: Observation[] = [];
  for (const g of graded) {
    const item = itemById[g.itemId];
    const hadPrior = seen.has(g.itemId);
    const origin = item?.origin ?? (g.itemId.startsWith('gen.') ? 'generated' : undefined);
    out.push({
      profileId: attempt.profileId,
      itemId: g.itemId,
      skillId: g.skillId || item?.skillId || '',
      difficulty: item?.difficulty ?? 'medium',
      outcome: g.outcome,
      assisted: g.assisted,
      firstAttempt: !hadPrior,
      exposureBefore: remembered.has(g.itemId) ? 'remembered' : hadPrior ? 'seen_in_app' : 'unseen',
      at: now,
      attemptId: attempt.id,
      mode: attempt.mode,
      ...(origin ? { origin } : {}),
    });
    seen.add(g.itemId); // the same item twice in one attempt counts once
  }
  return out;
}

/** Fresh, unassisted, answered first attempts are concept evidence; everything else is just recorded.
 *  Gemma-written questions (origin 'generated') never count toward skill estimates (FR-10). */
export function isEligible(o: Observation): boolean {
  return o.origin !== 'generated' && o.firstAttempt && !o.assisted
    && (o.exposureBefore === 'unseen' || o.exposureBefore === 'possibly_seen')
    && (o.outcome === 'correct' || o.outcome === 'incorrect');
}

function dayKey(t: number): number { return Math.floor(t / DAY_MS); }

export function labelFor(eligible: number, estimate: number | null, distinctDays: number, latest3Correct: boolean): EvidenceLabel {
  if (eligible < MIN_ELIGIBLE || estimate === null) return 'insufficient';
  if (estimate < 0.6) return 'needs_practice';
  if (estimate < 0.8) return 'developing';
  if (eligible >= 10 && distinctDays >= 3 && latest3Correct) return 'consistent';
  return 'progressing';
}

export function computeSkillEvidence(
  observations: Observation[], profileId: string, reviews: ReviewSchedule[], now: number,
): Record<string, SkillEvidence> {
  const mine = observations.filter((o) => o.profileId === profileId);
  const bySkill: Record<string, Observation[]> = {};
  for (const o of mine) (bySkill[o.skillId] ??= []).push(o);

  const result: Record<string, SkillEvidence> = {};
  for (const skill of SKILLS) {
    const all = (bySkill[skill.id] ?? []).slice().sort((a, b) => b.at - a.at || a.itemId.localeCompare(b.itemId));
    const items = new Set<string>();
    const used: Observation[] = [];
    for (const o of all) {
      if (used.length >= EVIDENCE_WINDOW) break;
      if (!isEligible(o) || items.has(o.itemId)) continue;
      items.add(o.itemId);
      used.push(o);
    }
    const eligible = used.length;
    const correct = used.filter((o) => o.outcome === 'correct').length;
    const estimate = eligible === 0 ? null : (correct + 1) / (eligible + 2);
    const recent = used.slice(0, 5);
    const recentErrorRate = recent.length ? recent.filter((o) => o.outcome === 'incorrect').length / recent.length : 0;
    const distinctDays = new Set(used.map((o) => dayKey(o.at))).size;
    const latest3Correct = used.length >= 3 && used.slice(0, 3).every((o) => o.outcome === 'correct');
    const difficultyMix: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const o of used) difficultyMix[o.difficulty]++;
    result[skill.id] = {
      skillId: skill.id,
      eligible,
      correct,
      estimate,
      label: labelFor(eligible, estimate, distinctDays, latest3Correct),
      lastPracticed: all.length ? all[0].at : undefined,
      recentErrorRate,
      due: reviews.some((r) => r.profileId === profileId && r.skillId === skill.id && r.dueAt <= now),
      difficultyMix,
      distinctDays,
    };
  }
  return result;
}

/** Spaced review: 1 → 3 → 7 → 14 days on success; back to 1 day on failure. */
export function nextReview(
  prev: ReviewSchedule | undefined, success: boolean, profileId: string, skillId: string, now: number,
): ReviewSchedule {
  let intervalDays = REVIEW_INTERVALS[0];
  if (success && prev) {
    const idx = REVIEW_INTERVALS.findIndex((d) => d >= prev.intervalDays);
    intervalDays = idx < 0 ? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]
      : REVIEW_INTERVALS[Math.min(idx + (REVIEW_INTERVALS[idx] === prev.intervalDays ? 1 : 0), REVIEW_INTERVALS.length - 1)];
  }
  return { profileId, skillId, dueAt: now + intervalDays * DAY_MS, intervalDays };
}
