// FR-10: Gemma writes original practice items for a skill. Every candidate must pass four gates
// (write → structure/dedupe → independent solve → uniqueness → AI judge) before it is returned. Rejected
// candidates are never returned or shown. Generated items never count toward skill estimates.
import type { ChoiceId, Difficulty, Explanation, Item, SectionId, Skill } from '../domain/types';
import type { ChatMessage, GenerationProgress, ProviderConfig } from './types';
import { DOMAIN_BY_ID, SKILL_BY_ID } from '../content/ontology';
import { ITEMS } from '../content/index';
import { chat } from './client';
import { judgeExplanation, sameProvider } from './judge';

const LETTERS: ChoiceId[] = ['A', 'B', 'C', 'D'];
export const MAX_ATTEMPTS_PER_ITEM = 3; // 1 write + 2 repairs
const DUP_OVERLAP = 0.8;

interface Draft {
  passage?: string;
  prompt: string;
  choices: Record<ChoiceId, string>;
  answer: ChoiceId;
  explanation: { answerSummary: string; steps: string[]; check: string; whyWrong?: Partial<Record<ChoiceId, string>>; takeaway: string };
  hints: string[];
}

type GateResult = { ok: true } | { ok: false; reason: string; repair: string };

// ---------- text helpers ----------
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter(Boolean));
}
/** Share of tokens in common, relative to the smaller text (so a near-copy with a few extra words still matches). */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ---------- schemas ----------
function writeSchema(section: SectionId): Record<string, unknown> {
  const s = { type: 'string' };
  const props: Record<string, unknown> = {
    prompt: s,
    choices: { type: 'object', properties: { A: s, B: s, C: s, D: s }, required: ['A', 'B', 'C', 'D'] },
    answer: { type: 'string', enum: LETTERS },
    explanation: {
      type: 'object',
      properties: {
        answerSummary: s,
        steps: { type: 'array', items: s },
        check: s,
        whyWrong: { type: 'object', properties: { A: s, B: s, C: s, D: s } },
        takeaway: s,
      },
      required: ['answerSummary', 'steps', 'check', 'whyWrong', 'takeaway'],
    },
    hints: { type: 'array', items: s, minItems: 3, maxItems: 3 },
  };
  const required = ['prompt', 'choices', 'answer', 'explanation', 'hints'];
  if (section === 'rw') {
    return { type: 'object', properties: { passage: s, ...props }, required: ['passage', ...required] };
  }
  return { type: 'object', properties: props, required };
}
const SOLVE_SCHEMA = { type: 'object', properties: { answer: { type: 'string', enum: LETTERS } }, required: ['answer'] };
const UNIQUE_SCHEMA = {
  type: 'object',
  properties: { exactlyOne: { type: 'boolean' }, alternative: { type: ['string', 'null'] } },
  required: ['exactlyOne', 'alternative'],
};

// ---------- prompts ----------
function exampleFor(skillId: string, difficulty: Difficulty): Item | undefined {
  const pool = ITEMS.filter((i) => i.skillId === skillId && i.origin === 'original');
  return pool.find((i) => i.response.kind === 'mcq' && i.difficulty === difficulty)
    ?? pool.find((i) => i.response.kind === 'mcq')
    ?? pool[0];
}

function renderExample(it: Item): string {
  const lines: string[] = [];
  if (it.passage) lines.push(`Passage: ${it.passage}`);
  if (it.passage2) lines.push(`Text 2: ${it.passage2}`);
  lines.push(`Question: ${it.prompt}`);
  if (it.response.kind === 'mcq') {
    for (const c of it.response.choices) lines.push(`${c.id}) ${c.text}`);
    lines.push(`Answer: ${it.response.answer}`);
  } else {
    lines.push(`Answer: ${it.response.accepted[0]}`);
  }
  return lines.join('\n');
}

