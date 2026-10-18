# Open SAT Coach — Product Requirements Document

Version 2.0 · October 18, 2026 · Status: implementation-ready · "Open SAT Coach" is a working name (see owner action O-1)

Companion files: [SOURCE_REVIEW.md](SOURCE_REVIEW.md) (source inventory and seed mappings) · [PRD.v1.0.md](PRD.v1.0.md) (previous version) · `app/` (M0 web prototype, see §14).

## 0. What changed from v1.0

### Owner decisions (October 18, 2026)

| # | Decision | Effect on this document |
|---|---|---|
| D-1 | The first release is a **public open-source launch** | macOS Apple Silicon and Windows x64 both ship in v1. Code signing/notarization, accessibility, licensing, and clean offline installation are on the critical path. |
| D-2 | **No human review gates.** Deterministic checks plus an independent AI reviewer replace every human review step | §5 defines the review model. No state ever waits for a person. Student-facing labels say "reviewed by automated checks," never "teacher reviewed." |
| D-3 | **Complement Bluebook** rather than imitate it | The locally assembled adaptive "digital-format rehearsal" and its routing are removed. New FR-14 Bluebook log records taken tests and scores and marks those forms as probably seen. |
| D-4 | **The skill map is a headline feature** | New FR-13. The map is the default Progress view, with an equivalent accessible list. |

### Defaults added in this revision (changeable — edit this table to override)

| # | Default | Rationale |
|---|---|---|
| D-5 | Ship **content-free, digest-verified manifests** for known official PDFs | Students never review imports; no College Board content is redistributed |
| D-6 | Accept **College Board Educator Question Bank PDF exports** as an import source | Adds official items with official domain/skill/difficulty tags and rationales; expected to ease thin per-skill inventory (counts unverified, §4.1) |
| D-7 | Add **"I took it on paper" answer entry** | Matches how paper forms are actually used; small effort |
| D-8 | Use the **official answer explanations** included in every bundle as trusted evidence | Strongest available grounding for the coach on official items |
| D-9 | Display official items as **faithful per-block PDF renders with a selectable text layer**, plus a reflowable **Text view** | Exact visual fidelity without hand-reconstructing thousands of items; Text view meets accessibility needs |
| D-10 | **Build-time original content** (lessons, ≥20 original items per skill, an original quick diagnostic) may be authored and reviewed by maintainer-operated cloud AI; **runtime AI stays local** | Makes the shipped original bank large enough to matter; no student data or cloud call at runtime |
| D-11 | Coach = **hint ladder + explanation + up to 6 follow-up turns anchored to the current item** | Keeps every answer tied to a verifiable item; no open-ended chatbot |
| D-12 | **Gemma 4** family (E2B / E4B / 12B) is the model candidate set | Google lists Gemma 4 under Apache-2.0 [S6]; verify the selected artifact's license file and per-variant image support |
| D-13 | A **form budget planner** allocates the eight official forms among Bluebook tests, in-app diagnostics, and practice | Stops students from burning fresh full tests on drills |

**Removed from v1.0:** digital-format rehearsal (v1 FR-02 P1), local adaptive routing and its 70% threshold, the "reserve at least two forms" rule (replaced by D-13), all human/teacher reviewer gates.

**Current state:** an M0 web prototype of the core loop exists at `app/` (original content, test engine, deterministic grading, evidence model, skill map, practice sessions, Bluebook log, form budget). It has no desktop shell, local model, or PDF import yet. See §14.

## 1. Product intent

Build an open-source desktop SAT coach that works offline, simulates test conditions for official practice forms, identifies precisely what a student needs to practice, and teaches those skills with short, understandable explanations. The core loop is **test → diagnose → learn → targeted practice → fresh reassessment**. AI supports this loop. Testing, grading, records, retrieval, and the skill map work without the model.

**Primary user:** a high-school student studying independently on a personal laptop who downloads the app from a public release page. **Secondary user:** a tutor or parent reviewing that student's results on the same device. **Not a user in v1:** school administrators, multi-student classrooms.

The **ontological map** is a versioned network connecting official SAT domains and skills, finer question types, prerequisites, misconceptions, strategies, lessons, real source questions, and individual student attempts. It must explain **what a question tests** and **why it is recommended for this student**, and it is visible to the student as the skill map (FR-13).

### Product commitments

1. Use locally imported official practice material (paper forms, Question Bank exports), preserving original content and provenance.
2. Simulate test conditions for official paper forms in the app. Send students to Bluebook for official adaptive tests and record those results. Never call a paper replay "the digital SAT."
3. Save every attempt. Map mistakes to skills without treating one mistake as proof of a misconception.
4. Run tutoring and quiz generation on a bundled local model (Gemma 4 candidate, chosen by evaluation).
5. Ship one self-contained download per supported OS/architecture, including the default model and runtime.
6. Accept questions across the SAT curriculum and give evidence-backed solutions with an explicit verification status, not guaranteed correctness.
7. Offer a quiet, simple interface with light, dark, and system themes.
8. Show the student's skill map — what each skill tests, where they stand, and why something is recommended — as a primary view.
9. Be honest about review. Content approved by automated checks and AI review is labeled that way; nothing claims teacher or expert review.

## 2. Evidence from the supplied materials

The Downloads folder contains one teaching archive (26 files) and eight practice bundles, tests 4–11 (24 PDFs). See [SOURCE_REVIEW.md](SOURCE_REVIEW.md). Original archives remain untouched.

The teaching archive's useful instructional pattern is strategy → worked example → student practice → reflection. Convert it into brief individual sessions; do not reproduce the classroom course or its proprietary wording.

### Findings that change the implementation

- **The full tests are paper, nonadaptive forms.** Test 10 has 33 questions per Reading and Writing module and 27 per Math module; the digital format has 27 and 22 [S1, S2]. Do not truncate them and call the result the digital SAT.
- **The paper forms are the same practice tests as Bluebook 4–11.** College Board says students "can take the same practice tests for free in Bluebook" [S2]. It does not state item-for-item identity, so treat a Bluebook test the student has taken as **probable exposure** to the matching paper form.
- **Every bundle includes answer explanations for every question** [S2]; the supplied explanation PDFs run 46–53 pages per form. These are the strongest grounding available for the coach (D-8).
- **Paper scores are ranges.** Scoring guides give lower/upper section conversions. Preserve form-specific conversions including ranges; never invent a precise digital score.
- **Teaching labels mix different concepts.** "Poetry" is a passage genre; "calculator" is a strategy; "grammar" spans more than one official skill. They belong on separate ontology axes.
- **Example references need validation.** A Test 7 example cites "Module 8"; the Test 10 slide deck cites Tests 9 and 6. Preserve original labels as provenance; establish identity from content plus form metadata.
- **Some teaching heuristics need qualification.** One numerical substitution does not prove two expressions equivalent; an unusual-looking answer is not automatically wrong.
- **The curriculum is private input.** The teacher guide reserves reproduction rights. The teaching archive is optional local reference and an exposure signal, never shipped inventory.
- **The teaching examples largely duplicate forms 4–10.** They reference Bluebook Tests 1–10 plus an older linear deck (163 slides). They add little fresh inventory and must be deduplicated against the forms.

## 3. Scope, platforms, and limits

### Release plan

| Milestone | Outcome | Platform |
|---|---|---|
| M0 web prototype (exists) | Core loop on original content in a browser build | Web (dev only) |
| M1–M6 | Desktop shell, official import, test engine, learning records, coach, generation (§14) | macOS Apple Silicon (dev), Windows x64 in CI from M1 |
| **Public v1 (M7)** | **Every P0 and P1 requirement in this document** | **macOS Apple Silicon and Windows x64**, signed |
| Later | Linux; Intel Macs; tutor multi-student views; opt-in sync; additional model packs; timed section drills; PSAT forms; broader generation | — |

Proposed minimum OS versions (confirm in the packaging spike): macOS 13 or later on Apple Silicon; Windows 10 22H2 and Windows 11 on x64. Stage names must not silently drop a requirement.

### Exclusions

No official test administration, College Board login, Bluebook scraping or import of Bluebook files, item-level mapping of Bluebook results, reverse engineering of College Board scoring or routing, **locally assembled adaptive tests or simulated routing**, automated download or scraping of the Question Bank (exports are made by the user), remote proctoring, social leaderboard, admissions advice, mandatory account, subscription, cloud inference at runtime, telemetry, or human review as a release dependency. Mobile and Chromebook are outside v1.

### Fidelity contract

