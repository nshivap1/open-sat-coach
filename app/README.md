# Open SAT Coach

An offline SAT study app. Its study loop is **test → diagnose → learn → targeted practice → fresh reassessment**. The full spec is in [`../PRD.md`](../PRD.md).

You can run it two ways:
- **Desktop app** (Tauri 2, macOS Apple Silicon and Windows x64). Data is stored in SQLite.
- **Web build**: a single `dist/index.html` file you open in a browser. Data is stored in the browser.

## Quick start: desktop app on a Mac

```bash
cd test-coach/app
bash scripts/setup-mac.sh
```

The script installs Rust and, only if needed, Node.js. Both go into your user account; nothing needs `sudo`. It then runs the checks, builds the app, and shows it in Finder. The first build compiles the Rust crates and takes about 5–10 minutes.

This is an unsigned development build. The first time you open it, right-click the app and choose **Open**.

On Windows, run `powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1`. You need the Microsoft C++ Build Tools installed first.

## Gemma: the AI coach (optional, runs on your computer)

**Easiest path (desktop app):** during onboarding, or later in Settings → AI coach, choose **Get Gemma for this app**.
- The app downloads Gemma 4 from Hugging Face and suggests a size based on your computer's memory:

  | Model | Download | Suggested for |
  |---|---|---|
  | E2B | 2.84 GB | 8 GB computers |
  | E4B | 4.59 GB | 16 GB computers |
  | 12B | 7.22 GB | 24 GB or more |

- It checks the download against Hugging Face's published SHA-256 checksum, and an interrupted download picks up where it stopped.
- It runs Gemma with the llama.cpp runtime that `scripts/setup-mac.sh` bundles into the app. Nothing else needs installing.
- The weights aren't inside the installer, because they're larger than GitHub's 2 GiB release-file limit.

**Or use what you already have.** The app also finds:

| Source | Where it looks |
|---|---|
| Ollama | `:11434`, for example after `ollama pull gemma4:e4b` |
| LM Studio | local server on `:1234` |
| llama.cpp server | `:8080` |
| Jan | `:1337` |
| Any OpenAI-compatible server | a local URL you enter |
| A `.gguf` file on disk | Downloads, `~/models`, and the LM Studio, Hugging Face and llama.cpp caches |

**What Gemma does in the app:**
- **Explain it another way.** Available after you answer, with up to 6 follow-up questions.
- **Ask the coach.** Paste any SAT question. Gemma names the skill it tests, works it through, and links to practice for that skill.
- **Suggest why I missed it.** On results, Gemma proposes a reason for each miss. It's a hypothesis you accept or dismiss.
- **New practice questions written by Gemma.** Each one passes structure checks, an independent Gemma solve, and a uniqueness check before you see it. They're labeled as Gemma-written and don't count toward your skill estimates.
- **Benchmark (Settings → AI coach).** Shows how accurately and quickly your model answers the original practice questions.

**AI judge.** Every AI answer, explanation and Gemma-written question gets a separate, skeptical judging pass before you see it.
- The judge works the problem out itself, then checks the final answer, each step, and the arithmetic.
- For Reading and Writing, it checks that every claim is backed by the passage.
- Contradicting the answer key always fails.
- A failed reply is revised once. If it still fails, the AI explanation is hidden behind a warning.
- On pasted questions, disagreement between the coach and the judge is shown as a conflict.
- You can choose a different local model as the judge (Settings → AI coach → Answer checking), for example Gemma 4 12B judging E4B. Otherwise the same model takes a second look, and the app labels that honestly.

The app only talks to addresses on your own computer; the one exception is the Gemma download you start yourself. AI output is labeled "not verified" and never changes answer keys or grades.

## Develop

```bash
npm install
npm run build            # web build → dist/index.html
npm run build:desktop    # desktop frontend → dist-desktop/
npm run desktop:dev      # run the desktop app
npm run desktop:build    # build the desktop bundle
npm test                 # unit tests (node:test)
npm run typecheck
npm run check:private    # fails if College Board PDFs/ZIPs or teaching files are in the project
node scripts/smoke.mjs   # browser smoke test of the web build (Playwright)
node scripts/e2e-ai.mjs  # AI flow test against a mock local Ollama server
```

`src/shims/react.d.ts` contains minimal React types. The first build machine had no registry access, so they were written by hand. After `npm install` you can swap them for `@types/react` and `@types/react-dom`.

## What's in the app

- **Profiles and onboarding**: a local nickname only, plus which Bluebook tests the student has already taken and an optional AI coach step.
- **Quick diagnostic**:
  - One original question per skill across the 8 domains.
  - Bluebook-style timed modules: timers keep running while the app is closed, time-out submits the module automatically, and finished modules lock.
  - Test tools: review grid, flag, answer elimination, calculator, formula reference, break.
- **Grading**: no AI involved. It handles SAT answer-entry rules, and results break down by domain and skill with explanations and miss reasons.
- **Skill map**: 29 skills, shown with status text and symbols, prerequisites, and an accessible list view.
- **Practice**:
  - A lesson, then questions with a 4-step hint ladder and explanations.
  - "Explain it another way" and follow-up questions, with a local AI model connected.
  - Spaced reviews and "I remember this question".
- **Tests hub**: a Bluebook score log and a planner for how to use the 8 official practice tests.
- **Themes**: light, dark or system, with text size up to 200%.

## Not yet (see PRD milestones)

- Importing official College Board PDFs and Question Bank exports (M2)
- Entering answers from a paper test
- Graphing calculator
- The full relational database (M2/M4)
- Verified AI explanations (M5)
- Signed installers (M7)

## Layout

```
src/domain/     shared types, store (localStorage | SQLite via Tauri), attempts/timers, grading,
                evidence, recommendations, form budget, actions
src/content/    ontology seed (8 domains, 29 skills), original items and lessons, tests
src/ai/         local-model detection, chat client, coach, benchmark, download catalog
src/features/   home, practice, test, progress (skill map), tests hub, settings, onboarding, ai
src-tauri/      Rust: SQLite storage, loopback-only HTTP proxy, .gguf scan, llama-server process, device info
docs/adr/       architecture decision records
```

All questions and lessons are original and have been checked by automated review only. SAT® is a trademark registered by the College Board, which is not affiliated with and does not endorse this project.