function systemPrompt(skill: Skill, section: SectionId, difficulty: Difficulty): string {
  const domain = DOMAIN_BY_ID[skill.domainId];
  const format = section === 'rw'
    ? [
      'Digital SAT Reading and Writing format: one short ORIGINAL passage of 25–150 words, then one question, then four answer choices A–D.',
      'Use only fictional people, places, works, and studies (invented names). Never quote or adapt real published texts.',
    ]
    : [
      'Digital SAT Math format: one self-contained multiple-choice problem with four answer choices A–D.',
      'No figures, graphs, or images — everything needed must be in the text. Write math with Unicode (x², √, π, ≤, ·), not LaTeX.',
    ];
  return [
    'You write ORIGINAL practice questions for students preparing for the digital SAT. Your questions are practice material, not official College Board questions.',
    `Skill: ${skill.officialName} (domain: ${domain?.name ?? skill.domainId}).`,
    `What this tests: ${skill.tests}`,
    `Question types: ${skill.types.map((t) => `${t.name} — ${t.definition}`).join('; ')}`,
    `How students recognize it: ${skill.cues.join('; ')}`,
    `Common mistakes: ${skill.commonMistakes.join('; ')}`,
    ...format,
    `Target difficulty: ${difficulty}.`,
    'Rules:',
    '- Exactly one answer choice is unambiguously the best answer; a careful expert must agree.',
    '- The three wrong choices are plausible and each one reflects a real student mistake listed above.',
    '- The four choices are different from each other. Never use "all of the above", "none of the above", or "both A and B".',
    '- explanation: answerSummary (one line naming the answer and the core reason), 2–5 short steps, check (R&W: quote the passage or name the rule; Math: verify the result), whyWrong for each wrong letter, and a reusable takeaway.',
    '- hints: exactly 3, in order: (1) name the skill/what is being asked, (2) the next action to take, (3) a partial step. Do not reveal the answer letter in hints.',
    '- Plain language for students in grades 8–12.',
  ].join('\n');
}

function userPrompt(skill: Skill, example: Item | undefined, repairs: string[]): string {
  const parts: string[] = [];
  if (example) {
    parts.push(
      'Here is one existing original question for this skill, ONLY as a guide to style, length, and difficulty. Do not copy or paraphrase it; use a completely different topic, names, and wording.',
      '---',
      renderExample(example),
      '---',
    );
  }
  parts.push(`Write one new question for the skill "${skill.officialName}".`);
  if (repairs.length) {
    parts.push('Your previous attempt was rejected:', ...repairs.map((r) => `- ${r}`), 'Write a corrected, new question that fixes these problems.');
  }
  return parts.join('\n');
}

function questionText(d: Pick<Draft, 'passage' | 'prompt' | 'choices'>): string {
  const lines: string[] = [];
  if (d.passage) lines.push(`Passage: ${d.passage}`, '');
  lines.push(`Question: ${d.prompt}`);
  for (const l of LETTERS) lines.push(`${l}) ${d.choices[l]}`);
  return lines.join('\n');
}

// ---------- parsing + gates ----------
function parseDraft(json: unknown, section: SectionId): Draft | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, any>;
  const choicesRaw = j.choices && typeof j.choices === 'object' ? j.choices : {};
  const choices = Object.fromEntries(LETTERS.map((l) => [l, str(choicesRaw[l])])) as Record<ChoiceId, string>;
  const ex = j.explanation && typeof j.explanation === 'object' ? j.explanation : {};
  const whyRaw = ex.whyWrong && typeof ex.whyWrong === 'object' ? ex.whyWrong : {};
  const whyWrong: Partial<Record<ChoiceId, string>> = {};
  for (const l of LETTERS) if (str(whyRaw[l])) whyWrong[l] = str(whyRaw[l]);
  let passage = str(j.passage) || undefined;
  let prompt = str(j.prompt);
  if (section === 'math' && passage) { prompt = `${passage}\n\n${prompt}`; passage = undefined; }
  return {
    passage,
    prompt,
    choices,
    answer: str(j.answer).toUpperCase() as ChoiceId,
    explanation: {
      answerSummary: str(ex.answerSummary),
      steps: Array.isArray(ex.steps) ? ex.steps.map(str).filter(Boolean) : [],
      check: str(ex.check),
      whyWrong,
      takeaway: str(ex.takeaway),
    },
    hints: Array.isArray(j.hints) ? j.hints.map(str).filter(Boolean) : [],
  };
}

const BANNED_CHOICE = /\b(all|none|neither) of the (above|choices|options)\b|\bboth [a-d] and [a-d]\b/i;

