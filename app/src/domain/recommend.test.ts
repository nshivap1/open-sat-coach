import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item, SkillEvidence } from './types';
import { composeSession, rankSkills } from './recommend';
import { SKILLS } from '../content/ontology';

function ev(skillId: string, eligible: number, correct: number, extra: Partial<SkillEvidence> = {}): SkillEvidence {
  return {
    skillId, eligible, correct, estimate: eligible ? (correct + 1) / (eligible + 2) : null, label: 'developing',
    recentErrorRate: 0, due: false, difficultyMix: { easy: 0, medium: eligible, hard: 0 }, distinctDays: 1, ...extra,
  };
}
function all(over: Record<string, SkillEvidence>): Record<string, SkillEvidence> {
  return Object.fromEntries(SKILLS.map((s) => [s.id, over[s.id] ?? ev(s.id, 0, 0)]));
}

test('ranking formula and ordering', () => {
  const e = all({
    'rw.sec.boundaries': ev('rw.sec.boundaries', 6, 2, { recentErrorRate: 0.6 }),
    'math.psda.percent': ev('math.psda.percent', 8, 7, { due: true }),
  });
  const recs = rankSkills(e, ['math.psda.percent'], 0);
  const b = recs.find((r) => r.skillId === 'rw.sec.boundaries')!;
  assert.equal(b.kind, 'practice');
  assert.ok(Math.abs(b.priority - (0.5 * (1 - 3 / 8) + 0.15 * 0.6)) < 1e-9);
  assert.match(b.reason, /You answered 2 of 6 fresh .* questions correctly\./);
  const p = recs.find((r) => r.skillId === 'math.psda.percent')!;
  assert.ok(Math.abs(p.priority - (0.5 * (1 - 8 / 10) + 0.25 + 0.1)) < 1e-9);
  assert.match(p.reason, /A review of .* is due\./);
  assert.equal(recs[0].kind, 'practice');
  assert.equal(recs[1].kind, 'practice');
  const minPractice = Math.min(...recs.filter((r) => r.kind === 'practice').map((r) => r.priority));
  for (const r of recs.filter((x) => x.kind === 'diagnose')) {
    assert.ok(r.priority < minPractice);
    assert.match(r.reason, /Not enough evidence yet/);
  }
  for (let i = 1; i < recs.length; i++) assert.ok(recs[i - 1].priority >= recs[i].priority);
  // Diagnose ordered by domain share: the first diagnose skill comes from a 0.35-share math domain.
  assert.match(recs[2].skillId, /^math\.(alg|adv)\./);
});

function item(id: string, skillId: string): Item {
  return { id, skillId } as Item;
}

test('session composition: 6 target + 2 prerequisite + 2 retention, unseen first', () => {
  const items: Item[] = [];
  for (let i = 0; i < 8; i++) items.push(item(`ev${i}`, 'rw.ii.evidence'));
  for (let i = 0; i < 3; i++) items.push(item(`ce${i}`, 'rw.ii.central'));
  for (let i = 0; i < 3; i++) items.push(item(`bd${i}`, 'rw.sec.boundaries'));
  const plan = composeSession('rw.ii.evidence', { seenItemIds: new Set(['ev0']), items, practicedSkillIds: ['rw.sec.boundaries'] });
  assert.equal(plan.itemIds.length, 10);
  assert.equal(plan.itemIds.filter((x) => x.startsWith('ev')).length, 6);
  assert.equal(plan.itemIds.filter((x) => x.startsWith('ce')).length, 2);
  assert.equal(plan.itemIds.filter((x) => x.startsWith('bd')).length, 2);
  assert.ok(!plan.itemIds.includes('ev0'));
  assert.equal(plan.note, undefined);
  assert.deepEqual(composeSession('rw.ii.evidence', { seenItemIds: new Set(['ev0']), items, practicedSkillIds: ['rw.sec.boundaries'] }), plan);
});

test('session composition with short inventory fills and explains', () => {
  const items: Item[] = [item('ev0', 'rw.ii.evidence'), item('ev1', 'rw.ii.evidence'), item('ev2', 'rw.ii.evidence'), item('ce0', 'rw.ii.central')];
  const plan = composeSession('rw.ii.evidence', { seenItemIds: new Set(['ev1']), items });
  assert.deepEqual(plan.itemIds, ['ev0', 'ev2', 'ce0', 'ev1']);
  assert.match(plan.note ?? '', /Only 4 questions/);
  assert.match(plan.note ?? '', /repeats/);
  const lean = composeSession('rw.ii.evidence', { seenItemIds: new Set(), items: [...items, ...[3, 4, 5, 6, 7, 8, 9, 10].map((i) => item(`ev${i}`, 'rw.ii.evidence'))], length: 10 });
  assert.equal(lean.itemIds.length, 10);
  assert.match(lean.note ?? '', /leans on/);
});
