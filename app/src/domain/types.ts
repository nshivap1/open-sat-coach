// Shared contract for every module. Change only by agreement: other files depend on these shapes.

export type SectionId = 'rw' | 'math';
export type ChoiceId = 'A' | 'B' | 'C' | 'D';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultySource = 'official' | 'expert_estimate' | 'empirical' | 'unknown';
export type ItemOrigin = 'original' | 'generated' | 'official_paper' | 'official_qb';

// ---------- Ontology ----------
export interface Domain {
  id: string;            // e.g. 'rw.ii'
  section: SectionId;
  name: string;          // official name
  share: number;         // approx share of its section (0..1), used for map tile size
}

export interface QuestionType {
  id: string;            // e.g. 'rw.sec.boundaries.clause_join'
  skillId: string;
  name: string;          // student-facing
  definition: string;
}

export interface Skill {
  id: string;            // e.g. 'rw.sec.boundaries'
  domainId: string;
  officialName: string;
  studentName: string;
  tests: string;         // plain-language "What this tests"
  cues: string[];        // how to recognize it
  commonMistakes: string[];
  strategies: string[];
  prerequisites: string[]; // other skill ids (acyclic)
  types: QuestionType[];
}

// ---------- Content ----------
export interface Choice { id: ChoiceId; text: string }

export type ResponseSpec =
  | { kind: 'mcq'; choices: Choice[]; answer: ChoiceId }
  // accepted: every accepted entry string exactly as a student may type it (e.g. ['3/2', '1.5']).
  | { kind: 'spr'; accepted: string[] };

export interface Explanation {
  answerSummary: string;              // one line: the answer and the core reason
  steps: string[];                    // concise solution steps
  check: string;                      // evidence (R&W: quote/rule) or mathematical check
  whyWrong?: Partial<Record<ChoiceId, string>>; // why each wrong choice fails (mcq)
  takeaway: string;                   // reusable lesson
}

export interface Item {
  id: string;                 // stable, e.g. 'orig.rw.sec.boundaries.001'
  version: number;
  section: SectionId;
  skillId: string;
  typeId: string;
  secondarySkillIds?: string[];
  origin: ItemOrigin;
  difficulty: Difficulty;
  difficultySource: DifficultySource;
  // Rich text: supports __underlined__, *italic*, **bold**, and blank lines between paragraphs.
  passage?: string;
  passage2?: string;          // cross-text items: Text 2
  table?: { caption?: string; headers: string[]; rows: string[][] };
  prompt: string;
  response: ResponseSpec;
  explanation: Explanation;
  hints: [string, string, string];   // 1 = name the skill, 2 = next action, 3 = partial step. Level 4 = full explanation.
  formatTags: string[];       // 'mcq' | 'spr' | 'table' | 'paired_texts' | 'notes' | 'underlined' | genre tags...
}

export interface Lesson {
  skillId: string;
  title: string;
  objective: string;
  cues: string[];
  steps: string[];            // 3–5
  workedExample: { problem: string; solution: string[] };
  trap: string;
  check: { question: string; answer: string };
  minutes: number;            // 2–4
}

export interface ModuleSpec {
  id: string;
  section: SectionId;
  title: string;              // e.g. 'Reading and Writing · Module 1'
  itemIds: string[];
  durationSec: number | null; // null = untimed
}

export type AttemptMode = 'diagnostic' | 'practice' | 'paper_replay' | 'paper_entry';

export interface TestSpec {
  id: string;
  title: string;
  mode: AttemptMode;
  label: string;              // provenance badge, e.g. 'Original diagnostic · no scaled score'
  description: string;
  modules: ModuleSpec[];
  breakAfterModuleIndex?: number; // 10-minute optional break after this module index
}

// Official paper forms are metadata only in this build (content requires local import).
export type FormRole = 'unassigned' | 'taken_in_bluebook' | 'save_for_bluebook' | 'in_app_diagnostic' | 'practice_pool';
export interface OfficialForm { number: number; title: string; imported: boolean }

// ---------- Attempts ----------
export interface ResponseRecord {
  itemId: string;
  raw: string | null;         // mcq: ChoiceId; spr: typed string; null = unanswered
  flagged: boolean;
  eliminated: ChoiceId[];
  activeMs: number;
  hintLevel: number;          // 0 = none; any value > 0 before answering makes the attempt assisted
  explanationSeen: boolean;
  confidence?: 'sure' | 'unsure';
  changedAt: number;
}