/** STRUCTURE gate + dedupe against the existing bank (curated and previously generated items). */
export function structureGate(d: Draft, section: SectionId, bank: Item[] = ITEMS): GateResult {
  const fail = (reason: string, repair: string): GateResult => ({ ok: false, reason, repair });
  if (!d.prompt) return fail('empty question', 'The question text was empty.');
  const texts = LETTERS.map((l) => d.choices[l]);
  if (texts.some((t) => !t)) return fail('missing choice', 'Every choice A, B, C, and D must have text.');
  if (new Set(texts.map(normalizeText)).size !== 4) return fail('duplicate choices', 'Two answer choices were the same; all four must differ.');
  if (texts.some((t) => BANNED_CHOICE.test(t))) return fail('banned choice', 'Do not use "all of the above", "none of the above", or "both A and B".');
  if (!LETTERS.includes(d.answer)) return fail('bad answer key', 'The answer must be exactly one letter: A, B, C, or D.');
  if (section === 'rw') {
    if (!d.passage) return fail('missing passage', 'Reading and Writing questions need a short passage.');
    const n = wordCount(d.passage);
    if (n < 25 || n > 150) return fail(`passage ${n} words`, `The passage had ${n} words; it must be 25–150 words.`);
  }
  const e = d.explanation;
  if (!e.answerSummary || !e.steps.length || !e.takeaway) return fail('missing explanation', 'Include answerSummary, steps, and takeaway in the explanation.');
  if (d.hints.length < 3) return fail('missing hints', 'Include exactly three hints.');
  const stem = `${d.passage ?? ''} ${d.prompt}`;
  const stemNorm = normalizeText(stem);
  for (const it of bank) {
    const other = `${it.passage ?? ''} ${it.passage2 ?? ''} ${it.prompt}`;
    if (normalizeText(other) === stemNorm || tokenOverlap(stem, other) > DUP_OVERLAP
      || (d.passage && it.passage && (normalizeText(it.passage) === normalizeText(d.passage) || tokenOverlap(d.passage, it.passage) > DUP_OVERLAP))) {
      return fail(`duplicate of ${it.id}`, 'The question was too similar to an existing one. Use a completely different topic, names, and wording.');
    }
  }
  return { ok: true };
}

