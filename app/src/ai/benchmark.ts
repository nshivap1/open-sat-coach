import type { Item } from '../domain/types';
import type { BenchmarkResult, BenchmarkRow, ChatMessage, ProviderConfig } from './types';
import { gradeItem } from '../domain/grading';
import { SKILLS } from '../content/index';
import { chat, ensureRunning } from './client';

const MCQ_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] } },
  required: ['answer'],
  additionalProperties: false,
};
const SPR_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
  additionalProperties: false,
};
const SPR_RULES =
  'Enter the answer the way the SAT requires for student-produced responses: a number, decimal, or fraction like 3/2; no spaces, units, commas, percent or dollar signs; no mixed numbers; at most 5 characters (6 for a negative answer, including the minus sign).';

/** Nearest-rank percentile; `p` is in 0–100. Returns 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const rank = Math.ceil((Math.min(100, Math.max(0, p)) / 100) * v.length);
  return v[Math.min(v.length, Math.max(1, rank)) - 1];
}

function isAbort(e: unknown, signal?: AbortSignal): boolean {
  return !!signal?.aborted || (e instanceof Error && e.name === 'AbortError');
}

function questionText(item: Item): string {
  const parts: string[] = [];
  if (item.passage) parts.push(item.passage2 ? `Text 1:\n${item.passage}` : `Passage:\n${item.passage}`);
  if (item.passage2) parts.push(`Text 2:\n${item.passage2}`);
  if (item.table) {
    const t = item.table;
    parts.push(`Table:\n${[t.caption ?? '', t.headers.join(' | '), ...t.rows.map((r) => r.join(' | '))].filter(Boolean).join('\n')}`);
  }
  parts.push(`Question:\n${item.prompt}`);
  if (item.response.kind === 'mcq') parts.push(`Choices:\n${item.response.choices.map((c) => `${c.id}) ${c.text}`).join('\n')}`);
  return parts.join('\n\n');
}

function expectedText(item: Item): string {
  return item.response.kind === 'mcq' ? item.response.answer : item.response.accepted.join(' or ');
}

/** Extracts a gradable answer; null when missing, unparseable or not a valid SAT entry. */
function extractAnswer(item: Item, json: unknown): { answer: string | null; error?: string } {
  const a = (json as { answer?: unknown } | undefined)?.answer;
  const raw = typeof a === 'string' ? a.trim() : typeof a === 'number' && Number.isFinite(a) ? String(a) : '';
  if (!raw) return { answer: null, error: 'No answer could be read from the reply' };
  if (item.response.kind === 'mcq') {
    const id = raw.toUpperCase().replace(/^\(?([A-D])\)?\.?$/, '$1');
    return /^[A-D]$/.test(id) ? { answer: id } : { answer: null, error: `Not a valid choice: ${raw.slice(0, 20)}` };
  }
  const g = gradeItem(item, raw);
  if (g.outcome === 'invalid_format' || g.outcome === 'omitted') return { answer: null, error: `Invalid entry "${raw.slice(0, 20)}": ${g.formatMessage ?? 'empty'}` };
  return { answer: raw };
}

export async function runBenchmark(p: ProviderConfig, items: Item[], opts: { limit?: number; classify?: boolean; signal?: AbortSignal; onProgress?(done: number, total: number): void; device?: string } = {}): Promise<BenchmarkResult> {
  const { signal } = opts;
  const list = opts.limit != null && opts.limit >= 0 ? items.slice(0, opts.limit) : items.slice();
  const provider = await ensureRunning(p);
  const skillIds = SKILLS.map((s) => s.id);
  const skillList = SKILLS.map((s) => `${s.id} — ${s.officialName}`).join('\n');
  const classifySchema: Record<string, unknown> = {
    type: 'object',
    properties: { skillId: { type: 'string', enum: skillIds } },
    required: ['skillId'],
    additionalProperties: false,
  };

  const rows: BenchmarkRow[] = [];
  let classified = 0;
  let classifiedRight = 0;

  for (const item of list) {
    if (signal?.aborted) break;
    const mcq = item.response.kind === 'mcq';
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are answering an SAT practice question. Think carefully, then reply with only the JSON object requested.' },
      {
        role: 'user',
        content: `${questionText(item)}\n\n${mcq ? 'Reply as JSON with the letter of the correct choice: {"answer": "A"}.' : `${SPR_RULES}\nReply as JSON: {"answer": "<your entry>"}.`}`,
      },
    ];
    const row: BenchmarkRow = { itemId: item.id, skillId: item.skillId, expected: expectedText(item), answer: null, correct: false, ms: 0 };
    try {
      const r = await chat(provider, messages, { jsonSchema: mcq ? MCQ_SCHEMA : SPR_SCHEMA, temperature: 0, maxTokens: 256, signal });
      row.ms = r.ms;
      const ex = extractAnswer(item, r.json);
      row.answer = ex.answer;
      if (ex.error) row.error = ex.error;
      if (ex.answer !== null) row.correct = gradeItem(item, ex.answer).outcome === 'correct';
    } catch (e) {
      if (isAbort(e, signal)) break;
      row.error = e instanceof Error ? e.message : String(e);
    }

    if (opts.classify && !signal?.aborted) {
      classified++;
      try {
        const r = await chat(
          provider,
          [
            { role: 'system', content: 'You classify SAT questions by the official skill they test. Reply with only the JSON object requested.' },
            { role: 'user', content: `Skills (id — official name):\n${skillList}\n\n${questionText(item)}\n\nWhich skill does this question test? Reply as JSON: {"skillId": "<id>"}.` },
          ],
          { jsonSchema: classifySchema, temperature: 0, maxTokens: 64, signal },
        );
        const sid = (r.json as { skillId?: unknown } | undefined)?.skillId;
        if (typeof sid === 'string' && skillIds.includes(sid.trim())) {
          row.predictedSkillId = sid.trim();
          if (row.predictedSkillId === item.skillId) classifiedRight++;
        }
      } catch (e) {
        if (isAbort(e, signal)) {
          classified--;
          rows.push(row);
          break;
        }
      }
    }

    rows.push(row);
    opts.onProgress?.(rows.length, list.length);
  }

  const answered = rows.filter((r) => r.answer !== null).length;
  const correct = rows.filter((r) => r.correct).length;
  const latencies = rows.map((r) => r.ms).filter((ms) => ms > 0) // calls that got a reply;
  const result: BenchmarkResult = {
    at: Date.now(),
    providerLabel: p.label,
    items: rows.length,
    answered,
    correct,
    accuracy: answered ? correct / answered : 0,
    coverage: rows.length ? answered / rows.length : 0,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    rows,
  };
  if (opts.classify) result.classifyAccuracy = classified ? classifiedRight / classified : 0;
  if (opts.device) result.device = opts.device;
  return result;
}
