import type { Item, ChoiceId, MissReason } from '../domain/types';
import { SKILLS, SKILL_BY_ID } from '../content/ontology';
import type { ChatMessage, ChatResult, CoachReply, CoachTurn, ProviderConfig, PastedQuestionReply, MissSuggestion } from './types';
import { gradeItem } from '../domain/grading';
import { chat } from './client';

export const MAX_FOLLOW_UPS = 6;

const REPLY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    takeaway: { type: 'string' },
  },
  required: ['text'],
  additionalProperties: false,
};

function systemPrompt(item: Item, followUp: boolean): string {
  const lines = [
    'You are a patient SAT tutor for students in grades 8–10.',
    'Use plain, everyday words and short sentences.',
    'Your explanation must agree with the correct answer provided below. Never suggest a different answer.',
    item.section === 'rw'
      ? 'This is a Reading and Writing question: support every claim with quoted words from the passage.'
      : 'This is a Math question: show the equations you use and finish with a quick check of the answer.',
    'If the student\'s answer is wrong, say specifically why that choice does not work.',
    'Never invent facts that are not in the passage or the question.',
    'Keep the reply to 150 words or fewer.',
  ];
  if (followUp) {
    lines.push('The student is asking a follow-up question about this same SAT question. Stay on this question. If the student asks about something unrelated, say briefly that you can only help with this question.');
  }
  lines.push('Reply as JSON: "text" (the explanation), optional "steps" (at most 5 short steps), optional "takeaway" (one sentence to remember).');
  return lines.join('\n');
}

function tableText(t: NonNullable<Item['table']>): string {
  const out: string[] = [];
  if (t.caption) out.push(t.caption);
  out.push(t.headers.join(' | '));
  for (const r of t.rows) out.push(r.join(' | '));
  return out.join('\n');
}

function correctAnswerText(item: Item): string {
  const r = item.response;
  if (r.kind === 'mcq') {
    const c = r.choices.find((x) => x.id === r.answer);
    return `${r.answer}${c ? `) ${c.text}` : ''}`;
  }
  return r.accepted.join(' or ');
}

function studentAnswerText(item: Item, chosen?: ChoiceId | string | null): string {
  if (chosen == null || String(chosen).trim() === '') return 'The student did not answer.';
  const raw = String(chosen).trim();
  const g = gradeItem(item, raw);
  const verdict = g.outcome === 'correct' ? 'correct' : g.outcome === 'invalid_format' ? `not a valid entry (${g.formatMessage ?? 'format'})` : 'incorrect';
  const r = item.response;
  let shown = raw;
  if (r.kind === 'mcq') {
    const id = raw.toUpperCase() as ChoiceId;
    const c = r.choices.find((x) => x.id === id);
    if (c) shown = `${id}) ${c.text}`;
    const why = item.explanation.whyWrong?.[id];
    if (g.outcome !== 'correct' && why) return `${shown} — ${verdict}. Reference note on this choice: ${why}`;
  }
  return `${shown} — ${verdict}.`;
}