In-app paper replay reproduces the official paper form's content, order, counts, and printed timing, with Bluebook-style digital tools (highlight, eliminate, flag, calculator, reference). It is labeled **"Official practice test · paper (nonadaptive) form."** Scores are form-specific paper conversions shown as ranges. For the adaptive experience and its scaled score, the app sends students to Bluebook and records the result (FR-14). The offline calculator is not Desmos; the test intro screen says so. The app cannot claim to reproduce undisclosed College Board routing or IRT scoring [S3].

## 4. Content inventory and form budget

### 4.1 Sources

| Source | How it enters | Approximate size | Tags | Answer evidence | Notes |
|---|---|---|---|---|---|
| Official paper forms 4–11 | Student downloads bundles from College Board (a button opens the page in the browser) and drops the ZIPs into the app | 8 forms × 120 = **960 items** | Manifest tags (AI-classified at build time, §5) | Scoring key + official explanations | Same tests as Bluebook 4–11 |
| Educator Question Bank exports | Student or tutor exports PDFs with rationales from College Board's free bank (no sign-in [S9]) and imports them | Third-party count: ~2,000 SAT items, ~570 of which also appear on official tests — **verify** | Official domain, skill, difficulty, question ID | Official answer + rationale | Exporting with "exclude active questions" is expected to avoid practice-test overlap — **verify** |
| Original practice bank | Ships with the app | ≥20 items per skill (≥580) + original quick diagnostic | Authored to the ontology | Build-time verified | Only content allowed in public CI |
| Runtime generated practice | Local model + deterministic templates | Unbounded within supported families (FR-10) | Template-defined | Deterministic derivation + validation | Labeled "Generated" |
| Teaching archive (private) | Optional local import of the user's own files | 26 files | Teaching aliases | Varies | Reference and exposure signal only |

### 4.2 Why the budget matters

Estimated items per skill across all eight paper forms, **assuming the paper forms follow digital-SAT domain weights** (manifests will give exact counts):

| Domain | Est. items (8 forms) | Official skills | Est. per skill |
|---|---:|---:|---:|
| R&W · Information and Ideas | ~137 | 3 | ~45 |
| R&W · Craft and Structure | ~148 | 3 | ~49 |
| R&W · Expression of Ideas | ~106 | 2 | ~53 |
| R&W · Standard English Conventions | ~137 | 2 | ~68 |
| Math · Algebra | ~151 | 5 | ~30 |
| Math · Advanced Math | ~151 | 3 | ~50 |
| Math · Problem-Solving and Data Analysis | ~65 | 7 | **~9** |
| Math · Geometry and Trigonometry | ~65 | 4 | **~16** |

Every official item used for drills is an item a future full test cannot use fresh, and Bluebook tests the student already took have consumed their matching forms. The app therefore (a) budgets forms deliberately (§4.3), (b) draws skill practice first from Question Bank exports, the practice pool, and the original bank, and (c) uses generation where answers can be verified (FR-10).

### 4.3 Form budget planner (D-13)

Onboarding asks which Bluebook practice tests the student has taken (FR-14). Each of forms 4–11 then gets exactly one role:

| Role | Meaning | Default assignment |
|---|---|---|
| `taken_in_bluebook` | Probably seen. Paper replay is labeled "Retake — score may overstate readiness." Items join the practice pool flagged possibly seen. | From the Bluebook log |
| `save_for_bluebook` | Reserved for an adaptive Bluebook test with a real scaled score. Nothing from the form appears anywhere in the app. | The **2 newest** unexposed forms |
| `in_app_diagnostic` | Taken as a full paper replay for item-level diagnosis | **1** form now; **+1** held as a final check when ≥6 forms are unexposed |
| `practice_pool` | Items available to practice, examples, and hints | All remaining forms |

Rules:
- Reserved items never leak into retrieval, hints, examples, map examples, or generation prompts.
- The planner proposes Bluebook test dates evenly spaced before the target date, with the last one at least 7 days before test day.
- Within 7 days of the target date, unused reserved forms prompt "Release to practice?"
- Role changes are explicit and logged. Once any item of a form has been shown, moving it back to `save_for_bluebook` warns that the result will be a retake.
- With no target date, the planner uses the defaults above and suggests one Bluebook test every 3 weeks.

### 4.4 Exposure model

Per profile and canonical item, exposure is the strongest applicable level:

| Exposure | Source | Evidence eligibility | Selection |
|---|---|---|---|
| `unseen` | — | Eligible | Preferred |
| `seen_in_app` | Shown in any app mode | Only the first unassisted attempt ever counts | Scheduled review only |
| `possibly_seen_bluebook` | Form marked taken in Bluebook | Eligible if exposure is ≥21 days old (or the date is unknown) and the item is not remembered; observation tagged possibly seen | After unseen |
| `possibly_seen_teaching` | Profile says the student took the classroom course and the item matches a teaching example | Same as above | After unseen |
| `remembered` | Student taps "I remember this question" | Never eligible | Excluded from fresh practice |

Skill pages show how many observations were possibly seen. Canonical identity across sources is established by content (normalized text hash, near-duplicate check, figure hash), never by test or question number. Question Bank IDs are stable identifiers within that source; a paper item that matches a Question Bank item inherits its official difficulty.

## 5. Review model: automated checks + independent AI review (D-2)

No human step gates activation or release. Every place v1.0 required a person now uses:

1. **Deterministic checks, always first:** schema, counts, key format, hash and digest matches, asset presence, duplicate detection, and math tool checks.
2. **Independent AI review:** a reviewer run separate from the producer run, with a written rubric and the inputs it needs (source render, structured item, key, official explanation where available).
   - Producer and reviewer are separate invocations with no shared conversation. The reviewer sees the producer's output, never its reasoning.
   - At build time, prefer a different model (ideally a different family) for the reviewer; record both.
   - The initial solver never sees the answer key (FR-09).
   - Verdicts are `pass`, `fail(reason codes)`, or `abstain`. Fail or abstain → `quarantined`. Quarantined content is not served. There is no "waiting for review" state.
   - Every verdict is stored as a `ReviewRecord`: reviewer model and version, rubric version, input IDs, verdict, reason codes, timestamp.
3. **Student-facing honesty:** each item and explanation can show its basis — "Answer from the official key," "Checked mathematically," "Reviewed by automated checks." Never "teacher reviewed." The README and About screen state that no human expert reviews content and point to published evaluation results (§13).
4. **Feedback instead of reviewers:** every item, explanation, and lesson has **Report a problem** (wrong answer, unclear, typo, rendering, other). Reports stay local. A "wrong answer" report hides the item for that profile until it is re-verified. The student may export a sanitized report (IDs, digests, their comment; no student data or private source text) to file publicly. Nothing is sent automatically.
5. **Maintainer override** exists in maintainer tooling but is optional and never a gate.

| What is reviewed | When | Reviewer | Shipped? |
|---|---|---|---|
| Official form manifests (segmentation, key digests, skill tags) | Build time, on publicly downloadable College Board PDFs | Deterministic + independent AI (cloud allowed) | Content-free manifest only |
| Original lessons, practice bank, diagnostic | Build time | Deterministic + independent AI (cloud allowed) | Yes |
| Generator families (templates, annotated sentence banks) | Build time | Deterministic + independent AI + audit of ≥100 generated items per family | Yes |
| Unknown imported files, Question Bank exports | Runtime, on the student's machine | Deterministic + local model | No (stays local) |
| Runtime-generated items | Runtime | Deterministic + local verification | No |
| Coach explanations | Runtime | FR-09 verification statuses | No |

Reviewer reason codes (shared by build-time and runtime reviewers): `R-KEY` single best answer confirmed · `R-AMBIG` two defensible answers · `R-OUTSIDE` R&W answer needs outside knowledge · `R-ALIGN` item does not test its declared skill/type · `R-DISTRACTOR` a wrong choice has no nameable flaw · `R-DUP` duplicates or closely paraphrases a reserved/official item · `R-FORMAT` violates SAT response conventions · `R-EXPL` explanation inconsistent with key or source · `R-MATH` tool check failed · `R-LEVEL` reading level or tone inappropriate · `R-SENSITIVE` content unsuitable for students.

## 6. Student journeys

