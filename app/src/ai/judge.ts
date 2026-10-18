// AI judge: a separate, skeptical pass that checks the coach's answers and reasoning before the student
// sees them. The judge is a fresh conversation at temperature 0 that never sees the producer's hidden
// reasoning — only its output. It must SOLVE FIRST (judgeAnswer + independentWork come before the
// evaluation fields in the schema), then compare. Deterministic checks in code decide answer
// correctness whenever the key is known: a reply that contradicts the key always fails.
import type { ChoiceId, Item } from '../domain/types';
import type { ChatMessage, CoachReply, CoachTurn, JudgeSettings, JudgeVerdict, JudgedReply, PastedQuestionReply, ProviderConfig } from './types';
import { gradeItem } from '../domain/grading';
import { chat } from './client';
import { askAboutQuestion, explainAnotherWay, followUp } from './coach';

export interface JudgeInput {
  item?: Item;                     // known question (key and reference explanation available)
  questionText?: string;           // pasted question (no key)
  keyAnswer?: string | null;       // authoritative answer when known
  proposedAnswer?: string | null;  // the coach's stated answer
  studentAnswer?: string | null;
  followUpQuestion?: string;       // when judging a follow-up reply
  explanation: { text: string; steps?: string[]; check?: string; takeaway?: string };
}
export type JudgeStage = 'writing' | 'judging' | 'revising';
export interface JudgeRunOptions { autoRepair?: boolean; signal?: AbortSignal; onStage?(stage: JudgeStage): void }

type LabelOpts = { sameModel?: boolean; judgeLabel?: string };

const UNREADABLE = "The judge's reply could not be read.";

// ---------- providers ----------
/** Same source + baseUrl + model: the judge is the coach model (a critique, not independent proof). */
export function sameProvider(a: ProviderConfig, b: ProviderConfig): boolean {
  const base = (u: string) => (u ?? '').trim().replace(/\/+$/, '').toLowerCase();
  return a.source === b.source && base(a.baseUrl) === base(b.baseUrl) && a.model === b.model;
}

/** Which provider judges, and how to label it. Returns provider null when the judge is disabled. */
export function resolveJudge(coach: ProviderConfig, settings?: JudgeSettings): { provider: ProviderConfig | null; sameModel: boolean; label: string } {
  if (settings?.enabled === false) return { provider: null, sameModel: true, label: 'Judge off' };
  const p = settings?.provider;
  if (p && !sameProvider(p, coach)) return { provider: p, sameModel: false, label: `${p.label} · separate judge` };
  return { provider: coach, sameModel: true, label: 'Same model · second pass' };
}

function labelsFor(coach: ProviderConfig, judge: ProviderConfig, opts?: LabelOpts): { sameModel: boolean; judgeLabel: string } {
  const sameModel = opts?.sameModel ?? sameProvider(coach, judge);
  return { sameModel, judgeLabel: opts?.judgeLabel ?? (sameModel ? 'Same model · second pass' : `${judge.label} · separate judge`) };
}

// ---------- answers ----------
type Norm = { kind: 'letter'; v: string } | { kind: 'num'; v: number; decimals: number } | { kind: 'text'; v: string };

function parseNumber(s: string): { v: number; decimals: number } | null {
  const t = s.replace(/[\s,$%]/g, '');
  let m = /^(-?)(\d+)\/(\d+)$/.exec(t);
  if (m) {
    const den = Number(m[3]);
    if (!den) return null;
    return { v: (m[1] ? -1 : 1) * (Number(m[2]) / den), decimals: 0 };
  }
  m = /^-?(\d+(\.\d*)?|\.\d+)$/.exec(t);
  if (m) {
    const dot = t.indexOf('.');
    return { v: Number(t), decimals: dot >= 0 ? t.length - dot - 1 : 0 };
  }
  return null;
}