/** Grounding block: the full item, its key and its reference explanation. */
function groundingText(item: Item, chosen?: ChoiceId | string | null): string {
  const parts: string[] = [];
  if (item.passage) parts.push(item.passage2 ? `Text 1:\n${item.passage}` : `Passage:\n${item.passage}`);
  if (item.passage2) parts.push(`Text 2:\n${item.passage2}`);
  if (item.table) parts.push(`Table:\n${tableText(item.table)}`);
  if ((item.passage ?? '').includes('__') || item.prompt.includes('__')) parts.push('(Text between double underscores, like __this__, is underlined in the question.)');
  parts.push(`Question:\n${item.prompt}`);
  const r = item.response;
  if (r.kind === 'mcq') parts.push(`Choices:\n${r.choices.map((c) => `${c.id}) ${c.text}`).join('\n')}`);
  else parts.push('This is a student-produced response question (the student types the answer).');
  parts.push(`Correct answer: ${correctAnswerText(item)}`);
  if (chosen !== undefined) parts.push(`Student's answer: ${studentAnswerText(item, chosen)}`);
  const e = item.explanation;
  parts.push(
    [
      'Reference explanation (trusted):',
      `Summary: ${e.answerSummary}`,
      `Steps:\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      `Check: ${e.check}`,
      `Takeaway: ${e.takeaway}`,
    ].join('\n'),
  );
  return parts.join('\n\n');
}

/** Judge-requested revision: the previous reply, the judge's issues and (when known) the key the reply must agree with. */
export interface ReviseRequest { previous: string; issues: string[]; keyAnswer?: string | null }

function reviseText(rev: ReviseRequest, shape: string): string {
  const lines = [
    'Your previous reply:',
    '"""',
    rev.previous.trim(),
    '"""',
    'A careful reviewer checked it and found these problems:',
    ...(rev.issues.length ? rev.issues : ['The reply was marked as wrong.']).map((i) => `- ${i}`),
  ];
  if (rev.keyAnswer != null && String(rev.keyAnswer).trim()) lines.push(`The correct answer is ${String(rev.keyAnswer).trim()}. Your corrected reply must agree with it.`);
  else lines.push('Re-check your work step by step. Change your answer only if the check shows it was wrong; if it was right, keep it and show the check clearly.');
  lines.push(`Fix every problem and write a corrected reply in the same JSON shape (${shape}).`);
  return lines.join('\n');
}

function toReply(r: ChatResult): CoachReply {
  const j = r.json as { text?: unknown; steps?: unknown; takeaway?: unknown } | undefined;
  const reply: CoachReply = { text: '', ms: r.ms, status: 'unverified' };
  if (j && typeof j === 'object' && typeof j.text === 'string' && j.text.trim()) {
    reply.text = j.text.trim();
    if (Array.isArray(j.steps)) {
      const steps = j.steps.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, 5);
      if (steps.length) reply.steps = steps;
    }
    if (typeof j.takeaway === 'string' && j.takeaway.trim()) reply.takeaway = j.takeaway.trim();
  } else {
    reply.text = r.text.trim();
  }
  return reply;
}

/** Merge consecutive same-role turns: several local chat templates (e.g. Gemma) require strict alternation. */
function alternate(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else out.push({ ...m });
  }
  return out;
}

/** "Explain it another way" for an item the student has already answered. Grounded in the item's key and explanation. */
export async function explainAnotherWay(p: ProviderConfig, item: Item, chosen?: ChoiceId | string | null, signal?: AbortSignal, revise?: ReviseRequest): Promise<CoachReply> {
  let user = `${groundingText(item, chosen ?? null)}\n\nExplain this question to the student another way, different from the reference explanation.`;
  if (revise) user += `\n\n${reviseText(revise, '"text", optional "steps", optional "takeaway"')}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(item, false) },
    { role: 'user', content: user },
  ];
  const r = await chat(p, messages, { jsonSchema: REPLY_SCHEMA, temperature: 0.3, maxTokens: 500, signal });
  return toReply(r);
}

/** Follow-up question anchored to the same item (max 6 student turns per thread, D-11). */
export async function followUp(p: ProviderConfig, item: Item, thread: CoachTurn[], question: string, signal?: AbortSignal, revise?: ReviseRequest): Promise<CoachReply> {
  const studentTurns = thread.filter((t) => t.role === 'student').length;
  if (studentTurns >= MAX_FOLLOW_UPS) throw new Error('Follow-up limit reached');
  const q = question.trim();
  if (!q) throw new Error('Type a question first');
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(item, true) },
    { role: 'user', content: `${groundingText(item)}\n\nI have a question about this SAT question.` },
  ];
  for (const t of thread) messages.push({ role: t.role === 'student' ? 'user' : 'assistant', content: t.text });
  messages.push({ role: 'user', content: revise ? `${q}\n\n${reviseText(revise, '"text", optional "steps", optional "takeaway"')}` : q });
  const r = await chat(p, alternate(messages), { jsonSchema: REPLY_SCHEMA, temperature: 0.3, maxTokens: 500, signal });
  return toReply(r);
}

