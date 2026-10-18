import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Attempt, GradedResponse, Item, Observation } from './types';
import { computeSkillEvidence, isEligible, nextReview, observationsFromAttempt } from './evidence';

const DAY = 86_400_000;
const SK = 'rw.sec.boundaries';

function obs(i: number, correct: boolean, extra: Partial<Observation> = {}): Observation {
  return {
    profileId: 'p1', itemId: `it${i}`, skillId: SK, difficulty: 'medium', outcome: correct ? 'correct' : 'incorrect',
    assisted: false, firstAttempt: true, exposureBefore: 'unseen', at: 1_000 + i * 1000, attemptId: 'a1', mode: 'practice', ...extra,
  };
}
const attempt = { id: 'a2', profileId: 'p1', mode: 'practice' } as Attempt;
const items = { it1: { id: 'it1', skillId: SK, difficulty: 'hard' } as Item };

test('repeats do not add evidence', () => {
  const g: GradedResponse[] = [{ itemId: 'it1', skillId: SK, outcome: 'correct', assisted: false }];
  const first = observationsFromAttempt(attempt, g, items, [], [], 5);
  assert.equal(first[0].firstAttempt, true);
  assert.equal(first[0].exposureBefore, 'unseen');
  assert.equal(first[0].difficulty, 'hard');
  const again = observationsFromAttempt(attempt, g, items, first, [], 6);
  assert.equal(again[0].firstAttempt, false);
  assert.equal(again[0].exposureBefore, 'seen_in_app');
  assert.equal(isEligible(again[0]), false);
  const ev = computeSkillEvidence([...first, ...again], 'p1', [], 10);
  assert.equal(ev[SK].eligible, 1);
  assert.equal(ev[SK].lastPracticed, 6);
  const rem = observationsFromAttempt(attempt, g, items, [], ['it1'], 5);
  assert.equal(rem[0].exposureBefore, 'remembered');
});

test('assisted, omitted and invalid answers are excluded', () => {
  assert.equal(isEligible(obs(1, true, { assisted: true })), false);
  assert.equal(isEligible(obs(1, true, { outcome: 'omitted' })), false);
  assert.equal(isEligible(obs(1, true, { outcome: 'invalid_format' })), false);
  assert.equal(isEligible(obs(1, true, { exposureBefore: 'possibly_seen' })), true);
  const ev = computeSkillEvidence([obs(1, true, { assisted: true }), obs(2, false)], 'p1', [], 0);
  assert.equal(ev[SK].eligible, 1);
  assert.equal(ev[SK].estimate, 1 / 3);
});

test('label thresholds', () => {
  const mk = (pattern: boolean[], spreadDays = false) =>
    computeSkillEvidence(pattern.map((c, i) => obs(i, c, spreadDays ? { at: i * DAY } : {})), 'p1', [], 0)[SK];
  assert.equal(mk([true, true, true, true]).label, 'insufficient');
  assert.equal(mk([true, false, false, false, true]).label, 'needs_practice'); // 3/7
  assert.equal(mk([true, true, true, false, false]).label, 'needs_practice'); // 4/7 = .57
  assert.equal(mk([true, true, true, true, false]).label, 'developing'); // 5/7 = .71
  assert.equal(mk([true, true, true, true, true]).label, 'progressing'); // 6/7
  const ten = Array(10).fill(true);
  assert.equal(mk(ten).label, 'progressing'); // one day only
  assert.equal(mk(ten, true).label, 'consistent');
  const lastWrong = [...Array(9).fill(true), false];
  assert.equal(mk(lastWrong, true).label, 'progressing');
  assert.equal(mk(Array(30).fill(true)).eligible, 20);
});

test('due reviews and spaced intervals', () => {
  const ev = computeSkillEvidence([], 'p1', [{ profileId: 'p1', skillId: SK, dueAt: 5, intervalDays: 1 }], 10);
  assert.equal(ev[SK].due, true);
  assert.equal(ev[SK].label, 'insufficient');
  assert.equal(ev[SK].estimate, null);
  let r = nextReview(undefined, true, 'p1', SK, 0);
  const seq = [r.intervalDays];
  for (let i = 0; i < 4; i++) { r = nextReview(r, true, 'p1', SK, 0); seq.push(r.intervalDays); }
  assert.deepEqual(seq, [1, 3, 7, 14, 14]);
  assert.equal(nextReview(r, false, 'p1', SK, 0).intervalDays, 1);
  assert.equal(nextReview(r, false, 'p1', SK, 0).dueAt, DAY);
});

test('Gemma-generated questions are recorded but never count toward skill estimates (FR-10)', () => {
  const genItems = { 'gen.x.1': { id: 'gen.x.1', skillId: SK, difficulty: 'medium', origin: 'generated' } as Item, it1: { ...items.it1, origin: 'original' } as Item };
  const g: GradedResponse[] = [
    { itemId: 'gen.x.1', skillId: SK, outcome: 'correct', assisted: false },
    { itemId: 'it1', skillId: SK, outcome: 'correct', assisted: false },
  ];
  const o = observationsFromAttempt(attempt, g, genItems, [], [], 5);
  assert.equal(o[0].origin, 'generated');
  assert.equal(o[1].origin, 'original');
  assert.equal(isEligible(o[0]), false);
  assert.equal(isEligible(o[1]), true);
  // An item missing from the map (e.g. dropped from storage) is still recognized by its id prefix.
  assert.equal(observationsFromAttempt(attempt, g, {}, [], [], 5)[0].origin, 'generated');
  const ev = computeSkillEvidence([...o, obs(9, true, { origin: 'generated', itemId: 'gen.y' })], 'p1', [], 10);
  assert.equal(ev[SK].eligible, 1);
});