/** Normalizes a stated answer: a choice letter ("B", "(B)", "Choice B", "B) 12"), a number/fraction, or text. */
export function normalizeAnswer(raw: string | null | undefined): Norm | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[.。]+$/, '').trim();
  if (!s || /^(null|none|n\/a|unknown)$/i.test(s)) return null;
  s = s.replace(/^(?:choice|option|answer)\s*:?\s*/i, '');
  const letter = /^\(?([A-Da-d])\)?(?:$|[\s).:,\-–—])/.exec(s);
  if (letter && (s.length === 1 || /^\(?[A-D]\)?/.test(s) || /^\([a-d]\)/.test(s))) return { kind: 'letter', v: letter[1].toUpperCase() };
  const num = parseNumber(s.replace(/^[a-z]\s*=\s*/i, ''));
  if (num) return { kind: 'num', ...num };
  return { kind: 'text', v: s.toLowerCase().replace(/\s+/g, ' ') };
}

/** Answer equivalence: same letter; equal numbers (fractions and decimals, with SAT-style rounding of long decimals); same text. */
export function sameAnswer(a: string | null | undefined, b: string | null | undefined): boolean | null {
  const x = normalizeAnswer(a);
  const y = normalizeAnswer(b);
  if (!x || !y) return null;
  if (x.kind === 'num' && y.kind === 'num') {
    const d = Math.abs(x.v - y.v);
    if (d <= 1e-9 * Math.max(1, Math.abs(x.v))) return true;
    const dec = Math.max(x.decimals, y.decimals);
    return dec >= 3 && d < 10 ** -Math.min(x.decimals || dec, y.decimals || dec);
  }
  if (x.kind !== y.kind) return false;
  return x.v === y.v;
}

function keyShort(item?: Item, keyAnswer?: string | null): string | null {
  if (keyAnswer != null && String(keyAnswer).trim()) return String(keyAnswer).trim();
  if (!item) return null;
  return item.response.kind === 'mcq' ? item.response.answer : item.response.accepted[0] ?? null;
}

function matchesKey(stated: string, item: Item | undefined, key: string): boolean {
  if (item) {
    const r = item.response;
    if (r.kind === 'mcq') {
      const n = normalizeAnswer(stated);
      return n?.kind === 'letter' && n.v === r.answer;
    }
    if (gradeItem(item, stated).outcome === 'correct') return true;
    return r.accepted.some((a) => sameAnswer(stated, a) === true);
  }
  return sameAnswer(stated, key) === true;
}

const LETTER_PATTERNS: RegExp[] = [
  /\b(?:final|correct|right|best)?\s*answer\s*(?:is|:|=|would be|should be|must be)\s*(?:choice|option)?\s*\(?([A-Da-d])\)?(?![\w'])/gi,
  /\b(?:choice|option)\s*\(?([A-Da-d])\)?\s*(?:is|was)\s*(?:the\s+)?(?:correct|right|best|answer)\b/gi,
  /(?:^|[\s(])\(?([A-D])\)?\s+is\s+(?:the\s+)?(?:correct|right|best)(?:\s+(?:answer|choice))?\b/g,
];
const VALUE_PATTERN = /\b(?:final|correct|right)?\s*answer\s*(?:is|:|=|would be|should be|must be)\s*(?:[a-z]\s*=\s*)?(-?\d+(?:\.\d+)?(?:\/\d+)?|-?\.\d+)/gi;

/** Answers an explanation states ("Answer: B", "the answer is B", "Choice B is correct", "B: ..." at the start), in text order. */
export function statedAnswers(e: JudgeInput['explanation'], mcq: boolean): string[] {
  const text = [e.text, ...(e.steps ?? []), e.check ?? '', e.takeaway ?? ''].filter(Boolean).join('\n');
  const found: { at: number; v: string }[] = [];
  if (mcq) {
    for (const re of LETTER_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const c = m[1];
        // Lowercase letters only count inside parentheses or after "choice"/"option" ("the answer is a number" is not choice A).
        if (/[a-d]/.test(c) && !/\(\s*[a-d]\s*\)|(?:choice|option)\s*[a-d]/i.test(m[0])) continue;
        found.push({ at: m.index ?? 0, v: c.toUpperCase() });
      }
    }
    const lead = /^\s*(?:choice\s+)?\(?([A-D])\)?\s*[:)\-–—]\s/.exec(e.text);
    if (lead) found.push({ at: -1, v: lead[1] });
  } else {
    for (const m of text.matchAll(VALUE_PATTERN)) found.push({ at: m.index ?? 0, v: m[1] });
  }
  // Overlapping patterns can match the same statement twice: collapse repeats in a row.
  return found.sort((a, b) => a.at - b.at).map((f) => f.v).filter((v, i, all) => i === 0 || all[i - 1] !== v);
}

// ---------- prompt ----------
function tableText(t: NonNullable<Item['table']>): string {
  return [t.caption ?? '', t.headers.join(' | '), ...t.rows.map((r) => r.join(' | '))].filter(Boolean).join('\n');
}

function questionBlock(input: JudgeInput): string {
  const it = input.item;
  if (!it) return `Question (as pasted by the student):\n"""\n${(input.questionText ?? '').trim()}\n"""`;
  const parts: string[] = [];
  if (it.passage) parts.push(it.passage2 ? `Text 1:\n${it.passage}` : `Passage:\n${it.passage}`);
  if (it.passage2) parts.push(`Text 2:\n${it.passage2}`);
  if (it.table) parts.push(`Table:\n${tableText(it.table)}`);
  if ((it.passage ?? '').includes('__') || it.prompt.includes('__')) parts.push('(Text between double underscores, like __this__, is underlined in the question.)');
  parts.push(`Question:\n${it.prompt}`);
  const r = it.response;
  if (r.kind === 'mcq') parts.push(`Choices:\n${r.choices.map((c) => `${c.id}) ${c.text}`).join('\n')}`);
  else parts.push('This is a student-produced response question (the student types a number).');
  return parts.join('\n\n');
}