export type ModuleStatus = 'not_started' | 'active' | 'submitted' | 'expired';

export interface ModuleState {
  index: number;
  status: ModuleStatus;
  startedAt?: number;         // epoch ms (wall clock)
  deadline?: number;          // epoch ms; persisted so sleep/close does not pause strict tests
  submittedAt?: number;
  responses: Record<string, ResponseRecord>;
}

export interface Attempt {
  id: string;
  profileId: string;
  testId: string;
  mode: AttemptMode;
  testSnapshot: TestSpec;     // frozen at start
  createdAt: number;
  completedAt?: number;
  status: 'in_progress' | 'on_break' | 'completed';
  currentModule: number;
  breakEndsAt?: number;
  interrupted?: boolean;      // resumed after app close/crash
  modules: ModuleState[];
}

export type Outcome = 'correct' | 'incorrect' | 'omitted' | 'invalid_format';

export interface GradedResponse {
  itemId: string;
  skillId: string;
  outcome: Outcome;
  assisted: boolean;
  formatMessage?: string;     // set for invalid_format
}

export type MissReason = 'concept' | 'misread' | 'calculation' | 'strategy' | 'time' | 'guessed' | 'unsure';

// ---------- Evidence ----------
export type Exposure = 'unseen' | 'seen_in_app' | 'possibly_seen' | 'remembered';

export interface Observation {
  profileId: string;
  itemId: string;
  skillId: string;
  difficulty: Difficulty;
  outcome: Outcome;
  assisted: boolean;
  firstAttempt: boolean;      // first time this profile answered this item
  exposureBefore: Exposure;
  at: number;
  attemptId: string;
  mode: AttemptMode;
}

export type EvidenceLabel = 'insufficient' | 'needs_practice' | 'developing' | 'progressing' | 'consistent';

export interface SkillEvidence {
  skillId: string;
  eligible: number;           // count used for the estimate (<= 20)
  correct: number;
  estimate: number | null;    // (correct+1)/(eligible+2); null when eligible === 0
  label: EvidenceLabel;
  lastPracticed?: number;
  recentErrorRate: number;    // latest 5 eligible observations (0..1)
  due: boolean;               // a scheduled review is due
  difficultyMix: Record<Difficulty, number>;
  distinctDays: number;
}

export interface Recommendation {
  skillId: string;
  priority: number;
  reason: string;             // student-facing, e.g. 'You missed 3 of 5 recent clause-boundary questions.'
  components: { weakness: number; due: number; recentErrors: number; focus: number };
  kind: 'practice' | 'diagnose';
}

export interface ReviewSchedule { profileId: string; skillId: string; dueAt: number; intervalDays: number }

// ---------- Profiles & app state ----------
export interface Profile {
  id: string;
  nickname: string;
  createdAt: number;
  targetDate?: string;        // YYYY-MM-DD
  scoreGoal?: number;
  weeklyMinutes?: number;
  sessionMinutes?: number;
  focusSkillIds: string[];
  onboarded: boolean;
}

export interface BluebookResult {
  id: string;
  profileId: string;
  testNumber: number;         // 4–11
  date?: string;              // YYYY-MM-DD
  total?: number;             // 400–1600
  rw?: number;                // 200–800
  math?: number;              // 200–800
  domainBands?: Record<string, { filled: number; total: number }>; // keyed by domain id
  enteredAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  textScale: number;          // 1 = 100%
  showTimer: boolean;
  reduceMotion: boolean;
}

import type { AiSettings } from '../ai/types';

export interface AppState {
  schemaVersion: 1;
  ai?: AiSettings;                                   // optional local model connection
  profiles: Profile[];
  activeProfileId: string | null;
  attempts: Attempt[];
  observations: Observation[];
  missReasons: Record<string, MissReason>;          // key `${attemptId}:${itemId}`
  remembered: Record<string, string[]>;              // profileId -> itemIds the student remembers
  reviews: ReviewSchedule[];
  bluebook: BluebookResult[];
  formRoles: Record<string, Record<number, FormRole>>; // profileId -> form number -> role
  problemReports: { id: string; profileId: string; itemId: string; kind: string; comment: string; at: number }[];
  settings: Settings;
}