// ---------- item ----------
function buildItem(d: Draft, skill: Skill, section: SectionId, difficulty: Difficulty): Item {
  const whyWrong: Partial<Record<ChoiceId, string>> = {};
  for (const l of LETTERS) if (l !== d.answer && d.explanation.whyWrong?.[l]) whyWrong[l] = d.explanation.whyWrong[l];
  const explanation: Explanation = {
    answerSummary: d.explanation.answerSummary,
    steps: d.explanation.steps.slice(0, 6),
    check: d.explanation.check || d.explanation.answerSummary,
    takeaway: d.explanation.takeaway,
  };
  if (Object.keys(whyWrong).length) explanation.whyWrong = whyWrong;
  const item: Item = {
    id: `gen.${skill.id}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    version: 1,
    section,
    skillId: skill.id,
    typeId: skill.types[0]?.id ?? skill.id,
    origin: 'generated',
    difficulty,
    difficultySource: 'unknown',
    prompt: d.prompt,
    response: { kind: 'mcq', choices: LETTERS.map((l) => ({ id: l, text: d.choices[l] })), answer: d.answer },
    explanation,
    hints: [d.hints[0], d.hints[1], d.hints[2]],
    formatTags: ['mcq', 'generated'],
  };
  if (d.passage) item.passage = d.passage;
  return item;
}

function isAbort(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';
}

/** Gemma writes original practice items for a skill; each must pass validation gates (FR-10). Rejected candidates are never returned. */
export async function generatePracticeItems(p: ProviderConfig, skillId: string, count: number, opts?: { difficulty?: Difficulty; onProgress?(g: GenerationProgress): void; signal?: AbortSignal; judge?: ProviderConfig }): Promise<{ items: Item[]; rejected: number }> {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  const section: SectionId = DOMAIN_BY_ID[skill.domainId]?.section ?? (skill.domainId.startsWith('rw') ? 'rw' : 'math');
  const difficulty: Difficulty = opts?.difficulty ?? 'medium';
  const signal = opts?.signal;
  const report = (g: GenerationProgress) => { try { opts?.onProgress?.(g); } catch { /* UI callback errors never stop generation */ } };
  const example = exampleFor(skillId, difficulty);
  const judgeProvider = opts?.judge ?? p;
  const judgeSame = sameProvider(judgeProvider, p);
  const system = systemPrompt(skill, section, difficulty);
  const items: Item[] = [];
  let rejected = 0;
  let calls = 0;
  let errors = 0;
  let lastError: unknown = null;
  const total = Math.max(0, Math.floor(count));

  outer:
  for (let index = 1; index <= total; index++) {
    const repairs: string[] = [];
    let accepted: Item | null = null;
    let lastReason = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ITEM; attempt++) {
      if (signal?.aborted) break outer;
      try {
        // (1) WRITE
        report({ index, total, stage: 'writing', note: attempt > 1 ? `Fixing: ${lastReason}` : undefined });
        const messages: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: userPrompt(skill, example, repairs) }];
        calls++;
        const w = await chat(p, messages, { jsonSchema: writeSchema(section), temperature: 0.8, maxTokens: 1800, signal });
        const draft = parseDraft(w.json, section);
        if (!draft) { lastReason = 'unreadable output'; repairs.splice(0, repairs.length, 'Your reply was not valid JSON matching the schema.'); continue; }
        // (2) STRUCTURE + dedupe (against the bank and items accepted in this run)
        const s = structureGate(draft, section, [...ITEMS, ...items]);
        if (!s.ok) { lastReason = s.reason; repairs.splice(0, repairs.length, s.repair); continue; }
        report({ index, total, stage: 'checking' });
        // (3) SOLVE: independent pass with no key or explanation.
        calls++;
        const solve = await chat(p, [
          { role: 'system', content: 'You are a careful student taking a digital SAT practice question. Work it out and choose the single best answer.' },
          { role: 'user', content: `${questionText(draft)}\n\nReply with the letter of the best answer.` },
        ], { jsonSchema: SOLVE_SCHEMA, temperature: 0, maxTokens: 64, signal });
        const solved = str((solve.json as { answer?: unknown } | undefined)?.answer).toUpperCase();
        if (solved !== draft.answer) {
          lastReason = solved ? `independent check chose ${solved}, key says ${draft.answer}` : 'independent check gave no answer';
          repairs.splice(0, repairs.length, solved
            ? `An independent solver chose ${solved}, but your key said ${draft.answer}. Either the key was wrong or the question was ambiguous. Make exactly one choice clearly correct.`
            : 'An independent solver could not pick an answer. Make the question clearer.');
          continue;
        }
        // (4) UNIQUENESS
        calls++;
        const uq = await chat(p, [
          { role: 'system', content: 'You are a strict reviewer of SAT-style practice questions.' },
          { role: 'user', content: `${questionText(draft)}\n\nIntended answer: ${draft.answer}.\nIs exactly one choice defensibly correct? Answer yes/no and name any other defensible letter.` },
        ], { jsonSchema: UNIQUE_SCHEMA, temperature: 0, maxTokens: 128, signal });
        const u = (uq.json ?? {}) as { exactlyOne?: unknown; alternative?: unknown };
        if (u.exactlyOne !== true) {
          const alt = str(u.alternative).toUpperCase();
          lastReason = alt ? `${alt} may also be correct` : 'more than one choice may be correct';
          repairs.splice(0, repairs.length, `A reviewer found that ${alt ? `choice ${alt}` : 'another choice'} could also be defended as correct. Make exactly one choice correct.`);
          continue;
        }
        // (5) JUDGE: a skeptical pass over the candidate's own explanation, with its key.
        report({ index, total, stage: 'checking', note: 'AI judge reviewing the explanation' });
        calls++;
        const ex = draft.explanation;
        const whyWrong = LETTERS.filter((l) => l !== draft.answer && ex.whyWrong?.[l]).map((l) => `Why ${l} is wrong: ${ex.whyWrong![l]}`);
        const jv = await judgeExplanation(judgeProvider, {
          questionText: questionText(draft),
          keyAnswer: draft.answer,
          explanation: { text: ex.answerSummary, steps: [...ex.steps, ...whyWrong], check: ex.check, takeaway: ex.takeaway },
        }, { signal, sameModel: judgeSame, judgeLabel: judgeSame ? 'Same model · second pass' : `${judgeProvider.label} · separate judge` });
        if (jv.verdict !== 'pass') {
          lastReason = `judge: ${jv.issues[0] ?? jv.verdict}`;
          repairs.splice(0, repairs.length, jv.issues.length
            ? `An AI judge reviewing your explanation found these problems: ${jv.issues.join(' ')} Make the question, key, and explanation correct and fully supported.`
            : 'An AI judge could not confirm your explanation. Make every step clearly correct and supported by the question.');
          continue;
        }
        accepted = buildItem(draft, skill, section, difficulty);
        break;
      } catch (e) {
        if (isAbort(e) || signal?.aborted) break outer;
        errors++;
        lastError = e;
        lastReason = e instanceof Error ? e.message : String(e);
      }
    }
    if (accepted) {
      items.push(accepted);
      report({ index, total, stage: 'accepted' });
    } else {
      rejected++;
      report({ index, total, stage: 'rejected', note: lastReason || undefined });
    }
  }
  // Every call failed (server down, model missing): surface the error instead of "0 passed".
  if (!items.length && lastError && errors >= calls) throw lastError;
  return { items, rejected };
}