function keyText(input: JudgeInput): string | null {
  const it = input.item;
  if (it) {
    const r = it.response;
    if (r.kind === 'mcq') {
      const c = r.choices.find((x) => x.id === r.answer);
      return `${r.answer}${c ? `) ${c.text}` : ''}`;
    }
    return r.accepted.join(' or ');
  }
  return input.keyAnswer != null && String(input.keyAnswer).trim() ? String(input.keyAnswer).trim() : null;
}

function studentText(input: JudgeInput): string | null {
  const raw = input.studentAnswer == null ? '' : String(input.studentAnswer).trim();
  if (!raw) return input.studentAnswer === null ? 'The student did not answer.' : null;
  const it = input.item;
  if (!it) return raw.slice(0, 200);
  const g = gradeItem(it, raw);
  let shown = raw;
  if (it.response.kind === 'mcq') {
    const c = it.response.choices.find((x) => x.id === (raw.toUpperCase() as ChoiceId));
    if (c) shown = `${c.id}) ${c.text}`;
  }
  return `${shown} — ${g.outcome === 'correct' ? 'correct' : g.outcome === 'invalid_format' ? 'not a valid entry' : 'incorrect'}`;
}

function explanationBlock(e: JudgeInput['explanation'], proposed?: string | null): string {
  const lines: string[] = [];
  if (proposed) lines.push(`Stated answer: ${proposed}`);
  lines.push(`Explanation: ${e.text}`);
  if (e.steps?.length) lines.push(`Steps:\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  if (e.check) lines.push(`Check: ${e.check}`);
  if (e.takeaway) lines.push(`Takeaway: ${e.takeaway}`);
  return lines.join('\n');
}

const JUDGE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    independentWork: { type: 'string' },
    judgeAnswer: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    answerCorrect: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    reasoningSound: { type: 'boolean' },
    grounded: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    verdict: { type: 'string', enum: ['pass', 'fail', 'uncertain'] },
  },
  required: ['independentWork', 'judgeAnswer', 'answerCorrect', 'reasoningSound', 'grounded', 'issues', 'verdict'],
  additionalProperties: false,
};

function judgeSystem(): string {
  return [
    'You are a strict, skeptical grader who checks SAT tutoring replies written by another tutor before a student sees them.',
    'Assume the reply may contain mistakes until you have checked every part yourself. Do not trust its confidence.',
    'Work in this order:',
    '1. SOLVE FIRST. Before you read the reply, solve the question yourself. Write your short work (at most 80 words) in "independentWork" and your answer (a choice letter, or a value) in "judgeAnswer"; use null only if the question cannot be solved from the text given.',
    '2. Then check the reply against this rubric:',
    '   (1) Is its final answer right? Compare it with the correct answer when one is given; otherwise with your own answer.',
    '   (2) Does every step follow from the one before? Recompute every number yourself; check each piece of arithmetic and algebra.',
    '   (3) Reading and Writing: is every claim supported by words that are actually in the passage, with no outside facts? A grammar claim must name a real rule that really applies.',
    "   (4) If the student's answer is wrong, does the reply explain correctly why that choice fails?",
    '   (5) Does anything in the reply contradict the correct answer?',
    '   (6) For a follow-up: does the reply stay on this question and answer what the student actually asked?',
    'Set "answerCorrect" (true/false, or null if the reply never states or implies an answer), "reasoningSound" (every step follows and the math checks out), "grounded" (claims are supported by the passage or the question, no invented facts).',
    'List at most 5 "issues": each one specific and in plain language (quote the wrong step or number and say what is right). Use an empty list when there is nothing wrong.',
    '"verdict": "pass" only when the answer is right, every step is sound, everything is grounded and there are no issues; "fail" when anything is wrong; "uncertain" when you cannot tell.',
    'Reply with only the JSON object.',
  ].join('\n');
}

function judgeUser(input: JudgeInput): string {
  const parts: string[] = [questionBlock(input)];
  parts.push('Solve the question above yourself first (independentWork, judgeAnswer). Only then read the rest.');
  const key = keyText(input);
  parts.push(key ? `Correct answer (official key, trusted): ${key}` : 'There is no answer key for this question. Judge the reply against your own careful solution.');
  const st = studentText(input);
  if (st) parts.push(`Student's answer: ${st}`);
  if (input.followUpQuestion) parts.push(`The student asked this follow-up question: "${input.followUpQuestion.trim().slice(0, 600)}"`);
  parts.push(`Tutor reply to check:\n"""\n${explanationBlock(input.explanation, input.proposedAnswer)}\n"""`);
  parts.push('Now judge the reply with the rubric.');
  return parts.join('\n\n');
}

// ---------- verdict ----------
interface Raw { judgeAnswer: string | null; answerCorrect: boolean | null; reasoningSound: boolean; grounded: boolean; issues: string[]; verdict: JudgeVerdict['verdict'] }

function readJudge(json: unknown): Raw | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const j = json as Record<string, unknown>;
  const verdict = typeof j.verdict === 'string' ? j.verdict.trim().toLowerCase() : '';
  if (verdict !== 'pass' && verdict !== 'fail' && verdict !== 'uncertain') return null;
  const ja = typeof j.judgeAnswer === 'string' ? j.judgeAnswer.trim() : typeof j.judgeAnswer === 'number' ? String(j.judgeAnswer) : '';
  return {
    judgeAnswer: ja && !/^(null|none|n\/a|unknown)$/i.test(ja) ? ja.slice(0, 80) : null,
    answerCorrect: typeof j.answerCorrect === 'boolean' ? j.answerCorrect : null,
    reasoningSound: j.reasoningSound === true,
    grounded: j.grounded === true,
    issues: Array.isArray(j.issues)
      ? j.issues.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => (s.trim().length > 300 ? `${s.trim().slice(0, 297)}…` : s.trim())).slice(0, 5)
      : [],
    verdict,
  };
}

