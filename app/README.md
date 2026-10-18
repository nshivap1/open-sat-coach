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

## AI coach (optional, runs on your computer)

The model is **not bundled**: Gemma 4 E4B is 4.59 GB, which is over GitHub's 2 GiB release-file limit. Instead, the app finds a model you already run locally. During onboarding, or later in Settings → AI coach, it checks for:

| Source | Where it looks |
|---|---|
| Ollama | `http://127.0.0.1:11434` (for example after `ollama pull gemma4:e4b`) |
| LM Studio | local server on `:1234` |
| llama.cpp server | `:8080` |
| Jan | `:1337` |
| Any OpenAI-compatible server | a local URL you enter |
| A `.gguf` file (desktop app only) | Downloads, `~/models`, the LM Studio, Hugging Face and llama.cpp caches. The app runs it with `llama-server`, which you can install with `brew install llama.cpp`. |

If it finds nothing, onboarding shows download links for Gemma and recommends a model size based on your computer's memory.

The app only ever talks to addresses on your own computer. AI explanations are labeled "not verified" and never change answer keys or grades. Settings → AI coach also has a quick benchmark: it shows how accurately and quickly the connected model answers the original practice questions.

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
