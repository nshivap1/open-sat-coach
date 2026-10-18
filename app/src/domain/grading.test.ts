// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import type { Attempt, Item } from './types';
import { gradeAttempt, gradeItem, validateSprFormat } from './grading';

const base = {
  version: 1, section: 'math', skillId: 's', typeId: 't', origin: 'original', difficulty: 'easy',
  difficultySource: 'unknown', prompt: 'p', hints: ['a', 'b', 'c'], formatTags: [],
  explanation: { answerSummary: '', steps: [], check: '', takeaway: '' },
} as const;
const mcq = { ...base, id: 'm1', response: { kind: 'mcq', answer: 'C', choices: [] } } as unknown as Item;
const spr = { ...base, id: 's1', response: { kind: 'spr', accepted: ['3/2', '1.5'] } } as unknown as Item;
const neg = { ...base, id: 's2', response: { kind: 'spr', accepted: ['-7/4', '-1.75'] } } as unknown as Item;

test('blanks are omitted', () => {
  assert.equal(gradeItem(mcq, null).outcome, 'omitted');
  assert.equal(gradeItem(spr, '').outcome, 'omitted');
  assert.equal(gradeItem(spr, '  ').outcome, 'omitted');
});

test('mcq compares letters', () => {
  assert.equal(gradeItem(mcq, 'C').outcome, 'correct');
  assert.equal(gradeItem(mcq, 'B').outcome, 'incorrect');
});

test('spr fractions and decimals', () => {
  assert.equal(gradeItem(spr, '3/2').outcome, 'correct');
  assert.equal(gradeItem(spr, '1.5').outcome, 'correct');
  assert.equal(gradeItem(spr, ' 1.5 ').outcome, 'correct');
  assert.equal(gradeItem(spr, '6/4').outcome, 'correct');
  assert.equal(gradeItem(spr, '1.50').outcome, 'incorrect');
  assert.equal(gradeItem(spr, '1.49').outcome, 'incorrect');
  assert.equal(gradeItem(spr, '2/3').outcome, 'incorrect');
});

test('spr negatives', () => {
  assert.equal(gradeItem(neg, '-7/4').outcome, 'correct');
  assert.equal(gradeItem(neg, '-14/8').outcome, 'correct');
  assert.equal(gradeItem(neg, '-1.75').outcome, 'correct');
  assert.equal(gradeItem(neg, '7/4').outcome, 'incorrect');
});

test('invalid formats', () => {
  for (const s of ['1 1/2', '50%', '$5', '1,000', '1.2.3', '1/2/3', '3-2', '123456', '-1234567', 'abc', '1/0', '1.5/2']) {
    assert.ok(validateSprFormat(s), `expected message for ${s}`);
  }
  for (const s of ['12345', '-12345', '.5', '-3/2', '0', '3.']) assert.equal(validateSprFormat(s), null, s);
  const g = gradeItem(spr, '1 1/2');
  assert.equal(g.outcome, 'invalid_format');
  assert.ok(g.formatMessage);
});

test('gradeAttempt covers all items and assisted flag', () => {
  const a = {
    id: 'a', testSnapshot: { modules: [{ itemIds: ['m1', 's1'] }] },
    modules: [{ index: 0, status: 'submitted', responses: {
      m1: { itemId: 'm1', raw: 'C', flagged: false, eliminated: [], activeMs: 0, hintLevel: 1, explanationSeen: false, changedAt: 0 },
    } }],
  } as unknown as Attempt;
  const g = gradeAttempt(a, { m1: mcq, s1: spr });
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => x.outcome), ['correct', 'omitted']);
  assert.equal(g[0].assisted, true);
  assert.equal(g[1].assisted, false);
});
