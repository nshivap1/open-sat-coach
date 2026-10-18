import type { Attempt, GradedResponse, Item, Outcome } from './types';

const NUM_RE = /^-?(\d+(\.\d*)?|\.\d+|\d+\/\d+)$/;

/** Returns a student-facing message if `raw` breaks SAT student-produced-response entry rules, else null. Empty → null. */
export function validateSprFormat(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return null;
  if (/\s/.test(s)) return 'Remove spaces. Mixed numbers like 1 1/2 are not allowed — enter 3/2 or 1.5.';
  if (s.includes('%')) return 'Do not enter a percent sign.';
  if (s.includes('$')) return 'Do not enter a dollar sign.';
  if (s.includes(',')) return 'Do not use commas.';
  if (/[^0-9./-]/.test(s)) return 'Use only digits, a decimal point, a fraction bar (/), and a leading minus sign.';
  if ((s.match(/\./g) ?? []).length > 1) return 'Use at most one decimal point.';
  if ((s.match(/\//g) ?? []).length > 1) return 'Use at most one fraction bar (/).';
  if (s.lastIndexOf('-') > 0) return 'A minus sign may appear only at the start.';
  const neg = s.startsWith('-');
  if (!neg && s.length > 5) return 'Positive answers can be at most 5 characters.';
  if (neg && s.length > 6) return 'Negative answers can be at most 6 characters, including the minus sign.';
  if (s.includes('/') && s.includes('.')) return 'Do not put a decimal point inside a fraction.';
  if (!NUM_RE.test(s)) return 'Enter a number, a decimal, or a fraction like 3/2.';
  if (s.includes('/') && Number(s.split('/')[1]) === 0) return 'A fraction cannot have a denominator of 0.';
  return null;
}

function parseFraction(s: string): [number, number] | null {
  const m = /^(-?)(\d+)\/(\d+)$/.exec(s.trim());
  if (!m) return null;
  const den = Number(m[3]);
  if (den === 0) return null;
  return [(m[1] ? -1 : 1) * Number(m[2]), den];
}

export function gradeItem(item: Item, raw: string | null): { outcome: Outcome; formatMessage?: string } {
  if (raw == null || raw.trim() === '') return { outcome: 'omitted' };
  const r = item.response;
  if (r.kind === 'mcq') return { outcome: raw.trim().toUpperCase() === r.answer ? 'correct' : 'incorrect' };
  const msg = validateSprFormat(raw);
  if (msg) return { outcome: 'invalid_format', formatMessage: msg };
  const s = raw.trim();
  if (r.accepted.some((a) => a.trim() === s)) return { outcome: 'correct' };
  const f = parseFraction(s);
  if (f) {
    for (const a of r.accepted) {
      const g = parseFraction(a);
      if (g && f[0] * g[1] === g[0] * f[1]) return { outcome: 'correct' };
    }
  }
  return { outcome: 'incorrect' };
}

export function gradeAttempt(attempt: Attempt, itemById: Record<string, Item>): GradedResponse[] {
  const out: GradedResponse[] = [];
  attempt.testSnapshot.modules.forEach((spec, mi) => {
    const responses = attempt.modules[mi]?.responses ?? {};
    for (const id of spec.itemIds) {
      const item = itemById[id];
      if (!item) continue;
      const rec = responses[id];
      const g = gradeItem(item, rec?.raw ?? null);
      const gr: GradedResponse = {
        itemId: id,
        skillId: item.skillId,
        outcome: g.outcome,
        assisted: !!rec && (rec.hintLevel > 0 || rec.explanationSeen),
      };
      if (g.formatMessage) gr.formatMessage = g.formatMessage;
      out.push(gr);
    }
  });
  return out;
}
