// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { generatePracticeItems, structureGate } from './generate';
import { ITEMS } from '../content/index';
import type { GenerationProgress, ProviderConfig } from './types';

const g = globalThis as any;
const P: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' };
const SKILL = 'rw.ii.central';

const VALID = {
  passage: 'Marine biologist Tavi Renholm studied hermit crabs on the fictional island of Quellmar for two years. She expected crabs to choose the largest empty shells available. Instead, most crabs picked medium shells that matched the size of nearby crabs, which let them trade shells in quick chains. Renholm argues that shell choice may depend on social opportunity as much as on size.',
  prompt: 'Which choice best states the main idea of the text?',
  choices: {
    A: 'Hermit crabs on Quellmar always choose the largest shell they can find.',
    B: "Renholm's study suggests that hermit crabs may choose shells partly for the chance to trade with other crabs.",
    C: 'Quellmar has fewer empty shells than other islands.',
    D: 'Renholm concluded that shell size does not matter to hermit crabs.',
  },
  answer: 'B',
  explanation: {
    answerSummary: 'B: the crabs picked shells that allowed trading chains, suggesting social reasons.',
    steps: ['Compare the expectation with the finding.', 'Find the conclusion in the last sentence.'],
    check: '"shell choice may depend on social opportunity as much as on size."',
    whyWrong: { A: 'This was the expectation, not the finding.', C: 'Not discussed.', D: 'Too extreme.' },
    takeaway: 'A main idea covers the finding and its conclusion.',
  },
  hints: ['This asks for the main idea.', 'Compare what she expected with what she found.', 'Read the last sentence closely.'],
};

type Handlers = { write(): unknown; solve(): unknown; unique(): unknown; judge?(): unknown };
const JUDGE_PASS = { independentWork: 'The finding and last sentence point to B.', judgeAnswer: 'B', answerCorrect: true, reasoningSound: true, grounded: true, issues: [], verdict: 'pass' };
function server(h: Handlers) {
  const calls: { kind: string; body: any }[] = [];
  g.fetch = async (url: string, init: any) => {
    assert.match(url, /\/api\/chat$/);
    const body = JSON.parse(init.body);
    const props = body.format?.properties ?? {};
    const kind = props.prompt ? 'write' : props.exactlyOne ? 'unique' : props.verdict ? 'judge' : 'solve';
    calls.push({ kind, body });
    const content = JSON.stringify(kind === 'judge' && !h.judge ? JUDGE_PASS : (h as any)[kind]());
    return new Response(JSON.stringify({ model: body.model, message: { role: 'assistant', content }, done: true }));
  };
  return calls;
}

test('accepts an item that passes structure, independent solve and uniqueness gates', async () => {
  const calls = server({ write: () => VALID, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: true, alternative: null }) });
  const progress: GenerationProgress[] = [];
  const r = await generatePracticeItems(P, SKILL, 1, { onProgress: (p) => progress.push(p) });
  assert.equal(r.rejected, 0);
  assert.equal(r.items.length, 1);
  const it = r.items[0];
  assert.match(it.id, /^gen\.rw\.ii\.central\./);
  assert.equal(it.origin, 'generated');
  assert.equal(it.difficultySource, 'unknown');
  assert.equal(it.difficulty, 'medium');
  assert.equal(it.section, 'rw');
  assert.equal(it.typeId, 'rw.ii.central.main_idea');
  assert.deepEqual(it.formatTags, ['mcq', 'generated']);
  assert.equal(it.response.kind === 'mcq' && it.response.answer, 'B');
  assert.equal(it.explanation.whyWrong?.B, undefined);
  assert.equal(it.hints.length, 3);
  assert.deepEqual(calls.map((c) => c.kind), ['write', 'solve', 'unique', 'judge']);
  assert.equal(calls[0].body.options.temperature, 0.8);
  assert.match(calls[0].body.messages[0].content, /What this tests/);
  assert.match(calls[0].body.messages[1].content, /Do not copy/);
  // The solver never sees the key or the explanation.
  const solveText = JSON.stringify(calls[1].body.messages);
  assert.equal(calls[1].body.options.temperature, 0);
  assert.ok(!solveText.includes(VALID.explanation.answerSummary));
  assert.ok(!/Intended answer|Answer: B/.test(solveText));
  assert.deepEqual(progress.map((p) => p.stage), ['writing', 'checking', 'checking', 'accepted']);
  assert.equal(progress[2].note, 'AI judge reviewing the explanation');
  // The judge is a fresh conversation at temperature 0 and is given the candidate's key.
  assert.equal(calls[3].body.options.temperature, 0);
  assert.match(calls[3].body.messages[1].content, /Correct answer \(official key, trusted\): B/);
});

