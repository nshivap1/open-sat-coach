// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { askAboutQuestion, followUpPasted, suggestMissReason, MAX_FOLLOW_UPS, MAX_PASTED_CHARS } from './coach';
import { ITEMS, SKILLS } from '../content/index';
import type { CoachTurn, ProviderConfig } from './types';

const g = globalThis as any;
const P: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' };
const RW = ITEMS.find((i) => i.section === 'rw' && i.response.kind === 'mcq')!;
const PASTED = 'The scientist ______ the results before publishing.\nWhich choice completes the text?\nA) verify\nB) verified\nC) verifying\nD) to verify';

function reply(content: string) {
  const bodies: any[] = [];
  const urls: string[] = [];
  g.fetch = async (u: string, init: any) => { urls.push(String(u)); bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ message: { content } })); };
  return { bodies, urls };
}

test('askAboutQuestion parses a structured reply and grounds the prompt', async () => {
  const sid = SKILLS[0].id;
  const { bodies, urls } = reply(JSON.stringify({ skillId: sid, answer: 'B', text: 'Past tense fits.', steps: ['Find the verb', 'Check tense', '', 'x', 'y', 'z', 'w'], check: '"before publishing" shows past.', takeaway: 'Match the tense.' }));
  const r = await askAboutQuestion(P, `  ${PASTED}  `, 'C');
  assert.deepEqual(r, { skillId: sid, answer: 'B', text: 'Past tense fits.', steps: ['Find the verb', 'Check tense', 'x', 'y', 'z'], check: '"before publishing" shows past.', takeaway: 'Match the tense.', ms: r.ms, status: 'unverified' });
  assert.match(urls[0], /\/api\/chat$/);
  const b = bodies[0];
  assert.equal(b.options.temperature, 0.2);
  const [sys, user] = b.messages;
  assert.match(sys.content, /grades 8–10/);
  assert.ok(sys.content.includes(`${sid} — ${SKILLS[0].officialName}`));
  assert.match(sys.content, /answer.*null/);
  assert.match(sys.content, /Never invent facts/);
  assert.ok(user.content.includes(PASTED));
  assert.match(user.content, /student's answer: C/);
  const enumIds = b.format.properties.skillId.anyOf[0].enum;
  assert.equal(enumIds.length, SKILLS.length);
});

test('askAboutQuestion maps unknown skill ids to null and keeps a null answer', async () => {
  reply(JSON.stringify({ skillId: 'made.up.skill', answer: null, text: 'The figure is missing.', steps: [], check: '', takeaway: '' }));
  const r = await askAboutQuestion(P, 'In the figure, what is angle x?');
  assert.equal(r.skillId, null);
  assert.equal(r.answer, null);
  assert.deepEqual(r.steps, []);
  assert.equal(r.check, undefined);
  assert.equal(r.status, 'unverified');
});

test('askAboutQuestion falls back to raw text when the model ignores JSON', async () => {
  reply('The answer is B because the sentence is in the past.');
  const r = await askAboutQuestion(P, PASTED);
  assert.equal(r.text, 'The answer is B because the sentence is in the past.');
  assert.equal(r.skillId, null);
  assert.equal(r.answer, null);
});

test('askAboutQuestion rejects empty and too-long input without calling the model', async () => {
  const { bodies } = reply('{}');
  await assert.rejects(askAboutQuestion(P, '   \n '), /Paste a question first/);
  await assert.rejects(askAboutQuestion(P, 'x'.repeat(MAX_PASTED_CHARS + 1)), /too long/);
  assert.equal(bodies.length, 0);
});

test('followUpPasted alternates roles, stays grounded and enforces the limit', async () => {
  const { bodies } = reply('{"text":"I can only help with this question."}');
  const thread: CoachTurn[] = [{ role: 'coach', text: 'B is right.' }, { role: 'student', text: 'Why not D?' }, { role: 'coach', text: 'D is not a full verb.' }];
  const r = await followUpPasted(P, PASTED, thread, 'Who won the game?');
  assert.equal(r.text, 'I can only help with this question.');
  assert.equal(r.status, 'unverified');
  const msgs = bodies[0].messages;
  assert.match(msgs[0].content, /only help with this question/);
  assert.ok(msgs[1].content.includes(PASTED));
  assert.deepEqual(msgs.slice(1).map((m: any) => m.role), ['user', 'assistant', 'user', 'assistant', 'user']);
  assert.equal(msgs[msgs.length - 1].content, 'Who won the game?');
  await assert.rejects(followUpPasted(P, PASTED, thread, '   '), /Type a question first/);
  const full: CoachTurn[] = [];
  for (let i = 0; i < MAX_FOLLOW_UPS; i++) full.push({ role: 'student', text: `q${i}` }, { role: 'coach', text: `a${i}` });
  await assert.rejects(followUpPasted(P, PASTED, full, 'one more?'), /Follow-up limit reached/);
  assert.equal(bodies.length, 1);
});

test('suggestMissReason returns an enum reason with a hedged why and grounds the prompt', async () => {
  if (RW.response.kind !== 'mcq') throw new Error('fixture');
  const wrong = (['A', 'B', 'C', 'D'] as const).find((c) => c !== (RW.response as any).answer)!;
  const { bodies } = reply(JSON.stringify({ reason: 'misread', why: 'Possibly you missed the word "not".' }));
  const r = await suggestMissReason(P, RW, wrong, 12_000);
  assert.deepEqual(r, { reason: 'misread', why: 'Possibly you missed the word "not".', ms: r.ms });
  const b = bodies[0];
  assert.deepEqual(b.format.properties.reason.enum, ['concept', 'misread', 'calculation', 'strategy', 'time', 'guessed', 'unsure']);
  assert.match(b.messages[0].content, /Possibly/);
  assert.match(b.messages[1].content, /12 seconds/);
  assert.match(b.messages[1].content, new RegExp(`Correct answer: ${RW.response.answer}\\)`));
  assert.match(b.messages[1].content, new RegExp(`Student's answer: ${wrong}\\)`));
});

test('suggestMissReason maps out-of-enum reasons to unsure and handles omitted answers', async () => {
  const { bodies } = reply(JSON.stringify({ reason: 'Laziness', why: '' }));
  const r = await suggestMissReason(P, RW, null);
  assert.equal(r.reason, 'unsure');
  assert.ok(r.why.length > 0);
  assert.match(bodies[0].messages[1].content, /did not answer/);
  assert.match(bodies[0].messages[1].content, /not recorded/);
  reply(JSON.stringify({ reason: ' Calculation ', why: 'Possibly a sign slip.' }));
  assert.equal((await suggestMissReason(P, RW, 'A', 90_000)).reason, 'calculation');
});
