import type { Item, Lesson, TestSpec, OfficialForm, SectionId } from '../domain/types';
import { RW_ITEMS } from './items.rw';
import { MATH_ITEMS } from './items.math';
import { RW_LESSONS } from './lessons.rw';
import { MATH_LESSONS } from './lessons.math';
import { SKILLS, DOMAINS } from './ontology';

export * from './ontology';

export const ITEMS: Item[] = [...RW_ITEMS, ...MATH_ITEMS];
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const LESSONS: Lesson[] = [...RW_LESSONS, ...MATH_LESSONS];
export const LESSON_BY_SKILL: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.skillId, l]));

export function itemsForSkill(skillId: string): Item[] {
  return ITEMS.filter((i) => i.skillId === skillId);
}

// Original quick diagnostic: the first item of every skill in each section, ordered by domain then
// difficulty; timed at digital-SAT pace (~71 s per R&W item, ~95 s per Math item).
function diagnosticModule(section: SectionId, title: string, secPerItem: number) {
  const ids: string[] = [];
  for (const d of DOMAINS.filter((x) => x.section === section)) {
    for (const s of SKILLS.filter((k) => k.domainId === d.id)) {
      const first = ITEMS.find((i) => i.skillId === s.id);
      if (first) ids.push(first.id);
    }
  }
  return { id: `diag.${section}`, section, title, itemIds: ids, durationSec: Math.max(60, Math.round(ids.length * secPerItem)) };
}

export const TESTS: TestSpec[] = [
  {
    id: 'orig.diagnostic.1',
    title: 'Quick diagnostic',
    mode: 'diagnostic',
    label: 'Original questions · no scaled score',
    description: 'One question per skill across all eight domains, timed at digital-SAT pace. Shows where to start; it is not a score prediction.',
    modules: [
      diagnosticModule('rw', 'Reading and Writing', 71),
      diagnosticModule('math', 'Math', 95),
    ],
    breakAfterModuleIndex: 0,
  },
];
export const TEST_BY_ID: Record<string, TestSpec> = Object.fromEntries(TESTS.map((t) => [t.id, t]));

// Official College Board paper forms (metadata only). Content needs local import in the desktop app.
export const OFFICIAL_FORMS: OfficialForm[] = [4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({
  number: n,
  title: `Official Practice Test ${n} (paper, nonadaptive)`,
  imported: false,
}));
