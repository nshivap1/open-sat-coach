// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import type { TestSpec } from './types';
import { createAttempt, endBreak, remainingMs, resumeAttempt, startModule, submitModule, updateResponse } from './attempts';

const spec: TestSpec = {
  id: 't', title: 'T', mode: 'diagnostic', label: 'L', description: '',
  modules: [
    { id: 'm0', section: 'rw', title: 'RW', itemIds: ['a', 'b'], durationSec: 60 },
    { id: 'm1', section: 'math', title: 'Math', itemIds: ['c'], durationSec: null },
  ],
  breakAfterModuleIndex: 0,
};

test('create and start', () => {
  const a = createAttempt(spec, 'p', 1000);
  assert.equal(a.status, 'in_progress');
  assert.equal(a.currentModule, 0);
  assert.ok(a.modules.every((m) => m.status === 'not_started'));
  const b = startModule(a, 0, 1000);
  assert.equal(b.modules[0].status, 'active');
  assert.equal(b.modules[0].deadline, 61000);
  assert.equal(remainingMs(b.modules[0], 31000), 30000);
  assert.equal(a.modules[0].status, 'not_started'); // pure
});

test('updateResponse creates record; blocked after expiry', () => {
  let a = startModule(createAttempt(spec, 'p', 0), 0, 0);
  a = updateResponse(a, 'a', { raw: 'B' }, 10);
  assert.equal(a.modules[0].responses.a.raw, 'B');
  assert.equal(a.modules[0].responses.a.flagged, false);
  const late = updateResponse(a, 'b', { raw: 'C' }, 60000);
  assert.equal(late, a);
  assert.equal(late.modules[0].responses.b, undefined);
});

test('expiry, double submit and break transition', () => {
  let a = startModule(createAttempt(spec, 'p', 0), 0, 0);
  a = submitModule(a, 0, 60000, 'expired');
  assert.equal(a.modules[0].status, 'expired');
  assert.equal(a.status, 'on_break');
  assert.equal(a.breakEndsAt, 60000 + 600000);
  const again = submitModule(a, 0, 70000, 'manual');
  assert.equal(again, a);
  assert.equal(updateResponse(a, 'a', { raw: 'A' }, 61000), a);
  a = endBreak(a, 100000);
  assert.equal(a.status, 'in_progress');
  assert.equal(a.currentModule, 1);
  a = startModule(a, 1, 100000);
  assert.equal(remainingMs(a.modules[1], 200000), null);
  a = submitModule(a, 1, 200000, 'manual');
  assert.equal(a.modules[1].status, 'submitted');
  assert.equal(a.status, 'completed');
  assert.equal(a.completedAt, 200000);
});

test('resume after deadline expires the module', () => {
  const a = startModule(createAttempt(spec, 'p', 0), 0, 0);
  const r = resumeAttempt(a, 120000);
  assert.equal(r.interrupted, true);
  assert.equal(r.modules[0].status, 'expired');
  assert.equal(r.status, 'on_break');
  const early = resumeAttempt(a, 30000);
  assert.equal(early.modules[0].status, 'active');
  assert.equal(early.interrupted, true);
});