// ---- Contract additions (bodies implemented by the coach-features module) ----
export const MAX_PASTED_CHARS = 6000;
const MISS_REASONS: MissReason[] = ['concept', 'misread', 'calculation', 'strategy', 'time', 'guessed', 'unsure'];
const MISS_REASON_HINTS: Record<MissReason, string> = {
  concept: "concept — didn't know or misunderstood the rule, idea or formula being tested",
  misread: 'misread — misread the question, the passage, a choice or what was asked',
  calculation: 'calculation — right method, but an arithmetic or algebra slip',
  strategy: 'strategy — knew the content but used a poor approach or did not check the choices',
  time: 'time — ran short on time or rushed',
  guessed: 'guessed — picked an answer without real reasoning',
  unsure: 'unsure — not enough evidence to tell',
};

const PASTED_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    skillId: { anyOf: [{ type: 'string', enum: SKILLS.map((s) => s.id) }, { type: 'null' }] },
    answer: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    text: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    check: { type: 'string' },
    takeaway: { type: 'string' },
  },
  required: ['skillId', 'answer', 'text', 'steps', 'check', 'takeaway'],
  additionalProperties: false,
};

const MISS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { reason: { type: 'string', enum: MISS_REASONS }, why: { type: 'string' } },
  required: ['reason', 'why'],
  additionalProperties: false,
};

function skillListText(): string {
  return SKILLS.map((s) => `${s.id} — ${s.officialName}`).join('\n');
}

function pastedSystemPrompt(followUp: boolean): string {
  const lines = [
    'You are a patient SAT tutor for students in grades 8–10.',
    'Use plain, everyday words and short sentences.',
    'The student pasted an SAT practice question as text. There is no official answer key here, so work carefully.',
    'Identify which SAT skill the question tests. Choose exactly one id from this list, or null if none fits or you are unsure:',
    skillListText(),
    'Solve the question. Give the answer as the choice letter if the question has lettered answer choices; otherwise give the value.',
    'Explain in 2–5 short steps.',
    'Give a check: for Reading and Writing, quote the exact words from the passage that support the answer; for Math, substitute the answer back into the question.',
    'End with a one-sentence takeaway the student can reuse.',
    'If information needed to solve it is missing (for example a figure, graph or table that was not included), say what is missing and set "answer" to null.',
    'Never invent facts that are not in the pasted text.',
    'Keep the explanation to 150 words or fewer.',
  ];
  if (followUp) {
    lines.push('The student is asking a follow-up question about this same pasted SAT question. Stay on this question. If the student asks about something unrelated, say briefly that you can only help with this question.');
    lines.push('Reply as JSON: "text" (your answer), optional "steps" (at most 5 short steps), optional "takeaway" (one sentence to remember).');
  } else {
    lines.push('Reply as JSON: "skillId" (an id from the list, or null), "answer" (letter or value, or null), "text" (short explanation), "steps" (2–5 short steps), "check", "takeaway".');
  }
  return lines.join('\n');
}

function cleanPasted(text: string): string {
  const t = (text ?? '').trim();
  if (!t) throw new Error('Paste a question first');
  if (t.length > MAX_PASTED_CHARS) throw new Error(`That is too long (${t.length} characters). Paste at most ${MAX_PASTED_CHARS} characters — one question at a time.`);
  return t;
}

