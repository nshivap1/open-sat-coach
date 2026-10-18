import type { Item, Recommendation, SkillEvidence } from './types';
import { DOMAIN_BY_ID, SKILLS, SKILL_BY_ID } from '../content/ontology';
import { ITEMS } from '../content/index';
import { MIN_ELIGIBLE } from './evidence';

function name(skillId: string): string { return SKILL_BY_ID[skillId]?.studentName ?? skillId; }

/** Practice skills (≥5 fresh answers) by weighted priority; then diagnose skills by domain share. */
export function rankSkills(evidence: Record<string, SkillEvidence>, focusSkillIds: string[], now: number): Recommendation[] {
  void now;
  const focus = new Set(focusSkillIds);
  const practice: Recommendation[] = [];
  const diagnose: { rec: Recommendation; share: number; order: number }[] = [];
  SKILLS.forEach((s, order) => {
    const e = evidence[s.id];
    const f = focus.has(s.id) ? 1 : 0;
    if (e && e.eligible >= MIN_ELIGIBLE && e.estimate !== null) {
      const components = { weakness: 1 - e.estimate, due: e.due ? 1 : 0, recentErrors: e.recentErrorRate, focus: f };
      const priority = 0.5 * components.weakness + 0.25 * components.due + 0.15 * components.recentErrors + 0.1 * components.focus;
      const parts = [`You answered ${e.correct} of ${e.eligible} fresh ${name(s.id)} questions correctly.`];
      if (e.due) parts.push(`A review of ${name(s.id)} is due.`);
      if (f) parts.push('It is one of your focus skills.');
      practice.push({ skillId: s.id, priority, reason: parts.join(' '), components, kind: 'practice' });
    } else {
      const have = e?.eligible ?? 0;
      const need = Math.max(1, MIN_ELIGIBLE - have);
      const missed = have - (e?.correct ?? 0);
      const reason = have > 0 && missed > 0
        ? `You missed ${missed} of ${have} fresh ${name(s.id)} question${have === 1 ? '' : 's'} so far — ${need} more will show whether it needs practice.`
        : `Not enough evidence yet — ${need} quick question${need === 1 ? '' : 's'} will show where you stand.`;
      const share = DOMAIN_BY_ID[s.domainId]?.share ?? 0;
      diagnose.push({
        rec: { skillId: s.id, priority: 0, reason, components: { weakness: 0, due: e?.due ? 1 : 0, recentErrors: 0, focus: f }, kind: 'diagnose' },
        share: share + f + (e?.recentErrorRate ?? 0), order,
      });
    }
  });
  practice.sort((a, b) => b.priority - a.priority || a.skillId.localeCompare(b.skillId));
  const floor = practice.length ? Math.min(...practice.map((p) => p.priority)) : 0;
  diagnose.sort((a, b) => b.share - a.share || a.order - b.order);
  // Diagnose priorities sit strictly below every practice priority, preserving domain-share order.
  const n = diagnose.length;
  diagnose.forEach((d, i) => { d.rec.priority = (floor * 0.9) * ((n - i) / (n + 1)) - (floor === 0 ? (i + 1) * 1e-3 : 0); });
  return [...practice, ...diagnose.map((d) => d.rec)];
}

export interface SessionPlan { itemIds: string[]; note?: string }

/** Default 10 = 6 target + 2 prerequisite + 2 retention (other practiced skills). Unseen first; deterministic. */
export function composeSession(
  targetSkillId: string,
  opts: { seenItemIds: Set<string>; length?: number; practicedSkillIds?: string[]; items?: Item[] },
): SessionPlan {
  const length = opts.length ?? 10;
  const pool = opts.items ?? ITEMS;
  const seen = opts.seenItemIds;
  const used = new Set<string>();
  const out: string[] = [];
  const byId = (a: Item, b: Item) => a.id.localeCompare(b.id);
  const forSkills = (ids: string[]) => pool.filter((i) => ids.includes(i.skillId)).sort(byId);
  const take = (cands: Item[], n: number, allowSeen: boolean) => {
    let got = 0;
    for (const it of cands) {
      if (got >= n || out.length >= length) break;
      if (used.has(it.id) || (!allowSeen && seen.has(it.id))) continue;
      used.add(it.id); out.push(it.id); got++;
    }
    return got;
  };

  const nTarget = Math.round(length * 0.6);
  const nPrereq = Math.round(length * 0.2);
  const nRetain = length - nTarget - nPrereq;
  const target = forSkills([targetSkillId]);
  const prereqIds = SKILL_BY_ID[targetSkillId]?.prerequisites ?? [];
  const prereq = forSkills(prereqIds);
  const retainIds = (opts.practicedSkillIds ?? []).filter((id) => id !== targetSkillId && !prereqIds.includes(id));
  const retain = forSkills(retainIds);

  const shortTarget = nTarget - take(target, nTarget, false);
  const shortPrereq = nPrereq - take(prereq, nPrereq, false);
  const shortRetain = nRetain - take(retain, nRetain, false);
  let usedSeen = false;
  // Fill: more unseen target items, then unseen prerequisite items, then seen items.
  take(target, length, false);
  take(prereq, length, false);
  if (out.length < length) {
    const before = out.length;
    take(target, length, true);
    take(prereq, length, true);
    take(retain, length, true);
    usedSeen = out.length > before;
  }
  const notes: string[] = [];
  if (shortTarget > 0 || shortPrereq > 0 || shortRetain > 0) {
    if (out.length < length) notes.push(`Only ${out.length} question${out.length === 1 ? '' : 's'} available for ${name(targetSkillId)} and related skills.`);
    else if (shortPrereq > 0 || shortRetain > 0) notes.push(`Not enough fresh related questions, so this session leans on ${name(targetSkillId)}.`);
    if (usedSeen) notes.push('Some questions are repeats; they will not change your evidence.');
  }
  return notes.length ? { itemIds: out, note: notes.join(' ') } : { itemIds: out };
}
