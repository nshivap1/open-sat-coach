import type { FormRole } from './types';

// Official paper practice tests 4–11 are the same tests as Bluebook adaptive practice tests 4–11.
// Each form can be fresh only once, so every form gets exactly one role.
export const DEFAULT_FORMS: number[] = [4, 5, 6, 7, 8, 9, 10, 11];

export const FORM_ROLES: FormRole[] = ['unassigned', 'taken_in_bluebook', 'save_for_bluebook', 'in_app_diagnostic', 'practice_pool'];

/**
 * Propose a role for every form. Taken forms are "probably seen". Of the unexposed forms (highest
 * numbers first): 2 are saved for Bluebook, 1 is an in-app diagnostic, and when 6 or more were
 * unexposed one more becomes a final-check diagnostic. The rest go to the practice pool.
 */
export function proposeFormBudget(takenInBluebook: number[], forms: number[] = DEFAULT_FORMS): Record<number, FormRole> {
  const taken = new Set(takenInBluebook);
  const out: Record<number, FormRole> = {};
  const fresh: number[] = [];
  for (const f of forms) {
    if (taken.has(f)) out[f] = 'taken_in_bluebook';
    else fresh.push(f);
  }
  fresh.sort((a, b) => b - a);
  const diagnostics = fresh.length >= 6 ? 2 : 1;
  fresh.forEach((f, i) => {
    if (i < 2) out[f] = 'save_for_bluebook';
    else if (i < 2 + diagnostics) out[f] = 'in_app_diagnostic';
    else out[f] = 'practice_pool';
  });
  return out;
}

const DAY_MS = 86_400_000;

function parseDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return Math.round(t / DAY_MS);
}

function localDay(now: number): number {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

function formatDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Evenly spaced YYYY-MM-DD dates from about one week from now to 7 days before the target date
 * (both ends included; a single date lands 7 days before the target). Returns [] when there is no
 * valid target, count < 1, or not enough days to give each test its own date.
 */
export function suggestBluebookDates(targetDate: string | undefined, count: number, now: number): string[] {
  if (!targetDate || !Number.isFinite(count) || count < 1) return [];
  const target = parseDay(targetDate);
  if (target === null) return [];
  const start = localDay(now) + 7;
  const end = target - 7;
  const n = Math.floor(count);
  if (end < start || end - start < n - 1) return [];
  if (n === 1) return [formatDay(end)];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => formatDay(start + Math.round(i * step)));
}

export function roleLabel(role: FormRole): string {
  switch (role) {
    case 'taken_in_bluebook': return 'Taken in Bluebook';
    case 'save_for_bluebook': return 'Save for Bluebook';
    case 'in_app_diagnostic': return 'In-app diagnostic';
    case 'practice_pool': return 'Practice pool';
    default: return 'Not assigned';
  }
}

export function roleHelp(role: FormRole): string {
  switch (role) {
    case 'taken_in_bluebook': return 'You already took this test in Bluebook, so treat its questions as probably seen.';
    case 'save_for_bluebook': return 'Keep this test untouched and take it in Bluebook for an official adaptive practice score.';
    case 'in_app_diagnostic': return 'Take this paper form once in the app as a fresh, timed check of where you stand.';
    case 'practice_pool': return 'Use these questions for skill practice, since this form will not be a fresh full test.';
    default: return 'Choose how you want to use this test before you look at any of its questions.';
  }
}