test('rejects when the AI judge fails the explanation, feeding its issues back', async () => {
  const calls = server({
    write: () => VALID, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: true, alternative: null }),
    judge: () => ({ ...JUDGE_PASS, grounded: false, issues: ['The check quotes words that are not in the passage.'], verdict: 'fail' }),
  });
  const r = await generatePracticeItems(P, SKILL, 1);
  assert.deepEqual(r, { items: [], rejected: 1 });
  assert.equal(calls.filter((c) => c.kind === 'judge').length, 3);
  assert.match(calls[4].body.messages[1].content, /AI judge reviewing your explanation found these problems: The check quotes words/);
});

test('uses a separate judge provider when given', async () => {
  const J: ProviderConfig = { ...P, model: 'gemma4:12b', label: 'Ollama · gemma4:12b' };
  const calls = server({ write: () => VALID, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: true, alternative: null }) });
  const r = await generatePracticeItems(P, SKILL, 1, { judge: J });
  assert.equal(r.items.length, 1);
  assert.equal(calls.find((c) => c.kind === 'judge')!.body.model, 'gemma4:12b');
  assert.equal(calls.find((c) => c.kind === 'solve')!.body.model, 'gemma4:e4b');
});

test('rejects after repairs when the independent solve disagrees with the key', async () => {
  const calls = server({ write: () => VALID, solve: () => ({ answer: 'A' }), unique: () => ({ exactlyOne: true, alternative: null }) });
  const progress: GenerationProgress[] = [];
  const r = await generatePracticeItems(P, SKILL, 1, { onProgress: (p) => progress.push(p) });
  assert.deepEqual(r, { items: [], rejected: 1 });
  assert.equal(calls.filter((c) => c.kind === 'write').length, 3);
  assert.equal(calls.filter((c) => c.kind === 'unique').length, 0);
  assert.match(calls[2].body.messages[1].content, /independent solver chose A/);
  assert.equal(progress[progress.length - 1].stage, 'rejected');
});

test('rejects when a second choice is defensible', async () => {
  server({ write: () => VALID, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: false, alternative: 'D' }) });
  const r = await generatePracticeItems(P, SKILL, 1);
  assert.deepEqual(r, { items: [], rejected: 1 });
});

test('rejects a duplicate of an existing item', async () => {
  const orig = ITEMS.find((i) => i.skillId === SKILL && i.passage)!;
  const dup = { ...VALID, passage: orig.passage, prompt: orig.prompt };
  const calls = server({ write: () => dup, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: true, alternative: null }) });
  const r = await generatePracticeItems(P, SKILL, 1);
  assert.deepEqual(r, { items: [], rejected: 1 });
  assert.equal(calls.filter((c) => c.kind === 'solve').length, 0);
  assert.match(calls[1].body.messages[1].content, /too similar/);
});

test('structure gate catches broken items', () => {
  const ok = { ...VALID, answer: 'B' as const, hints: VALID.hints };
  assert.equal(structureGate(ok as any, 'rw', []).ok, true);
  assert.equal(structureGate({ ...ok, choices: { ...ok.choices, D: ok.choices.A } } as any, 'rw', []).ok, false);
  assert.equal(structureGate({ ...ok, choices: { ...ok.choices, D: 'All of the above' } } as any, 'rw', []).ok, false);
  assert.equal(structureGate({ ...ok, passage: 'Too short.' } as any, 'rw', []).ok, false);
  assert.equal(structureGate({ ...ok, answer: 'E' } as any, 'rw', []).ok, false);
  assert.equal(structureGate({ ...ok, explanation: { ...ok.explanation, answerSummary: '' } } as any, 'rw', []).ok, false);
});

test('stops on abort and returns what passed', async () => {
  const ctrl = new AbortController();
  let writes = 0;
  server({ write: () => { if (++writes === 2) ctrl.abort(); return VALID; }, solve: () => ({ answer: 'B' }), unique: () => ({ exactlyOne: true, alternative: null }) });
  const r = await generatePracticeItems(P, SKILL, 3, { signal: ctrl.signal });
  assert.equal(r.items.length, 1);
  assert.equal(r.rejected, 0);
});

test('surfaces the error when every call fails', async () => {
  g.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(generatePracticeItems(P, SKILL, 1));
});
