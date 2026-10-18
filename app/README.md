# Open SAT Coach — web build (M0 prototype)

A working build of the core study loop described in `../PRD.md`:
**test → diagnose → learn → targeted practice → fresh reassessment**.

## What works in this build

- **Profiles and onboarding.** Local nickname only, an optional test date and goal, and which Bluebook practice tests you've already taken.
- **Quick diagnostic.** One original question per skill across all 8 domains, in timed modules.
  - Strict tests: timers run on persisted deadlines, so closing the tab doesn't pause them. An expired module autosubmits, and submitted modules lock.
  - Test tools: review grid, flag, answer elimination, offline scientific calculator, formula reference, break screen.
- **Deterministic grading.** Covers MCQ and student-produced responses under SAT entry rules. Format errors are reported separately from wrong answers.
- **Results by domain and skill**, with explanations and a "why did I miss it?" label for each question.
- **Skill map.** Covers 8 domains and 29 skills.
  - Shows evidence status with text and glyphs, not color alone, plus prerequisites and dependents.
  - An accessible list view shows the same data.
- **Practice sessions.**
  - Flow: lesson, then 5–15 questions with immediate feedback, a 4-step hint ladder, and explanations.
  - "I remember this question" excludes it from evidence.
  - Problem reports stay local.
  - Spaced review schedule of 1 → 3 → 7 → 14 days.
- **Transparent evidence model.**
  - Estimate = (correct + 1) / (eligible + 2), over the latest 20 fresh, unassisted answers.
  - Recommendations show their reason.
- **Tests hub.**
  - Bluebook results log, which marks those forms as seen.
  - Form budget planner, which decides which official forms to save for Bluebook, use as in-app diagnostics, or use for practice.
- **Themes.** Light, dark and system, plus text size up to 200%.

## Not in this build yet (see PRD milestones)

- Desktop shell (Tauri)
- Local Gemma model and the AI coach
- Import of official College Board PDFs and Question Bank exports
- Paper-answer entry for official forms
- Graphing calculator
- SQLite storage. This build stores data in the browser's localStorage, so clearing site data erases it. Use Settings → Export to keep a copy.

## Run

```bash
npm install          # react, react-dom, esbuild, typescript, tsx
npm run build        # → dist/index.html (single self-contained file; open it in a browser)
npm test             # unit tests (node:test)
npm run typecheck
```

`src/shims/react.d.ts` holds minimal React typings, because the build machine had no registry access. After `npm install`, you can replace it with `@types/react` and `@types/react-dom`.

## Layout

```
src/domain/     types (shared contract), store, attempts (timers/state machine), grading,
                evidence, recommend, formBudget, actions (wiring)
src/content/    ontology seed (8 domains, 29 skills, question types), original items, lessons, tests
src/features/   home, practice, test (runner, item view, calculator, reference, results),
                progress (skill map, panel), tests (hub, Bluebook log, form budget), settings, onboarding
```

All questions and lessons are original and checked by automated review only; nothing has been reviewed by a human teacher. SAT® is a trademark registered by the College Board, which is not affiliated with and does not endorse this project.
