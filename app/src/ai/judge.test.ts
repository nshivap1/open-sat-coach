// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { askWithJudge, explainWithJudge, followUpWithJudge, judgeExplanation, normalizeAnswer, resolveJudge, sameAnswer, statedAnswers } from './judge';
import { ITEMS } from '../content/index';
import type { Item } from '../domain/types';
import type { JudgeStage } from './judge';
import type { ProviderConfig } from './types';

const g = globalThis as any;
const COACH: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' };
const JUDGE: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:12b', label: 'Ollama · gemma4:12b' };
const MCQ = ITEMS.find((i) => i.response.kind === 'mcq' && i.section === 'math')! as Item & { response: { kind: 'mcq'; answer: string } };
const KEY = MCQ.response.answer;
const WRONG = (['A', 'B', 'C', 'D'] as const).find((c) => c !== KEY)!;
const SPR = ITEMS.find((i) => i.response.kind === 'spr')!;

const PASS = { independentWork: 'Worked it out.', judgeAnswer: KEY, answerCorrect: true, reasoningSound: true, grounded: true, issues: [] as string[], verdict: 'pass' };
const FAIL = { ...PASS, reasoningSound: false, issues: ['Step 2 says 3 × 4 = 14; it is 12.'], verdict: 'fail' };

type Kind = 'judge' | 'coach' | 'pasted';
/** Ollama-shaped server. Each kind has a queue of replies (string = raw content, Error = server failure). */
function server(queues: Partial<Record<Kind, unknown[]>>) {
  const calls: { kind: Kind; body: any }[] = [];
  g.fetch = async (url: string, init: any) => {
    assert.match(url, /\/api\/chat$/);
    const body = JSON.parse(init.body);
    const props = body.format?.properties ?? {};
    const kind: Kind = props.verdict ? 'judge' : props.skillId ? 'pasted' : 'coach';
    calls.push({ kind, body });
    const q = queues[kind] ?? [];
    const next = q.length > 1 ? q.shift() : q[0];
    if (next instanceof Error) return new Response(JSON.stringify({ error: next.message }), { status: 500 });
    const content = typeof next === 'string' ? next : JSON.stringify(next);
    return new Response(JSON.stringify({ model: body.model, message: { role: 'assistant', content }, done: true }));
  };
  return calls;
}

test('resolveJudge: off, same model, separate judge', () => {
  assert.deepEqual(resolveJudge(COACH, { enabled: false, autoRepair: true }), { provider: null, sameModel: true, label: 'Judge off' });
  assert.deepEqual(resolveJudge(COACH), { provider: COACH, sameModel: true, label: 'Same model · second pass' });
  assert.deepEqual(resolveJudge(COACH, { enabled: true, autoRepair: true, provider: { ...COACH, label: 'x' } }), { provider: COACH, sameModel: true, label: 'Same model · second pass' });
  assert.deepEqual(resolveJudge(COACH, { enabled: true, autoRepair: true, provider: JUDGE }), { provider: JUDGE, sameModel: false, label: 'Ollama · gemma4:12b · separate judge' });
});

test('answer helpers: letters, values, stated answers', () => {
  assert.deepEqual(normalizeAnswer('(B)'), { kind: 'letter', v: 'B' });
  assert.deepEqual(normalizeAnswer('Choice C) 12'), { kind: 'letter', v: 'C' });
  assert.equal(sameAnswer('3/2', '1.5'), true);
  assert.equal(sameAnswer('1/3', '.3333'), true);
  assert.equal(sameAnswer('x = 4', '4'), true);
  assert.equal(sameAnswer('B', 'C'), false);
  assert.equal(sameAnswer(null, 'C'), null);
  assert.deepEqual(statedAnswers({ text: 'You chose A. The answer is a number? No: the correct answer is (C).' }, true), ['C']);
  assert.deepEqual(statedAnswers({ text: 'Choice D is correct because it fits.' }, true), ['D']);
  assert.deepEqual(statedAnswers({ text: 'B: the crabs trade shells.' }, true), ['B']);
  assert.deepEqual(statedAnswers({ text: 'So the answer is 7/2.' }, false), ['7/2']);
});

