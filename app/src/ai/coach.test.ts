// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { explainAnotherWay, followUp, MAX_FOLLOW_UPS } from './coach';
import { ITEMS } from '../content/index';
import type { CoachTurn, ProviderConfig } from './types';

const g = globalThis as any;
const P: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' };
const RW = ITEMS.find((i) => i.section === 'rw' && i.response.kind === 'mcq')!;
const MATH = ITEMS.find((i) => i.section === 'math')!;

function reply(content: string) {
  const bodies: any[] = [];
  g.fetch = async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ message: { content } })); };
  return bodies;
}

test('explainAnotherWay grounds the prompt in the key and returns an unverified reply', async () => {
  if (RW.response.kind !== 'mcq') throw new Error('fixture');
  const wrong = (['A', 'B', 'C', 'D'] as const).find((c) => c !== (RW.response as any).answer)!;
  const bodies = reply(JSON.stringify({ text: 'Look at the passage.', steps: ['a', 'b', 'c', 'd', 'e', 'f'], takeaway: 'Quote it.' }));
  const r = await explainAnotherWay(P, RW, wrong);
  assert.deepEqual(r, { text: 'Look at the passage.', steps: ['a', 'b', 'c', 'd', 'e'], takeaway: 'Quote it.', ms: r.ms, status: 'unverified' });
  const [sys, user] = bodies[0].messages;
  assert.match(sys.content, /grades 8–10/);
  assert.match(sys.content, /quoted words from the passage/);
  assert.match(sys.content, /150 words/);
  assert.match(user.content, new RegExp(`Correct answer: ${RW.response.answer}\\)`));
  assert.match(user.content, new RegExp(`Student's answer: ${wrong}\\).*incorrect`));
  assert.ok(user.content.includes(RW.explanation.answerSummary));
  assert.ok(user.content.includes(RW.prompt));
  assert.deepEqual(bodies[0].format.required, ['text']);
});

test('explainAnotherWay falls back to raw text and uses Math guidance', async () => {
  const bodies = reply('Set up 2x + 3 = 11, so x = 4. Check: 2(4) + 3 = 11.');
  const r = await explainAnotherWay(P, MATH, null);
  assert.equal(r.text, 'Set up 2x + 3 = 11, so x = 4. Check: 2(4) + 3 = 11.');
  assert.equal(r.status, 'unverified');
  assert.match(bodies[0].messages[0].content, /show the equations/);
  assert.match(bodies[0].messages[1].content, /did not answer/);
});

test('followUp keeps turns alternating, stays on topic and enforces the limit', async () => {
  const bodies = reply('{"text":"I can only help with this question."}');
  const thread: CoachTurn[] = [{ role: 'coach', text: 'First explanation.' }, { role: 'student', text: 'Why not B?' }, { role: 'coach', text: 'Because...' }];
  const r = await followUp(P, RW, thread, 'What is the capital of France?');
  assert.equal(r.text, 'I can only help with this question.');
  const msgs = bodies[0].messages;
  assert.match(msgs[0].content, /only help with this question/);
  assert.deepEqual(msgs.slice(1).map((m: any) => m.role), ['user', 'assistant', 'user', 'assistant', 'user']);
  assert.equal(msgs[msgs.length - 1].content, 'What is the capital of France?');
  const full: CoachTurn[] = [];
  for (let i = 0; i < MAX_FOLLOW_UPS; i++) full.push({ role: 'student', text: `q${i}` }, { role: 'coach', text: `a${i}` });
  await assert.rejects(followUp(P, RW, full, 'one more?'), /Follow-up limit reached/);
  assert.equal(bodies.length, 1);
});