**A. First use.** Launch → choose a local nickname → optional target date, score goal, weekly study time → theme and accessibility settings → device and model readiness check → "Have you taken any Bluebook practice tests?" (checklist 4–11 with optional dates and scores) → **Get official practice tests** (opens College Board's page in the browser; the student drags the downloaded ZIPs in; recognized forms activate in seconds) → form budget proposal → start the in-app diagnostic form, or the original quick diagnostic if no official files are present. No terminal, Python, Ollama, Docker, API key, or account.

**B. Test and diagnose in the app.** Choose a form → intro shows "paper (nonadaptive) form," timing, exposure/retake status, range scoring, and calculator limitations → complete modules → result summary (score range, section ranges, per-domain accuracy) → review missed, flagged, and uncertain questions by skill → the map highlights the affected skills → recommended 10–20 minute session. No hints, answers, coach, or lessons during strict testing.

**C. Took it on paper.** Choose a form → enter answers module by module on a fast keyboard grid → optionally mark guessed or unsure → same report as B, labeled "self-entered."

**D. Took it in Bluebook.** Open the Bluebook log → test number, date, scores, optional domain bands → planner and score history update.

**E. Targeted practice.** From the Home recommendation or the map → 2–4 minute lesson → worked-example checkpoint → 5–10 items → review errors → a delayed check with different items is scheduled.

**F. Explore the map.** Progress → map → focus a skill → see what it tests, evidence, prerequisites, real examples, and the student's attempts → practice.

**G. Ask the coach.** On a practice or review item, or by pasting text or an image → confirm the transcription → hint ladder or full explanation with verification status → up to 6 follow-up turns anchored to the item → "Try a similar question."

## 7. Functional requirements and acceptance criteria

Priority: **P0** = required at the milestone that introduces it and for public v1; **P1** = required for public v1, may land later than its first milestone; **P2** = after v1.

### FR-01 — Content ingestion and curation

**P0** official paper forms via manifests and the generic pipeline; **P1** Question Bank exports; **P2** optional local import of teaching files.

Pipeline: safe archive expansion (path-traversal, size, ratio, and file-count limits; encrypted and truncated archives rejected) → file hash and inventory → **identify** (SHA-256 match against shipped manifests; otherwise classify as paper test, scoring guide, answer explanations, Question Bank export, teaching file, or unknown) → PDF text/layout extraction with glyph positions → local OCR only where no text layer exists → segmentation → asset capture → key and explanation matching → classification → deterministic checks → local AI review → activation or quarantine.

**Known-form manifests (D-5).** For each official bundle, the repository ships a JSON manifest keyed by file hashes containing:
- form ID, edition, and SHA-256 of the test, scoring, and explanation PDFs;
- per item: stable ID (`cb.paper.{form}.{rw|math}.m{n}.q{k}`), page, block bounding boxes (passage, stem, each choice or the response area, figures, tables), response type, choice regions;
- **key digest** = SHA-256(manifest_salt ‖ item_id ‖ normalized_key), so the import verifies its own key extraction without the manifest containing answers;
- per-block **text digests** of the normalized extracted text, so the import verifies extraction fidelity;
- explanation locators (page and bounding-box range in the explanation PDF);
- module counts and printed timing; scoring-table locator and a digest of the parsed conversion table;
- classification: primary skill/type, secondary tags, format tags, passage genre, difficulty with source (`official` when matched to a Question Bank item, else `ai_estimate`), strategy links;
- summary of `ReviewRecord`s (reviewer models and versions).

Manifests contain **no question text, answer letters, explanation text, or images**. If any digest mismatches (for example, College Board revised a PDF), the mismatched items fall back to the generic pipeline with local review, and the import report says so.

**Generic pipeline.** Publication states are `draft → checked → approved` or `quarantined`. `checked` means deterministic checks passed; `approved` additionally requires a local AI review pass, a valid answer from the source key or rationale, a source match, a primary skill, and all assets. AI classification alone never approves an item, and an LLM never invents a missing official key.

**Question Bank exports (D-6).** Parse each question's metadata (question ID, assessment, section, domain, skill, difficulty), stem, choices or response format, correct answer, and rationale. Activate SAT items by default; PSAT items are optional and labeled. Map official skills to ontology IDs through the alias table; assign subtypes with the local classifier as secondary metadata. Exports without answers or rationales are accepted for exposure tracking but stay quarantined for graded practice until a matching answer export arrives. Deduplicate by question ID, then by content. Verify in the import spike how difficulty appears in exports; if it is only graphical, read it from the rendered indicator, otherwise record `unknown`.

**Display (D-9).** Official items render from the student's own PDF, block by block, at screen resolution times zoom. A transparent, selectable text layer aligned to the PDF glyph positions supports highlighting, selection, and screen readers. Choice regions are click targets; selection and elimination marks are drawn by the app over the render. A per-item **Text view** shows reflowable, theme-aware text built from the extraction; blocks that fail fidelity checks show the render with an "image only" note and a text alternative. In dark theme, official renders sit on a neutral paper surface (optional dimming), never color-inverted. Original and generated items render natively (HTML + KaTeX).

Also required: retain original files in private app storage with immutable hashes, source page/crop coordinates, attribution, and import version; preserve equations, superscripts, italics, underlined spans, tables, graph axes, units, and passage/choice order; side-by-side source and structured preview in maintainer mode.

**Acceptance:** each of the eight forms activates from its manifest with zero manual steps on a clean install; a manifest digest mismatch triggers fallback with a clear report; a Question Bank export of ≥50 mixed items imports with official tags preserved; no item without a verified key is served for graded practice; repeated import is idempotent; corrupt and hostile archives (zip bomb, path traversal, encrypted, truncated) fail safely; every activated form matches its verified module counts; release bundles and public fixtures contain no College Board content (CI scan against hashes and text fingerprints of known official files).

### FR-02 — Local test engine

| Mode | Composition | Timing | Scoring | Priority |
|---|---|---|---|---|
| In-app paper replay | Full official form, original order and counts | Printed per-module timing (manifest-verified). Untimed or custom only as a labeled practice setting. | Form-specific paper conversion as a range | P0 |
| Paper answer entry (D-7) | Student took the printed form and enters answers | Optional total time per module, entered by the student | Same conversion, labeled "self-entered" | P0 |
| Original quick diagnostic | Shipped original items covering every skill, one module per section | Digital-SAT pace (~71 s per R&W item, ~95 s per Math item) | Accuracy and skill evidence; no scaled score | P0 |
| Skill practice | Selected or generated items | Untimed by default; optional practice timer | Practice accuracy, assistance status, skill evidence | P0 |
| Timed section drill | Digital-length nonadaptive module from the practice pool | 32 / 35 minutes | Accuracy only | P2 |

A 10-minute optional break separates the Reading and Writing and Math sections in full tests.

**Required controls:** navigation within the current module, review grid, unanswered and flagged markers, answer elimination, text highlight, zoom, show/hide timer, directions, formula reference, and a graphing/scientific calculator in Math. Answer changes and annotations autosave. Finishing a module locks it; later modules cannot reopen it. No AI, hints, answer keys, or lessons in strict testing.

**Paper answer entry:** a per-module grid; typing A–D advances to the next question; student-produced responses (SPR) use a text field with FR-03 format validation; blanks allowed; review screen before grading. Correcting an entry after grading writes new response revisions and a new grading revision within the same attempt.

**Timer behavior:** monotonic elapsed time during execution; a persisted deadline (`deadline_utc`) plus periodic elapsed checkpoints survive restarts. Sleep or closing the app does not pause strict testing. An expired module autosubmits exactly once. A crash-recovered test is marked `interrupted`. A clock moved backward flags the attempt `clock_anomaly` (best effort; offline clocks cannot be fully trusted). Practice mode may pause and resume. Extended time and custom breaks are chosen before starting, stored with the attempt, and labeled as practice settings, not accommodation approval.

**Acceptance:** fake-clock tests cover expiry, sleep, early submission, restart, clock changes, break transitions, and double submit; completing a test in airplane mode works; saved responses survive forced termination; an expired module cannot gain time by relaunching; unanswered responses are reported separately from wrong answers, though neither earns a point; paper answer entry for a full form takes under 4 minutes with the keyboard.

### FR-03 — Deterministic grading

**P0.** Grade approved official items against imported keys, never against model opinion. Store raw and normalized responses. MCQ uses stable choice IDs.

SPR defaults follow the digital SAT student-produced response directions (verify against each form's directions page): up to 5 characters for a positive answer and 6 including a negative sign; fractions or decimals; a fraction that does not fit is entered as a decimal; a decimal that does not fit is truncated or rounded at the fourth digit; mixed numbers are entered as improper fractions; no percent signs, commas, or dollar signs. Accept the forms the key lists; additional equivalence follows a documented per-form rule table. Never use a universal floating-point tolerance.

Separate input-format validation from mathematical equivalence: an equivalent value that violates a strict format rule gets format feedback (`invalid_format`). Practice may explain a format correction without silently rewriting the submitted answer.

Score conversion references an immutable form ID and scoring-table version. Sum lower and upper section bounds separately where the guide specifies ranges. No conversion for modified forms, mixed quizzes, original diagnostics, or practice. No invented extra points for harder questions.

**Acceptance:** every row of each imported conversion table verified; tests cover zero and full scores, blank responses, numeric alternatives, invalid strings, fractions, rounding boundaries, and mismatched form IDs; regrading after a corrected key creates a revision, preserves original results, and recomputes skill evidence reproducibly.

### FR-04 — Ontology and question classification

**P0.** A machine-readable, versioned ontology (seed in `app/src/content/ontology.ts`, to move to `content/ontology/` in the desktop repo). A tree is used for browsing; relationships support multiple tags and prerequisites.

Core hierarchy: `Section → Domain → Skill → QuestionType`. Additional entities: `Concept`, `Strategy`, `Misconception`, `Lesson`, `Question`, `SourceOccurrence`. Relations: `tests`, `requires`, `uses_strategy`, `may_reveal`, `taught_by`, `example_of`, `same_item_as`. Prerequisite edges must be acyclic; aliases may be many-to-many.

The seed covers 8 official domains and 29 official skills [S4]; question types are product subdivisions, not an official taxonomy.

| Domain | Official skills |
|---|---|
| R&W · Information and Ideas | Central Ideas and Details; Command of Evidence (textual, quantitative); Inferences |
| R&W · Craft and Structure | Words in Context; Text Structure and Purpose; Cross-Text Connections |
| R&W · Expression of Ideas | Rhetorical Synthesis; Transitions |
| R&W · Standard English Conventions | Boundaries; Form, Structure, and Sense |
| Math · Algebra | Linear equations in one variable; Linear functions; Linear equations in two variables; Systems of two linear equations in two variables; Linear inequalities in one or two variables |
| Math · Advanced Math | Equivalent expressions; Nonlinear equations in one variable and systems of equations in two variables; Nonlinear functions |
| Math · Problem-Solving and Data Analysis | Ratios, rates, proportional relationships, and units; Percentages; One-variable data; Two-variable data; Probability and conditional probability; Inference from sample statistics and margin of error; Evaluating statistical claims |
| Math · Geometry and Trigonometry | Area and volume; Lines, angles, and triangles; Right triangles and trigonometry; Circles |

Each type has a stable ID, student-facing name, definition, inclusion/exclusion rules, observable cues, what it tests, prerequisites, common mistakes, strategies with applicability conditions, lesson links, and verified real-question references. Difficulty carries a source (`official`, `ai_estimate`, `empirical`, `unknown`); never present AI-estimated difficulty as calibrated.

Classify each question with one primary skill/type, optional secondary skills, and orthogonal format tags (MCQ/SPR, passage genre, chart, table, diagram, paired texts, notes, underlined portion). Store confidence, classifier version, reviewer record, and status. Official taxonomy, Question Bank tags, and informal teaching aliases are separate fields; the teaching-alias mapping in SOURCE_REVIEW.md is part of the seed.

**Acceptance:** every approved question resolves to an existing primary skill; an ontology migration preserves history and records remapping; the student can browse domain → skill → type → real examples → their attempts with a plain-language "What this tests"; all 29 skills appear even where local inventory is empty.

### FR-05 — Local student profile and evidence

**P0.** Multiple local profiles with explicit switching. Only a nickname is required. Optional: target test date, score goal, weekly study time, preferred session length, accessibility settings, "took the classroom course" flag. No birth date, school, email, or College Board credentials.

Persist attempt mode, form/version, timestamps, module states, timer settings, interruption and clock flags, per-question response revisions, correctness, active viewing time, flags, hint level, explanation exposure, exposure level before the attempt, and optional confidence and reflection.

Reports distinguish wrong, omitted, invalid format, correct-but-unsure, correct-with-help, and repeated or possibly seen items. The student can label a miss: concept gap, misread, calculation, strategy choice, time, guessed, or unsure. Model suggestions are hypotheses until accepted; one wrong answer does not prove a misconception.

**Evidence model.** Per primary skill, use the latest 20 eligible observations: first unassisted attempts on distinct items whose exposure allows evidence (§4.4). `estimate = (correct + 1) / (eligible_count + 2)`. This is a smoothed practice estimate, not a calibrated mastery probability or score predictor. Omitted items lower test accuracy but are recorded separately from concept evidence. Repeats add no independent evidence. Secondary tags support navigation, not duplicate credit. Paper-entry attempts are eligible (without active time). Bluebook results never count as skill evidence; their domain bands only order the diagnostic queue.

| Label | Rule |
|---|---|
| Not enough evidence | fewer than 5 eligible items |
| Needs practice | estimate < 0.60 |
| Developing | 0.60 ≤ estimate < 0.80 |
| Progressing | ≥ 0.80 |
| Consistent | progressing, plus ≥10 distinct items across ≥3 days and a successful delayed check |

Display the sample count, difficulty mix, possibly-seen count, and evidence age; never imply permanent mastery.

**Acceptance:** two profiles never share attempt data; a repeated or remembered item cannot inflate evidence; profile deletion removes associated records and coach threads; export/import round-trips preserve IDs and versions; charts show comparable modes separately.

### FR-06 — Targeted practice and study plan

**P0** curated selection and form budget; **P1** generation expansion.

Recommend a daily session with a visible reason, such as "You missed 3 of 5 recent clause-boundary questions; practice joining complete sentences."

**Ranking.** For sufficiently observed skills: `priority = 0.50×(1 − estimate) + 0.25×due + 0.15×recent_error_rate + 0.10×student_focus`, each input in [0, 1]. `due = 1` when a scheduled review is due, else 0. Recent errors use the latest five eligible observations. Student focus is 1 only for explicitly selected focus skills. Skills with insufficient evidence enter a separate diagnostic queue, ordered by lowest Bluebook domain band when available, rather than being labeled weak. Prerequisite gaps may reorder a session with an explanation. Recommendations are reproducible from a stored policy version.

**Session composition** (default 10 items): 6 target-skill, 2 prerequisite, 2 mixed retention. Source preference: unseen official items (Question Bank, practice-pool forms) → original bank → generated (supported families) → seen items due for review. The session intro shows the source mix. Reserved forms never contribute.

**Review schedule:** offer 1 / 3 / 7 / 14-day checks after successful practice; reset to an earlier interval after difficulty. Students can override. This is a product heuristic; it never implies a score gain.

**Home** shows today's recommendation, the next review date, the next planned Bluebook test (from the planner), and days until the target date.

**Acceptance:** the planner gives each form exactly one role, reproduces the §4.3 defaults, and logs every role change; no reserved item leaks through retrieval, hints, examples, map examples, or generation prompts; insufficient inventory produces a clear choice to shorten the session, widen scope, or use labeled generated practice; every completed session ends with one actionable next step.

### FR-07 — Brief lessons and explanations

**P0.** Ship 29 skill lessons (one per official skill) plus one-paragraph type notes where a type has a distinct trap. Lessons are original, authored and reviewed at build time under §5 (D-10). Private teaching references are used only in the local user's context, with provenance. Retrieval supplies the model with relevant approved lessons, question data, official explanations, and evidence; fine-tuning is not required.

**Lesson format:** objective → recognition cues → 3–5 steps → one worked example → common trap → one check for understanding. Target 2–4 minutes. Vocabulary and notation at roughly grades 8–10 without talking down (automated check: Flesch-Kincaid grade ≤ 10 on lesson body text, excluding defined terms).

**Explanation format:** answer → concise steps → evidence or mathematical check → why the selected wrong choice fails → reusable takeaway. R&W cites specific passage spans or chart cells and names the rule. Math includes equations, units, domain restrictions, and a substitution or other check. Offer conceptual and calculator approaches when both are valid, shorter one first.

**Official explanations (D-8):** for official items, show "Official explanation" from the student's local PDF next to the coach's explanation. The coach explanation must agree with the official key and must not contradict the official rationale; a local reviewer pass compares them, and on mismatch the app shows only the official explanation and flags the coach output.

**Progressive hints:** name the skill → suggest the next action → reveal a partial step → full solution. Record hint use. Never treat lucky elimination or a single substitution as proof.

**Acceptance:** ≥90% of a sampled set of lessons and explanations pass the independent AI rubric (correct, evidence-supported, understandable, aligned to skill) with the rubric and reviewer model published; explanations never change the problem's meaning or rely on outside facts for passage questions; original lessons, official explanations, private references, and AI output are visibly distinguishable.

### FR-08 — Local AI runtime

**P0.** Bundle a local inference runtime and a pinned quantized instruction model. **Candidates (D-12): Gemma 4 E4B** (default candidate), **E2B** (low-memory fallback), **12B** (quality candidate if it fits size and latency budgets). Google's release notes list Gemma 4 with an Apache-2.0 license [S6]; confirm the selected artifact's license file. Third-party listings disagree on which Gemma 4 variants accept images; verify per variant. If the default lacks image input, image questions use local OCR plus mandatory transcription confirmation.

**Size constraint:** GitHub release assets are limited to 2 GiB per file [S10]. A single installer above that needs another download host (owner action O-4) or a smaller model/quantization. Measure installer size per candidate in the model spike.

Use bounded context, JSON-schema-constrained output, retrieval limits, cancellation, resource monitoring, and one generation queue. Persist model identifier, file checksum, quantization, runtime version, prompt template version, tool results, and validation status with every AI artifact. The runtime runs as a sidecar bound to 127.0.0.1 on a random port with a per-launch token (or in-process), never on an external interface. No cloud fallback, no content telemetry.

**Task boundaries:** classify draft items; retrieve lesson evidence; explain approved questions; give hints; answer anchored follow-ups; transcribe pasted images; word generated items; propose verification plans; review runtime-generated items. The model cannot write grades, approve official content, access arbitrary files, execute arbitrary code, or make network calls.

**Acceptance:** a clean-device install runs AI without developer tools; a network-disabled end-to-end test passes; cancellation works within 1 s; model failure leaves testing, history, retrieval, and the map working; replacing the model triggers benchmark regression checks before promotion.

### FR-09 — Explainable verification

**P0.** "Answer any SAT question" is a coverage aspiration, not a guarantee. Confidence comes from evidence, not model self-confidence.

Pipeline: validate transcription and required assets → classify → solve without exposing the key → verify → compare with a trusted key if available → produce a short teaching explanation. A second pass by the same model is critique, not independent proof.

| Status | Evidence required | Student presentation |
|---|---|---|
| Key matched | Answer agrees with an official key (paper form or Question Bank) | "Matches the official answer"; official explanation shown; coach-explanation validation shown separately |
| Tool checked | An appropriate symbolic, exact, or numeric check passes under explicit assumptions | "Checked mathematically," with the actual check |
| Evidence supported | Passage/rule/data evidence and option comparison pass the rubric | "Supported by the passage/rule"; no implied mathematical certainty |
| Unverified | Insufficient independent support, missing context, or ambiguous item | Clearly provisional; ask for clarification or offer a verified alternative |
| Conflict | Key, tool, transcription, or model disagree | Withhold a confident answer; flag and explain the conflict |

**Math verification:** substitute all candidate solutions; reject extraneous roots; check denominator/domain constraints, units, uniqueness, and rounding. Expression equivalence uses symbolic identity under stated assumptions; random examples alone are not proof. Geometry uses stated relationships, not unmarked pixel measurements. Verification runs through the allowlisted operations in §12.

**R&W verification:** identify the required task; link the supporting text or rule; test every option for the relevant relation; flag two defensible answers. A model's claim that its evidence suffices does not earn the supported status. New unconstrained R&W questions stay provisional unless covered by a validated rule or template.

**Acceptance:** the adversarial suite includes wrong keys, OCR minus-sign errors, multiple valid answers, insufficient diagrams, near-equivalent expressions, and irrelevant passage evidence; a key match cannot mask an invalid explanation; low-confidence or conflicting output never overwrites an official answer or enters the approved bank.

### FR-10 — Generated quizzes

**P0** validated math families; **P1** bounded R&W families; **P2** broader coverage. The app shows which skills support generation.

**Required v1 families.** Math (answers derived deterministically by code; the model only words the item, then validation runs again):

| Domain | Families |
|---|---|
| Algebra | linear equation (one variable); linear function from points/table; system of two linear equations; linear inequality; linear equation in two variables |
| Advanced Math | quadratic equations; equivalent expressions (expand/factor); exponential growth/decay |
| PSDA | ratios/rates/unit conversion; percentages incl. successive change; one-variable statistics; probability from a two-way table |
| Geometry | area/volume; right-triangle trig and Pythagorean theorem; circles (equation, arc, sector); angles and similar triangles |

R&W (P1; answers derived from annotated, build-time-reviewed original sentence banks): Boundaries (clause joins, nonessential elements), Form/Structure/Sense (agreement, tense, possessives), Transitions (labeled logical relations). Rhetorical Synthesis is P2. Other R&W skills use curated items only; unconstrained R&W generation is experimental and off by default.

Generation input: skill/type, difficulty target, prerequisites, count, output format, approved concept/strategy references, excluded/reserved item hashes, and seed. Output: structured prompt, choices, answer, solution, verification plan, tags. Generate original items, not cosmetic rewrites of official questions.

Validation gates: schema → completeness → independent solve → one best answer or accepted numeric set → distractor and difficulty plausibility → duplication check against the corpus → provenance/status. At most two repair attempts; then offer approved bank content or a shorter quiz. No placeholder questions. Never call generated questions official. Unreviewed language generation does not affect skill estimates by default.

**Acceptance:** rejected candidates are never served; every delivered item has provenance and verification metadata; a seed plus pinned model/template versions reproduces an item; no evaluation item is used as a generation example; each enabled family passes the ≥98% audit gate (§13).

### FR-11 — Simple accessible interface

**P0.** Primary navigation: **Home, Practice, Tests, Progress.** Settings holds library/import, the Bluebook log (also reachable from Tests), model/device status, profiles, privacy, and About (licenses, review-model statement, trademark disclaimer). Ask the coach is contextual on practice and review screens.

- **Home:** one recommended action, continue session, next review date, next planned Bluebook test, days to target date.
- **Practice:** skill picker, session length, difficulty, source mix (official / original / generated), "Paste a question."
- **Tests:** official forms with role badge (§4.3 planner), exposure/retake status, import state, duration, scoring explanation; original diagnostic; paper answer entry; Bluebook log.
- **Progress:** skill map (FR-13) with list toggle, evidence counts, history, mistake review, next steps.
- **Skill page:** what it tests, prerequisites, lesson, real examples (reserved items hidden), recent mistakes, practice button.
- **Test screen:** large legible question/choice area, unobtrusive tools, navigation/review controls, predictable focus; no gamified interruptions.

Light/dark/system theme with a persistent setting, keyboard navigation, visible focus, screen-reader labels, 200% text zoom, and non-color status indicators. Target WCAG 2.2 AA. Imported renders stay readable in both themes on a neutral surface; tables have accessible structure; diagrams have text alternatives that do not disclose answers.

**Acceptance:** all core flows are keyboard-usable; no clipped formulas or choices at target window size and zoom; light and dark screenshots pass automated contrast checks and an AI visual review; calculator and modals do not trap focus; timer announcements are controllable; axe-core reports no serious violations on core screens.

### FR-12 — Distribution, privacy, and portability

**P0.** One self-contained installer per platform (macOS Apple Silicon, Windows x64) containing the application, runtime, default model, original content, math rendering, and offline calculator. An installer that downloads the required model on first use does not meet this requirement.

- **macOS:** signed with Developer ID and notarized; a `.pkg` (or equivalent) installs the app and places the model payload outside the app bundle so app-only updates do not carry it.
- **Windows:** signed installer (NSIS/MSI) that bundles the **WebView2 runtime for offline installation** and installs the model payload to the app-data area.
- **Updates:** optional, explicit update checks; signed updates back up the database before migrating. **App updates must not re-download the model unless the model changed.**
- **Hosting:** GitHub release assets are limited to 2 GiB per file [S10]; see FR-08 and O-4.
- **Licensing:** Apache-2.0 for application code (subject to dependency compatibility); proposed CC BY 4.0 for original lessons and items (O-5); model terms documented separately (Gemma 4 artifact license file); imported College Board material is never redistributed. Ship an SBOM and third-party license notices.
- **Trademark:** "SAT" is a College Board registered trademark. Use a product name without it (O-1), a nominative tagline ("a study coach for the SAT®"), and a disclaimer that College Board is not affiliated with and does not endorse the product.
- **Privacy:** private data lives in the OS app-data directory with appropriate permissions. Logs exclude answers, chats, and source text by default. Portable profile export, backup/restore, and delete controls; warn before exporting private content; exclude source PDFs by default. No telemetry or automatic external requests; opening College Board pages happens only when the student clicks.

**Acceptance:** install and first run on clean offline macOS and Windows machines succeed; uninstall documents retain/delete data choices; export restoration is tested; public repository scans find no private files or student data; release manifests include dependency and model licenses and checksums; an app-only update leaves the model untouched.

### FR-13 — Skill map (headline)

**P0.** The default Progress view. An equivalent **list view** (same data and statuses, real tree semantics) is one toggle away and is the screen-reader path.

**Layout:** deterministic, not force-directed. Two regions (Reading and Writing, Math); each domain is a labeled band; each of the 29 skills is a tile sized by approximate domain weight. Expanding a skill reveals its question types. Prerequisite edges are hidden by default and drawn only for the focused node (incoming prerequisites, outgoing dependents).

**Encoding:** each tile shows status by fill **plus** an icon/pattern **plus** a text label (Not enough evidence / Needs practice / Developing / Progressing / Consistent), an evidence-count badge, and recency (de-emphasized when evidence is older than 30 days). A coverage overlay shows available items per skill by source.

**Interaction:** click or Enter on a tile opens a side panel: what it tests, estimate with sample size and difficulty mix, last practiced, prerequisite statuses, common mistakes, strategies, lesson, real examples (with exposure badges; reserved items never shown), the student's attempts on this skill, and a Practice button. Arrow keys move between tiles within a region, Tab moves between regions, Escape closes the panel.

**Overlays (toggle):** My evidence (default), Coverage, Recent mistakes, Recommended (highlights the top recommendation and draws the "why" path: missed question → type → skill → prerequisite → lesson → next practice, with the ranking components).

**Filters:** section, domain, status.

**Acceptance:** every approved item's primary type is reachable from the map; map and list show identical statuses; keyboard-only users can complete "find the weakest skill → open it → start practice"; status never relies on color alone; both themes pass contrast checks; at 200% zoom the map remains usable (it scrolls inside its container without page-level horizontal scroll); the map renders in ≤100 ms p95 for the seed ontology.

### FR-14 — Bluebook log

**P0.** Per profile, one row per Bluebook practice test (4–11):
- taken (yes/no), date (optional), total score (400–1600), section scores (200–800 each), optional domain performance as shown on the score report, stored as filled/total segments per domain;
- validation: score ranges; warn (do not block) when section scores do not sum to the total.

Effects: marks the matching paper form `taken_in_bluebook` (exposure `possibly_seen_bluebook` with the entered date) and updates the form budget; adds a separate "Bluebook (official adaptive practice, self-reported)" series to score history; domain bands order the diagnostic queue. Bluebook data never counts as skill evidence and is never mapped to items by number.

The Tests screen suggests when to take the next Bluebook test and which reserved form, with a button that opens Bluebook guidance in the browser.

**Acceptance:** logging a test changes that form's role and exposure immediately; deleting the entry reverts both unless the student has since seen the form in the app; Bluebook and in-app paper scores are never plotted on the same series.

### FR-15 — Ask the coach

**P0.**
- **Entry points:** practice item, review item, lesson checkpoint, and "Paste a question" in Practice. Never available in strict tests.
- **Inputs:** a bank item; pasted text; an image (screenshot or PDF crop) → transcription → confirmation, always required for images and whenever transcription confidence is low.
- **Actions:** Hint (levels 1–4), Explain, Check my answer, Try a similar question.
- **Follow-up chat (D-11):** up to 6 turns per item thread (configurable). Scope is the current item, its skill lesson, its official explanation, and the student's attempt. Off-topic messages get a short redirect. Every reply carries the item's verification status. Follow-ups cannot change an official key.
- **Evidence rules:** any hint or explanation viewed before answering marks the attempt assisted (not eligible as evidence).
- **Safety of inventory:** the coach never retrieves reserved items, and "Try a similar question" draws from the same eligible sources as practice.
- **Mechanics:** structured output validated against a schema, then rendered; streaming first token; visible Cancel.

**Acceptance:** a scripted session exercises all four actions and 6 follow-ups on an official, an original, and a pasted item; off-topic prompts are redirected; reserved-item leakage tests pass; latency gates in §13 are met.

## 8. Architecture and technology defaults

These are proposed defaults recorded as ADRs in M1; each is replaceable if a spike fails. None is a tested dependency yet unless noted.

| Concern | Default | License | Notes |
|---|---|---|---|
| Desktop shell | Tauri 2 | MIT / Apache-2.0 | Rust core, system webview; WebView2 bundled for offline Windows install |
| UI | React + TypeScript | MIT | The M0 web prototype uses React 19 and esbuild; port into the Tauri frontend |
| Database | SQLite (bundled) via rusqlite; migrations with refinery | MIT / public domain | WAL mode, `foreign_keys=ON`, transactional writes |
| Search | SQLite FTS5 | public domain | Optional bundled embedding index later |
| PDF render and text | PDFium via pdfium-render | BSD-3 / Apache-2.0 / MIT | **Avoid MuPDF / PyMuPDF (AGPL)** |
| OCR fallback | Tesseract | Apache-2.0 | Only for images or pages without a text layer |
| LLM runtime | llama.cpp (`llama-server` sidecar) [S8] | MIT | 127.0.0.1, random port, per-launch token; Metal on macOS, Vulkan/CPU on Windows (spike) |
| Model | Gemma 4 GGUF (E4B default candidate) | Apache-2.0 per release notes — verify artifact | §FR-08 |
| Symbolic verification | SymPy in a bundled Python sidecar (python-build-standalone), JSON allowlisted ops over stdio | BSD / PSF | No arbitrary code; per-call timeout and memory limit. Alternative: Pyodide in a worker |
| Calculator | In-house: math.js parser + canvas plotter (expressions, plots, roots, intersections, tables, zoom) | Apache-2.0 | Not Desmos; a web iframe fails the offline requirement |
| Math rendering | KaTeX | MIT | Original and generated items |
| Map rendering | SVG with deterministic layout (d3-hierarchy / d3-scale helpers) | ISC | No force simulation |
| Testing | cargo test, Vitest or node:test, Playwright (incl. Tauri driver), axe-core | MIT / Apache-2.0 / MPL-2.0 | |
| Packaging | Tauri bundler + `.pkg` (macOS) / NSIS (Windows) with a separate model payload | — | §FR-12 |

### Process model

```
Webview UI (React)
   │ typed Tauri commands / events
Rust core ──┬─ Repository (SQLite)          ── owns all writes
            ├─ Test engine + timers + grader ── deterministic; owns attempt state
            ├─ Import worker (thread)        ── archive → PDF → manifests/pipeline
            ├─ Evidence + planner            ── evidence, ranking, form budget, reviews
            ├─ Ontology service              ── versioned graph, map data
            ├─ AI orchestrator (single queue)─┬─ llama-server sidecar (127.0.0.1 + token)
            │                                 └─ verify sidecar (SymPy, stdio, allowlisted ops)
            └─ Backup/export service
```

AI workers return proposals; they never mutate grades, attempts, or official content. The deterministic services own grading and timers.

### Repository layout

```
/apps/desktop             Tauri app (src-tauri = Rust, src = React UI ported from the M0 prototype)
/crates/core              domain types, repository, migrations
/crates/engine            test engine, timers, grading, score conversion
/crates/import            archives, PDFium, segmentation, manifests, Question Bank parser
/crates/evidence          evidence model, ranking, planner, review schedule
/crates/coach             AI orchestration, retrieval, prompts, JSON schemas
/sidecars/verify          Python SymPy op server
/content/ontology         seed + migrations
/content/lessons          original lessons (Markdown + front matter)
/content/bank             original items (JSON)
/content/generators       template families, annotated sentence banks
/manifests/official       content-free form manifests
/tools/content-pipeline   build-time authoring and review CLI (may call cloud models; never shipped)
/eval                     harness, public original fixtures; private-eval runner reads local paths (gitignored)
/docs/adr                 architecture decision records
```

## 9. Data model

SQLite with migrations, foreign keys, and transactional writes. Large source, media, and model files live in managed folders referenced by hash.

| Entity | Required fields / relationships |
|---|---|
| Profile | id, nickname, optional goals and preferences, classroom-course flag, focus skills, created_at |
| SourceDocument | id, hash, private path, kind (paper_test / scoring_guide / explanations / qb_export / teaching / unknown), title, edition, rights status, manifest_id? |
| Manifest | id, form_id, version, file hashes, salt, digest set, review summary |
| SourceOccurrence | source_id, page/slide, bounding boxes, original locator, form/branch, canonical question_id, match status |
| QuestionVersion | stable question_id, version, origin (official_paper / official_qb / original / generated / teaching), section, blocks/assets, render mode (source_render / native), text-view status, response spec, primary type, secondary tags, difficulty + source, provenance, publication state |
| AnswerKey | question_version, accepted choices/values, grading rule, source occurrence, digest-verified flag |
| OfficialExplanation | question_version, source occurrence, locator, local extracted text |
| OntologyNode / OntologyEdge | stable id, version, kind, definition, aliases; typed links; migration history |
| Lesson / Strategy | id/version, type links, prerequisites, content blocks, provenance, applicability |
| Form | form_id, number, module counts, printed timing, scoring_table_id |
| FormRole | profile, form, role, changed_at, history |
| ScoringTable | form_id, version, rows (raw → lower/upper per section), digest |
| TestManifest | form/mode/version, ordered modules and item versions, timing, scoring-table id |
| Attempt / ModuleAttempt | profile, manifest snapshot, mode, start/deadline/end, state, flags (interrupted, clock_anomaly, ended_early, retake, self_entered), practice settings |
| ResponseEvent | attempt, question version, sequence, raw/normalized answer, active time, flag/hint/explanation exposure, confidence, committed timestamp |
| Annotation | attempt, question version, highlights, eliminations |
| GradingRevision | response, key version, outcome, score/conversion version, previous revision |
| Exposure | profile, canonical item, level, source, first_at |
| SkillEvidence | profile, skill/version, eligible response IDs, estimate/count/difficulty mix, possibly-seen count, last updated |
| PracticePlan / PracticeSession / ReviewSchedule | profile, policy version, priorities, session items and source mix, due dates and intervals |
| BluebookResult | profile, test number, date?, total?, rw?, math?, domain bands (filled/total), entered_at |
| ReviewRecord | target (kind, id, version), stage (build/runtime), reviewer model/version, rubric version, input ids, verdict, reason codes, at |
| ProblemReport | profile, target, kind, comment, status, at |
| AIArtifact | task, model/runtime/prompt versions, retrieved source ids, payload, checks, status, error |
| CoachThread / CoachMessage | profile, item ref, turns (≤6 follow-ups), verification status per reply |

Persist answer state before showing "Saved." Attempt manifests are immutable; grading revisions are append-only. All analytics can be rebuilt from stored events and versions. Content deletion flags affected historical explanations instead of breaking links; profile deletion removes that profile's records.

## 10. State machines

**Attempt:** `created → in_progress(module i) → [on_break] → in_progress(module i+1) → … → completed → graded`. Flags: `interrupted` (resumed after crash/close), `clock_anomaly`, `ended_early` (student confirms "End test"; remaining modules submit as-is), `retake`, `self_entered`.

**Module:** `not_started → active → submitted | expired → locked`. Submission is idempotent on (attempt_id, module_index, submit_token). Expiry autosubmits once. On resume, remaining time = deadline_utc − now; if the wall clock moved backward past the last checkpoint, flag `clock_anomaly` and use the checkpoint-based remaining time.

**Item publication:** `draft → checked → approved` or `→ quarantined`. `approved → quarantined` on a key revision or a "wrong answer" problem report (per profile hide, global re-verification). `quarantined → checked` after re-verification passes.

**Import job:** `queued → expanding → identifying → extracting → segmenting → matching → classifying → reviewing → done | partial | failed`. `partial` lists quarantined items and reasons in the import report.

**AI job:** `queued → running → validating → done | failed | cancelled`; up to 2 repair attempts from `validating` back to `running`.

## 11. Command API (UI → core)

Typed commands; all return `Result<T, AppError>`. Events: `import_progress`, `module_expired`, `ai_job_progress`, `backup_done`.

| Area | Commands |
|---|---|
| Profiles | `list_profiles()`, `create_profile(input)`, `switch_profile(id)`, `update_profile(id, patch)`, `delete_profile(id, confirm)`, `export_profile(id, {include_private})`, `import_profile(path)` |
| Library | `import_files(paths) → job_id`, `get_import_report(job_id)`, `list_forms()`, `get_form_budget()`, `propose_form_budget()`, `set_form_role(form, role)` |
| Bluebook | `log_bluebook_result(input)`, `list_bluebook_results()`, `delete_bluebook_result(id)` |
| Tests | `start_attempt({mode, test_or_form_id, settings})`, `get_attempt(id)`, `save_response({attempt_id, item_version_id, raw, flags, client_seq})`, `save_annotation(...)`, `submit_module({attempt_id, module_index, submit_token})`, `resume_attempt(id)`, `end_attempt_early(id)`, `enter_paper_answers({form_id, modules})`, `grade_attempt(id)`, `get_attempt_report(id)`, `set_miss_reason(attempt_id, item_id, reason)` |
| Practice | `recommend_session()`, `start_practice({skill_ids, length, difficulty, sources})`, `answer_practice_item(...)`, `complete_practice(id)`, `schedule_review(skill_id, interval)`, `mark_remembered(item_id)` |
| Ontology / map | `get_ontology(version)`, `get_skill_map({overlay, filters})`, `get_skill_detail(skill_id)`, `get_type_detail(type_id)`, `explain_recommendation(rec_id)` |
| Coach | `transcribe_input({text \| image})`, `confirm_transcription(id, edits)`, `coach_hint({item_ref, level})`, `coach_explain(item_ref)`, `coach_check_answer(item_ref, raw)`, `coach_follow_up(thread_id, message)`, `coach_try_similar(item_ref)`, `cancel_ai_job(job_id)` |
| Generation | `generate_quiz({skill_id, count, difficulty, seed?})`, `get_generation_coverage()` |
| Feedback | `report_problem({target, kind, comment})`, `export_problem_reports()` |
| Settings | `get_settings()`, `update_settings(patch)`, `get_device_status()`, `get_model_status()`, `backup_now()`, `restore_backup(path)` |

## 12. AI task contracts

Every task uses a versioned prompt template and a JSON schema; invalid output is rejected and retried within the repair limit.

| Task | Input | Output (schema fields) |
|---|---|---|
| `classify_item` | structured item, ontology slice | primary_type_id, secondary_skill_ids, format_tags, confidence, rationale |
| `solve_item` | structured item (no key) | answer, steps, evidence_spans or verification_plan |
| `explain_item` | item, key, official explanation?, lesson, student response | answer_summary, steps, check, why_wrong{choice→text}, takeaway, cited_spans |
| `hint` | item, level (1–3; level 4, the full solution, uses `explain_item`), student state | hint_text, level |
| `follow_up` | thread (≤6 turns), item, lesson, official explanation | reply, on_topic (bool), verification_status |
| `transcribe_image` | image | blocks (text, math, table), choices, confidence per block, unreadable_regions |
| `word_generated_item` | template output (answer fixed), style constraints | prompt, choices (text only; order and key fixed by code) |
| `verification_plan` | item, candidate answer | ops: list of allowlisted operations |
| `review_item` (runtime) | item, key, solver output, rubric | verdict (pass/fail/abstain), reason_codes, notes |

**Allowlisted verification operations** (SymPy sidecar): `parse_expr`, `simplify_equal(a, b, assumptions)`, `solve(eq, var, domain)`, `substitute(expr, values)`, `evaluate_numeric(expr, values, precision)`, `check_domain(expr, values)`, `compare_rational(a, b)`, `count_solutions(system, domain)`, `stats(values, measure)`, `unit_convert(value, from, to)`. Each call has a time and memory limit; no other code runs.

## 13. Nonfunctional requirements and evaluation gates

Targets are proposed release gates, not measured claims. Each gate states what it is measured against.

| Area | Gate | Measured against |
|---|---|---|
| Offline | Full install → import → test → review → AI practice flow with network disabled; zero attempted outbound requests | Network-sandboxed E2E run |
| UI | Navigation/answer selection p95 < 100 ms; committed save p95 < 250 ms; UI never waits on inference | Instrumented E2E |
| Reliability | No lost committed response in 100 forced-stop/restart trials; idempotent submission and import | Fault-injection suite |
| AI latency | On declared 16 GB reference devices: first useful output p95 ≤ 10 s; short verified explanation ≤ 60 s; publish model/quantization/hardware | Benchmark harness |
| Low memory | 8 GB devices tested as a candidate reduced tier; no swap spiral or crash; non-AI features stay usable | Benchmark harness |
| Content fidelity | 100% of activated official items have digest-verified keys and extraction; every rendered figure/table item passes automated render checks and AI visual review | Manifests + import report |
| Classification | ≥95% primary-skill accuracy on a held-out set; report per domain and abstentions | **Official Question Bank skill tags** (skill level); AI-consensus labels for types, reported separately |
| AI answer quality | ≥95% accuracy on answered in-scope held-out items with ≥80% coverage overall and per section; publish counts, domains, uncertainty intervals | **Official answer keys** |
| Verification | No known false "tool checked" outcome in the release adversarial suite; any failure blocks release | Adversarial suite (original items) |
| Teaching quality | ≥90% of sampled explanations and lessons pass the rubric (correct, evidence-supported, understandable, aligned) | **Independent AI reviewer rubric**; rubric and reviewer model published |
| Generated practice | ≥98% valid, unique-best-answer rate per enabled family on ≥100 audited served items | Deterministic checks + independent AI solvers agreeing without the key |
| Accessibility | WCAG 2.2 AA target; no serious axe-core violations on core screens; keyboard-only E2E passes | Automated tooling + AI review of screenshots and the accessibility tree |

**Evaluation sets.** ≥200 official items with official keys spanning all eight domains (≥20 per domain), drawn locally from forms and Question Bank exports, split by canonical content and near duplicates; ≥50 adversarial/ambiguous original items; ≥100 audited items per enabled generator family. Official items are evaluated only on maintainer machines; only aggregate metrics and item IDs are published. Public CI uses original fixtures. Report abstention, coverage, wrong confident answers, and latency alongside accuracy so a system cannot pass by refusing hard questions. No evaluation item is used as a generation example or few-shot prompt.

## 14. Milestones

Each milestone delivers a working user flow, automated checks, and a short record of remaining gaps. No mock responses in release builds.

| Milestone | Scope | Demo script | Exit criteria |
|---|---|---|---|
| **M0 web prototype** (exists) | React web build at `app/`: ontology seed (8 domains, 29 skills), original items and lessons, original quick diagnostic, test engine (timed modules, flags, elimination, review grid, module lock), deterministic grading, evidence model, recommendations, skill map + list, practice sessions with hints/explanations, Bluebook log, form budget | Open the build → onboard → take the diagnostic → see results by skill → open the map → start recommended practice → log a Bluebook test and see the form budget update | Builds offline; unit tests pass for grading, evidence, ranking; core flow keyboard-usable |
| **M1 Desktop foundation** | Tauri 2 shell around the M0 UI; SQLite repository replacing local storage; migrations; ADRs; license inventory; private-data ignore rules; CI on macOS and Windows | Install dev build, create profile, quit/relaunch, data persists | Repository tests; CI green on both platforms |
| **M2 Official content slice** | PDFium extraction; Test 10 manifest; generic pipeline; per-block render + text layer + Text view; in-app paper replay and paper answer entry; range scoring; official explanations | Drop the Test 10 bundle → form activates → take Module 1 → results with range → open official explanation | Digest verification passes; conversion table verified row by row; fake-clock timer suite passes |
| **M3 All forms + Question Bank** | Manifests for forms 4–11; Question Bank export parser; dedup and exposure across sources; maintainer tooling (preview, optional override; never a gate) | Import all eight bundles and a 100-item Question Bank export → import report clean | All eight forms activate with zero manual steps; QB tags preserved; no leaks of reserved items |
| **M4 Original content at scale** | Build-time content pipeline; 29 lessons; ≥20 original items per skill; review records; problem reports | Browse any skill → lesson → original practice with "reviewed by automated checks" basis | Rubric gate ≥90%; every item has a ReviewRecord |
| **M5 Local coach** | Model/runtime spike and selection; sidecar; retrieval; hint ladder; explanations; follow-ups; verification sidecar; image transcription | Ask for a hint, explanation, 6 follow-ups and a similar question, offline | AI latency, answer-quality, and verification gates measured and reported |
| **M6 Generation** | v1 math families end to end; bounded R&W families; coverage display; audits | Generate a 10-item percent quiz with seed reproduction | ≥98% audit gate per enabled family |
| **M7 Release** | Signed/notarized macOS and signed Windows installers with model payload and WebView2; update path; accessibility, security, license, content, and quality gates; docs | Clean offline install on both platforms → full definition-of-done flow | All §13 gates pass; owner actions O-1–O-7 complete (O-4 only if needed) |

### Definition of done (public v1)

A student can install one package on macOS or Windows, import their official practice bundles and Question Bank exports, plan their forms around Bluebook, take and resume a local paper replay or enter paper answers, receive correct form-specific results, inspect missed questions by skill on the map, complete a short lesson and targeted practice, ask the local coach for an explained answer with a verification status, log Bluebook scores, and see updated progress across sessions — offline, in both themes, with private content kept local and every §13 gate passing.

## 15. Owner actions and open decisions

These cannot be done by a coding agent. None blocks M0; each is needed by the milestone shown.

| # | Action | Needed by | Default / recommendation |
|---|---|---|---|
| O-1 | Choose a product name without "SAT" (College Board trademark); tagline "a study coach for the SAT®" plus non-affiliation disclaimer | Before the public repo is announced | Keep "Open SAT Coach" as an internal codename only |
| O-2 | Apple Developer Program membership (Developer ID Application + Installer certificates, notarization) | M7 | Required for macOS distribution |
| O-3 | Windows code signing (e.g., Azure Trusted Signing or an OV/EV certificate) | M7 | Required to avoid SmartScreen blocks |
| O-4 | Download host if the installer exceeds GitHub's 2 GiB per-asset limit | After the M5 model spike | Prefer a model/quantization that fits; otherwise a host such as Hugging Face or object storage with published checksums |
| O-5 | Content license for original lessons and items | M4 | CC BY 4.0 (code stays Apache-2.0) |
| O-6 | Build-time AI budget and API keys for the content pipeline (maintainer-owned, never shipped) | M3–M4 | Modest; measure in M4 |
| O-7 | GitHub organization/repository, security contact, issue template for sanitized problem reports | M1 | — |

Decisions to validate during implementation (defaults permit work to start):

| Decision | Default / validation task |
|---|---|
| Platforms | macOS Apple Silicon and Windows x64 for v1; confirm minimum OS versions in the packaging spike |
| Model | Gemma 4 E4B candidate; select by quality, license, memory, latency, image support, and installer size |
| Teaching rights | Private local import only; public curriculum is original |
| Adaptive tests | Not built; Bluebook is the adaptive path (D-3) |
| Calculator | In-house offline calculator; no Desmos parity claim |
| Generation coverage | §FR-10 families; gaps served by official and original items |
| Score prediction | Excluded until separately calibrated; the goal score is planning metadata only |

## 16. References

Checked October 18, 2026. Revalidate test-format rules and selected dependency/model terms before release.

- **S1 — SAT structure:** https://satsuite.collegeboard.org/sat/whats-on-the-test/structure
- **S2 — Official paper practice tests (same tests as Bluebook; answer explanations included):** https://satsuite.collegeboard.org/practice/practice-tests/paper
- **S3 — Score calculation and adaptivity:** https://satsuite.collegeboard.org/scores/what-scores-mean/how-scores-calculated
- **S4 — Content domains and skills:** https://satsuite.collegeboard.org/practice/content-domains
- **S5 — Math specifications:** https://satsuite.collegeboard.org/k12-educators/about/alignment/math
- **S6 — Gemma releases (Gemma 4: E2B, E4B, 26B A4B, 31B — March 31, 2026; 12B — June 3, 2026; Apache-2.0 license link):** https://ai.google.dev/gemma/docs/releases
- **S7 — Gemma terms of use (older Gemma generations):** https://ai.google.dev/gemma/terms/
- **S8 — llama.cpp:** https://github.com/ggml-org/llama.cpp
- **S9 — SAT Suite Educator Question Bank overview (free, no sign-in, export with rationales):** https://satsuite.collegeboard.org/k12-educators/tools-resources/question-bank/overview
- **S10 — GitHub releases (2 GiB per-file limit):** https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

The product defaults, evidence formula, ranking weights, review schedule, form budget, architecture, and evaluation targets are proposed design decisions, not claims made by these sources. Question Bank size figures come from a third-party summary and must be verified against real exports.