test('pass: the judge solves first, at temperature 0, in a fresh conversation, and passes a sound reply', async () => {
  const calls = server({ judge: [PASS] });
  const v = await judgeExplanation(JUDGE, { item: MCQ, studentAnswer: WRONG, explanation: { text: `The answer is ${KEY}.`, steps: ['Set up the equation.'], takeaway: 'Check your work.' } }, { sameModel: false, judgeLabel: 'Ollama · gemma4:12b · separate judge' });
  assert.equal(v.verdict, 'pass');
  assert.equal(v.answerCorrect, true);
  assert.equal(v.judgeAnswer, KEY);
  assert.deepEqual(v.issues, []);
  assert.equal(v.sameModel, false);
  assert.equal(v.judgeLabel, 'Ollama · gemma4:12b · separate judge');
  assert.equal(calls.length, 1);
  const b = calls[0].body;
  assert.equal(b.options.temperature, 0);
  assert.equal(b.messages.length, 2);
  assert.equal(b.messages[0].role, 'system');
  assert.match(b.messages[0].content, /skeptical/);
  // Solve-first ordering: the model commits to its own answer before the evaluation fields.
  assert.deepEqual(Object.keys(b.format.properties).slice(0, 2), ['independentWork', 'judgeAnswer']);
  assert.deepEqual(b.format.required.slice(0, 2), ['independentWork', 'judgeAnswer']);
  const user = b.messages[1].content as string;
  assert.ok(user.includes(MCQ.prompt));
  assert.match(user, new RegExp(`Correct answer \\(official key, trusted\\): ${KEY}`));
  assert.match(user, /Student's answer: .*incorrect/);
  assert.ok(user.indexOf('Solve the question above yourself first') < user.indexOf('Tutor reply to check'));
});

test('deterministic fail: an explanation that states a wrong letter fails even when the judge model says pass', async () => {
  server({ judge: [PASS] });
  const v = await judgeExplanation(JUDGE, { item: MCQ, explanation: { text: `Work it through and the answer is ${WRONG}.` } });
  assert.equal(v.verdict, 'fail');
  assert.equal(v.answerCorrect, false);
  assert.match(v.issues[0], new RegExp(`gives ${WRONG} as the answer, but the correct answer is ${KEY}`));
  // proposedAnswer is checked too, and SPR uses grading semantics.
  server({ judge: [PASS] });
  const accepted = (SPR.response as any).accepted[0] as string;
  const ok = await judgeExplanation(JUDGE, { item: SPR, proposedAnswer: accepted, explanation: { text: 'Solve for x.' } });
  assert.equal(ok.verdict, 'pass');
  server({ judge: [PASS] });
  const bad = await judgeExplanation(JUDGE, { item: SPR, explanation: { text: 'So the answer is 99999.' } });
  assert.equal(bad.verdict, 'fail');
});

test('unparseable judge output → uncertain', async () => {
  server({ judge: ['I think it is fine, mostly.'] });
  const v = await judgeExplanation(JUDGE, { item: MCQ, explanation: { text: 'Set up the equation and solve.' } });
  assert.equal(v.verdict, 'uncertain');
  assert.deepEqual(v.issues, ["The judge's reply could not be read."]);
  assert.equal(v.answerCorrect, null);
  // A model "pass" that still lists issues is not a pass.
  server({ judge: [{ ...PASS, issues: ['The takeaway is vague.'] }] });
  const v2 = await judgeExplanation(JUDGE, { item: MCQ, explanation: { text: 'Set up the equation and solve.' } });
  assert.equal(v2.verdict, 'uncertain');
});

test('repair flow: fail → revision with the issues and key → pass', async () => {
  const calls = server({
    coach: [{ text: 'First try.' }, { text: `Fixed: the answer is ${KEY}.` }],
    judge: [FAIL, PASS],
  });
  const stages: JudgeStage[] = [];
  const r = await explainWithJudge(COACH, JUDGE, MCQ, WRONG, { onStage: (s) => stages.push(s) });
  assert.equal(r.repaired, true);
  assert.equal(r.attempts, 2);
  assert.equal(r.verdict?.verdict, 'pass');
  assert.equal(r.reply.text, `Fixed: the answer is ${KEY}.`);
  assert.equal(r.verdict?.sameModel, false);
  assert.equal(r.verdict?.judgeLabel, 'Ollama · gemma4:12b · separate judge');
  assert.deepEqual(stages, ['writing', 'judging', 'revising', 'judging']);
  assert.deepEqual(calls.map((c) => c.kind), ['coach', 'judge', 'coach', 'judge']);
  const revisionPrompt = calls[2].body.messages[1].content as string;
  assert.match(revisionPrompt, /Your previous reply:\n"""\nFirst try\./);
  assert.match(revisionPrompt, /- Step 2 says 3 × 4 = 14; it is 12\./);
  assert.match(revisionPrompt, new RegExp(`The correct answer is ${KEY}\\. Your corrected reply must agree with it\\.`));
  // The judge never sees the producer's prompt — only its output.
  assert.ok(!(calls[1].body.messages[1].content as string).includes('Reference explanation'));
  // autoRepair false: one producer call.
  server({ coach: [{ text: 'First try.' }], judge: [FAIL] });
  const once = await explainWithJudge(COACH, COACH, MCQ, WRONG, { autoRepair: false });
  assert.equal(once.attempts, 1);
  assert.equal(once.repaired, false);
  assert.equal(once.verdict?.verdict, 'fail');
  assert.equal(once.verdict?.sameModel, true);
  assert.equal(once.verdict?.judgeLabel, 'Same model · second pass');
});

test('judge off → unchecked reply; judge error → verdict null + judgeError', async () => {
  const calls = server({ coach: [{ text: 'Plain reply.' }] });
  const off = await followUpWithJudge(COACH, null, MCQ, [], 'Why not A?');
  assert.deepEqual({ verdict: off.verdict, attempts: off.attempts, repaired: off.repaired }, { verdict: null, attempts: 1, repaired: false });
  assert.equal(calls.length, 1);
  server({ coach: [{ text: 'Plain reply.' }], judge: [new Error('model "gemma4:12b" not found')] });
  const err = await followUpWithJudge(COACH, JUDGE, MCQ, [], 'Why not A?');
  assert.equal(err.verdict, null);
  assert.equal(err.reply.text, 'Plain reply.');
  assert.match(err.judgeError ?? '', /not found/);
});

test('askWithJudge: a different judge answer is a conflict; skill and answer pass through unchanged', async () => {
  const pasted = { skillId: null, answer: 'B', text: 'Solve 2x + 3 = 11 to get x = 4, choice B.', steps: ['Subtract 3.', 'Divide by 2.'], check: '2(4) + 3 = 11', takeaway: 'Undo operations in reverse.' };
  const calls = server({ pasted: [pasted], judge: [{ ...PASS, judgeAnswer: 'C' }] });
  const r = await askWithJudge(COACH, JUDGE, 'If 2x + 3 = 11, what is x? A) 3 B) 4 C) 5 D) 7', undefined, { autoRepair: false });
  assert.equal(r.verdict?.verdict, 'fail');
  assert.equal(r.verdict?.answerCorrect, false);
  assert.equal(r.verdict?.judgeAnswer, 'C');
  assert.ok(r.verdict?.issues.includes('The judge got a different answer (C). Treat this answer as unconfirmed.'));
  assert.equal(r.reply.answer, 'B');
  assert.equal(r.reply.skillId, null);
  assert.match(calls[1].body.messages[1].content, /no answer key/);
  // Agreement (with value equivalence) passes.
  server({ pasted: [{ ...pasted, answer: '3/2' }], judge: [{ ...PASS, judgeAnswer: '1.5' }] });
  const ok = await askWithJudge(COACH, JUDGE, 'If 2x = 3, what is x?', undefined);
  assert.equal(ok.verdict?.verdict, 'pass');
  assert.equal(ok.verdict?.answerCorrect, true);
});

test('abort stops the run', async () => {
  const ctrl = new AbortController();
  server({ coach: [{ text: 'First try.' }], judge: [PASS] });
  const p = explainWithJudge(COACH, JUDGE, MCQ, WRONG, { signal: ctrl.signal, onStage: (s) => { if (s === 'judging') ctrl.abort(); } });
  await assert.rejects(p, (e: any) => e.name === 'AbortError');
});
