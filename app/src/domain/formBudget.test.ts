/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeFormBudget, suggestBluebookDates, roleLabel, roleHelp, FORM_ROLES } from './formBudget';

test('no forms taken: 2 saved, 2 diagnostics (final check), rest practice', () => {
  const plan = proposeFormBudget([]);
  assert.deepEqual(plan, {
    11: 'save_for_bluebook', 10: 'save_for_bluebook',
    9: 'in_app_diagnostic', 8: 'in_app_diagnostic',
    7: 'practice_pool', 6: 'practice_pool', 5: 'practice_pool', 4: 'practice_pool',
  });
});

test('taken forms are marked and skipped', () => {
  const plan = proposeFormBudget([4, 11]);
  assert.equal(plan[4], 'taken_in_bluebook');
  assert.equal(plan[11], 'taken_in_bluebook');
  assert.equal(plan[10], 'save_for_bluebook');
  assert.equal(plan[9], 'save_for_bluebook');
  assert.equal(plan[8], 'in_app_diagnostic');
  assert.equal(plan[7], 'in_app_diagnostic'); // 6 unexposed -> final check
  assert.equal(plan[6], 'practice_pool');
  assert.equal(plan[5], 'practice_pool');
});

test('fewer than 6 unexposed: only one diagnostic', () => {
  const plan = proposeFormBudget([4, 5, 11]);
  assert.equal(plan[10], 'save_for_bluebook');
  assert.equal(plan[9], 'save_for_bluebook');
  assert.equal(plan[8], 'in_app_diagnostic');
  assert.equal(plan[7], 'practice_pool');
  assert.equal(plan[6], 'practice_pool');
});

test('few forms left and custom form list', () => {
  assert.deepEqual(proposeFormBudget([4, 5, 6, 7, 8, 9]), {
    4: 'taken_in_bluebook', 5: 'taken_in_bluebook', 6: 'taken_in_bluebook', 7: 'taken_in_bluebook',
    8: 'taken_in_bluebook', 9: 'taken_in_bluebook', 11: 'save_for_bluebook', 10: 'save_for_bluebook',
  });
  assert.deepEqual(proposeFormBudget([], [1, 2]), { 2: 'save_for_bluebook', 1: 'save_for_bluebook' });
  assert.deepEqual(proposeFormBudget([99], [5]), { 5: 'save_for_bluebook' });
});

const NOW = new Date(2026, 9, 1, 12).getTime(); // 1 Oct 2026 local noon

test('dates are evenly spaced from +7 days to target - 7', () => {
  assert.deepEqual(suggestBluebookDates('2026-11-15', 2, NOW), ['2026-10-08', '2026-11-08']);
  const three = suggestBluebookDates('2026-11-15', 3, NOW);
  assert.equal(three.length, 3);
  assert.equal(three[0], '2026-10-08');
  assert.equal(three[2], '2026-11-08');
  assert.ok(three[0] < three[1] && three[1] < three[2]);
});

test('single date lands a week before target', () => {
  assert.deepEqual(suggestBluebookDates('2026-11-15', 1, NOW), ['2026-11-08']);
});

test('no target, bad input, or not enough time returns []', () => {
  assert.deepEqual(suggestBluebookDates(undefined, 2, NOW), []);
  assert.deepEqual(suggestBluebookDates('not-a-date', 2, NOW), []);
  assert.deepEqual(suggestBluebookDates('2026-02-30', 2, NOW), []);
  assert.deepEqual(suggestBluebookDates('2026-11-15', 0, NOW), []);
  assert.deepEqual(suggestBluebookDates('2026-10-10', 1, NOW), []);
  assert.deepEqual(suggestBluebookDates('2026-10-15', 2, NOW), []); // start == end, 2 dates impossible
  assert.deepEqual(suggestBluebookDates('2026-10-16', 2, NOW), ['2026-10-08', '2026-10-09']);
  assert.deepEqual(suggestBluebookDates('2026-10-15', 1, NOW), ['2026-10-08']);
});

test('every role has a label and one-sentence help', () => {
  for (const r of FORM_ROLES) {
    assert.ok(roleLabel(r).length > 0);
    const h = roleHelp(r);
    assert.match(h, /^[A-Z].*\.$/);
    assert.equal(h.split('. ').length, 1);
  }
});