function shortAnswer(s: string): string {
  const n = normalizeAnswer(s);
  return n?.kind === 'letter' ? n.v : s.trim().slice(0, 40);
}

/** One skeptical judging pass: solve independently first, then check the answer, each step and the grounding. */
export async function judgeExplanation(judge: ProviderConfig, input: JudgeInput, opts?: { signal?: AbortSignal; sameModel?: boolean; judgeLabel?: string }): Promise<JudgeVerdict> {
  const messages: ChatMessage[] = [
    { role: 'system', content: judgeSystem() },
    { role: 'user', content: judgeUser(input) },
  ];
  const r = await chat(judge, messages, { jsonSchema: JUDGE_SCHEMA, temperature: 0, maxTokens: 800, signal: opts?.signal });
  const raw = readJudge(r.json);
  const issues: string[] = raw ? [...raw.issues] : [UNREADABLE];
  let answerCorrect: boolean | null = raw?.answerCorrect ?? null;
  const judgeAnswer = raw?.judgeAnswer ?? null;

  // Deterministic answer check, in code.
  const key = keyShort(input.item, input.keyAnswer);
  const mcq = input.item ? input.item.response.kind === 'mcq' : normalizeAnswer(key)?.kind === 'letter';
  const proposed = input.proposedAnswer != null && String(input.proposedAnswer).trim() ? String(input.proposedAnswer).trim() : null;
  if (key) {
    const stated = proposed ? [proposed] : statedAnswers(input.explanation, mcq);
    if (stated.length) {
      const wrong = stated.filter((s) => !matchesKey(s, input.item, key));
      const right = stated.length - wrong.length;
      // Mixed statements: the last one stated is the conclusion.
      const ok = !wrong.length || (right > 0 && matchesKey(stated[stated.length - 1], input.item, key));
      answerCorrect = ok;
      if (!ok) issues.unshift(`The reply gives ${shortAnswer(wrong[wrong.length - 1])} as the answer, but the correct answer is ${shortAnswer(key)}.`);
    }
  } else if (proposed && judgeAnswer) {
    const same = sameAnswer(proposed, judgeAnswer);
    if (same === false) {
      answerCorrect = false;
      const msg = `The judge got a different answer (${shortAnswer(judgeAnswer)}). Treat this answer as unconfirmed.`;
      if (!issues.includes(msg)) issues.unshift(msg);
    } else if (same === true) {
      answerCorrect = true;
    }
  }

  let verdict: JudgeVerdict['verdict'];
  if (answerCorrect === false) verdict = 'fail';
  else if (!raw) verdict = 'uncertain';
  else if (!raw.reasoningSound || !raw.grounded || raw.verdict === 'fail') verdict = 'fail';
  else if (raw.verdict === 'uncertain' || issues.length) verdict = 'uncertain';
  else verdict = 'pass';
  if (verdict === 'fail' && !issues.length) {
    issues.push(!raw?.reasoningSound ? 'A step in the reasoning does not follow.' : !raw?.grounded ? 'The reply makes a claim the question or passage does not support.' : 'The judge marked this reply as wrong.');
  }

  return {
    verdict,
    answerCorrect,
    reasoningSound: raw?.reasoningSound ?? false,
    grounded: raw?.grounded ?? false,
    judgeAnswer,
    issues: issues.slice(0, 6),
    judgeLabel: opts?.judgeLabel ?? judge.label,
    sameModel: opts?.sameModel ?? true,
    ms: r.ms,
  };
}

