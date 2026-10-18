import type { Item, ChoiceId } from '../domain/types';
import type { ChatMessage, ChatResult, CoachReply, CoachTurn, ProviderConfig } from './types';
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
export async function explainAnotherWay(p: ProviderConfig, item: Item, chosen?: ChoiceId | string | null, signal?: AbortSignal): Promise<CoachReply> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(item, false) },
    { role: 'user', content: `${groundingText(item, chosen ?? null)}\n\nExplain this question to the student another way, different from the reference explanation.` },
  ];
  const r = await chat(p, messages, { jsonSchema: REPLY_SCHEMA, temperature: 0.3, maxTokens: 500, signal });
  return toReply(r);
}

/** Follow-up question anchored to the same item (max 6 student turns per thread, D-11). */
export async function followUp(p: ProviderConfig, item: Item, thread: CoachTurn[], question: string, signal?: AbortSignal): Promise<CoachReply> {
  const studentTurns = thread.filter((t) => t.role === 'student').length;
  if (studentTurns >= MAX_FOLLOW_UPS) throw new Error('Follow-up limit reached');
  const q = question.trim();
  if (!q) throw new Error('Type a question first');
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(item, true) },
    { role: 'user', content: `${groundingText(item)}\n\nI have a question about this SAT question.` },
  ];
  for (const t of thread) messages.push({ role: t.role === 'student' ? 'user' : 'assistant', content: t.text });
  messages.push({ role: 'user', content: q });
  const r = await chat(p, alternate(messages), { jsonSchema: REPLY_SCHEMA, temperature: 0.3, maxTokens: 500, signal });
  return toReply(r);
}