function pastedUserText(text: string, studentAnswer?: string): string {
  const parts = [`Pasted SAT question:\n"""\n${text}\n"""`];
  const a = (studentAnswer ?? '').trim();
  if (a) parts.push(`The student's answer: ${a.slice(0, 200)}`);
  return parts.join('\n\n');
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function toPastedReply(r: ChatResult): PastedQuestionReply {
  const j = r.json as Record<string, unknown> | undefined;
  const reply: PastedQuestionReply = { skillId: null, answer: null, text: '', steps: [], ms: r.ms, status: 'unverified' };
  if (j && typeof j === 'object' && str(j.text)) {
    const sid = str(j.skillId);
    reply.skillId = sid && SKILL_BY_ID[sid] ? sid : null;
    const ans = str(j.answer);
    reply.answer = ans && !/^(null|none|n\/a|unknown)$/i.test(ans) ? ans : null;
    reply.text = str(j.text)!;
    if (Array.isArray(j.steps)) reply.steps = j.steps.map(str).filter((s): s is string => !!s).slice(0, 5);
    const check = str(j.check);
    if (check) reply.check = check;
    const takeaway = str(j.takeaway);
    if (takeaway) reply.takeaway = takeaway;
  } else {
    reply.text = r.text.trim();
  }
  return reply;
}

/** Ask about any SAT question the student pastes (text). Classifies the skill and proposes an answer — provisional. */
export async function askAboutQuestion(p: ProviderConfig, text: string, studentAnswer?: string, signal?: AbortSignal, revise?: ReviseRequest): Promise<PastedQuestionReply> {
  const t = cleanPasted(text);
  let user = `${pastedUserText(t, studentAnswer)}\n\nIdentify the skill, solve the question and explain it.`;
  if (revise) user += `\n\n${reviseText(revise, '"skillId", "answer", "text", "steps", "check", "takeaway"')}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: pastedSystemPrompt(false) },
    { role: 'user', content: user },
  ];
  const r = await chat(p, messages, { jsonSchema: PASTED_SCHEMA, temperature: 0.2, maxTokens: 700, signal });
  return toPastedReply(r);
}

/** Follow-up about a pasted question (max MAX_FOLLOW_UPS student turns). */
export async function followUpPasted(p: ProviderConfig, text: string, thread: CoachTurn[], question: string, signal?: AbortSignal): Promise<CoachReply> {
  const studentTurns = thread.filter((t) => t.role === 'student').length;
  if (studentTurns >= MAX_FOLLOW_UPS) throw new Error('Follow-up limit reached');
  const q = (question ?? '').trim();
  if (!q) throw new Error('Type a question first');
  const t = cleanPasted(text);
  const messages: ChatMessage[] = [
    { role: 'system', content: pastedSystemPrompt(true) },
    { role: 'user', content: `${pastedUserText(t)}\n\nI have a question about this SAT question.` },
  ];
  for (const turn of thread) messages.push({ role: turn.role === 'student' ? 'user' : 'assistant', content: turn.text });
  messages.push({ role: 'user', content: q });
  const r = await chat(p, alternate(messages), { jsonSchema: REPLY_SCHEMA, temperature: 0.3, maxTokens: 500, signal });
  return toReply(r);
}

function timeText(activeMs?: number): string {
  if (activeMs == null || !Number.isFinite(activeMs) || activeMs < 0) return 'Time spent: not recorded.';
  const s = Math.round(activeMs / 1000);
  return `Time spent on this question: ${s < 60 ? `${s} seconds` : `${Math.floor(s / 60)} min ${s % 60} s`}.`;
}

/** A hypothesis for why a question was missed; the student accepts or ignores it (FR-05). */
export async function suggestMissReason(p: ProviderConfig, item: Item, chosen: string | null, activeMs?: number, signal?: AbortSignal): Promise<MissSuggestion> {
  const system = [
    'You are a patient SAT tutor for students in grades 8–10, helping a student reflect on a question they missed.',
    'Pick the single most likely reason for the miss from this list:',
    ...MISS_REASONS.map((r) => `- ${MISS_REASON_HINTS[r]}`),
    'Base it only on the evidence given: the question, the student\'s answer, the reference notes about that choice, and the time spent. A very short time with an unrelated answer suggests guessed or time; no answer at all suggests time or unsure.',
    'Write "why" as one short sentence addressed to the student ("you"), hedged, starting with "Possibly".',
    'Do not change or question the correct answer. Never invent facts.',
    'Reply as JSON: "reason" (one value from the list) and "why".',
  ].join('\n');
  const user = `${groundingText(item, chosen)}\n\n${timeText(activeMs)}\n\nWhat is the most likely reason the student missed this question?`;
  const r = await chat(p, [{ role: 'system', content: system }, { role: 'user', content: user }], { jsonSchema: MISS_SCHEMA, temperature: 0.2, maxTokens: 200, signal });
  const j = r.json as { reason?: unknown; why?: unknown } | undefined;
  const raw = typeof j?.reason === 'string' ? j.reason.trim().toLowerCase() : '';
  const reason: MissReason = (MISS_REASONS as string[]).includes(raw) ? (raw as MissReason) : 'unsure';
  let why = str(j?.why) ?? (j ? '' : r.text.trim());
  if (!why) why = 'Possibly — the model did not give a clear reason.';
  if (why.length > 300) why = `${why.slice(0, 297)}…`;
  return { reason, why, ms: r.ms };
}