// ---------- produce → judge → (one) revise ----------
function isAbort(e: unknown, signal?: AbortSignal): boolean {
  return !!signal?.aborted || (!!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError');
}
function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function abortError(): Error {
  const e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
}
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** The reply as plain text, for the revision prompt. */
export function replyAsText(r: { text: string; steps?: string[]; check?: string; takeaway?: string; answer?: string | null }): string {
  const lines: string[] = [];
  if (r.answer) lines.push(`Answer: ${r.answer}`);
  lines.push(r.text);
  if (r.steps?.length) lines.push(...r.steps.map((s, i) => `${i + 1}. ${s}`));
  if (r.check) lines.push(`Check: ${r.check}`);
  if (r.takeaway) lines.push(`Takeaway: ${r.takeaway}`);
  return lines.join('\n');
}

async function produceJudged<T>(
  produce: (revise?: { previous: string; issues: string[]; keyAnswer?: string | null }) => Promise<T>,
  toInput: (reply: T) => JudgeInput,
  judge: ProviderConfig | null,
  keyAnswer: string | null,
  labels: { sameModel: boolean; judgeLabel: string },
  opts: JudgeRunOptions | undefined,
  merge?: (first: T, revised: T) => T,
): Promise<JudgedReply<T>> {
  const signal = opts?.signal;
  const stage = (s: JudgeStage) => { try { opts?.onStage?.(s); } catch { /* UI callback errors never stop the run */ } };
  checkAbort(signal);
  stage('writing');
  const reply = await produce();
  if (!judge) return { reply, verdict: null, attempts: 1, repaired: false };
  const runJudge = async (r: T): Promise<{ verdict: JudgeVerdict } | { error: string }> => {
    checkAbort(signal);
    stage('judging');
    try {
      return { verdict: await judgeExplanation(judge, toInput(r), { signal, ...labels }) };
    } catch (e) {
      if (isAbort(e, signal)) throw e;
      return { error: errText(e) };
    }
  };
  const first = await runJudge(reply);
  if ('error' in first) return { reply, verdict: null, attempts: 1, repaired: false, judgeError: first.error };
  if (first.verdict.verdict !== 'fail' || opts?.autoRepair === false) return { reply, verdict: first.verdict, attempts: 1, repaired: false };

  checkAbort(signal);
  stage('revising');
  let revised: T;
  try {
    revised = await produce({ previous: replyAsText(reply as never), issues: first.verdict.issues, keyAnswer });
  } catch (e) {
    if (isAbort(e, signal)) throw e;
    return { reply, verdict: first.verdict, attempts: 2, repaired: false };
  }
  if (merge) revised = merge(reply, revised);
  const second = await runJudge(revised);
  if ('error' in second) return { reply: revised, verdict: null, attempts: 2, repaired: true, judgeError: second.error };
  return { reply: revised, verdict: second.verdict, attempts: 2, repaired: true };
}

function coachExplanation(r: CoachReply): JudgeInput['explanation'] {
  const e: JudgeInput['explanation'] = { text: r.text };
  if (r.steps?.length) e.steps = r.steps;
  if (r.takeaway) e.takeaway = r.takeaway;
  return e;
}

/** explainAnotherWay + judge (+ one revision with the judge's issues when autoRepair and the verdict fails). */
export async function explainWithJudge(coach: ProviderConfig, judge: ProviderConfig | null, item: Item, chosen: string | null | undefined, opts?: JudgeRunOptions & { sameModel?: boolean; judgeLabel?: string }): Promise<JudgedReply<CoachReply>> {
  const key = keyShort(item);
  return produceJudged<CoachReply>(
    (revise) => explainAnotherWay(coach, item, chosen ?? null, opts?.signal, revise),
    (r) => ({ item, keyAnswer: key, studentAnswer: chosen ?? null, explanation: coachExplanation(r) }),
    judge,
    key,
    judge ? labelsFor(coach, judge, opts) : { sameModel: true, judgeLabel: '' },
    opts,
  );
}

export async function followUpWithJudge(coach: ProviderConfig, judge: ProviderConfig | null, item: Item, thread: CoachTurn[], question: string, opts?: JudgeRunOptions & { sameModel?: boolean; judgeLabel?: string }): Promise<JudgedReply<CoachReply>> {
  const key = keyShort(item);
  return produceJudged<CoachReply>(
    (revise) => followUp(coach, item, thread, question, opts?.signal, revise),
    (r) => ({ item, keyAnswer: key, followUpQuestion: question, explanation: coachExplanation(r) }),
    judge,
    key,
    judge ? labelsFor(coach, judge, opts) : { sameModel: true, judgeLabel: '' },
    opts,
  );
}

/** askAboutQuestion + judge. Without a key, a judge answer that differs from the coach's is a conflict (verdict 'fail', answerCorrect false). */
export async function askWithJudge(coach: ProviderConfig, judge: ProviderConfig | null, text: string, studentAnswer: string | undefined, opts?: JudgeRunOptions & { sameModel?: boolean; judgeLabel?: string }): Promise<JudgedReply<PastedQuestionReply>> {
  return produceJudged<PastedQuestionReply>(
    (revise) => askAboutQuestion(coach, text, studentAnswer, opts?.signal, revise),
    (r) => {
      const e: JudgeInput['explanation'] = { text: r.text };
      if (r.steps.length) e.steps = r.steps;
      if (r.check) e.check = r.check;
      if (r.takeaway) e.takeaway = r.takeaway;
      return { questionText: text, keyAnswer: null, proposedAnswer: r.answer, studentAnswer: studentAnswer?.trim() ? studentAnswer : undefined, explanation: e };
    },
    judge,
    null,
    judge ? labelsFor(coach, judge, opts) : { sameModel: true, judgeLabel: '' },
    opts,
    // The coach's skill classification is kept when the revision leaves it out.
    (first, revised) => ({ ...revised, skillId: revised.skillId ?? first.skillId }),
  );
}
