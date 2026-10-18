# Open SAT Coach — Product Requirements Document

Version 1.0 · October 18, 2026 · Status: ready for implementation planning

## 1. Product intent

Build an open-source desktop SAT coach that works locally, simulates test conditions, identifies precisely what a student needs to practice, and teaches those skills with short, understandable explanations. The core loop is **test → diagnose → learn → targeted practice → fresh reassessment**. AI supports this loop; reliable testing, grading, records, and retrieval must work independently of model availability.

Primary user: a high-school student studying independently on a personal laptop. Secondary user: a tutor helping a student review their results on that device. The first release is a personal study application, not a school administration system.

The requested “ontological map” means a versioned network connecting official SAT domains, skills, finer question types, prerequisites, misconceptions, strategies, lessons, actual source questions, and individual student attempts. It must explain both **what a question tests** and **why it is recommended for this student**.

### Product commitments

1. Use locally imported real practice questions, preserving their original content and provenance.
2. Distinguish official paper practice from a locally assembled digital-format simulation.
3. Save every attempt and map mistakes to specific skills without pretending one mistake proves a misconception.
4. Run tutoring and quiz generation on a bundled local model, with Gemma the preferred candidate subject to evaluation.
5. Ship one self-contained application download per supported operating system/architecture, including the default model and runtime.
6. Accept questions across the SAT curriculum and provide evidence-backed solutions; explicitly acknowledge uncertainty instead of guaranteeing universal correctness.
7. Offer a quiet, simple interface with light, dark, and system themes.

## 2. Evidence from the supplied materials

The Downloads folder contains one teaching archive with 26 files and eight practice bundles, tests 4–11, containing 24 PDFs. See [SOURCE_REVIEW.md](SOURCE_REVIEW.md) for the inventory, review scope, source issues, and implementation implications. Original archives remain untouched.

The teaching archive includes teacher/student guides, technology guidance, eight-hour course outlines, example slides, and example-question documents. Its useful instructional structure is strategy explanation followed by worked examples, student practice, and reflection. Convert that pattern into brief individual learning sessions rather than reproducing a classroom course or its proprietary wording.

### Findings that change the implementation

- **The downloaded full tests are paper/nonadaptive forms.** Test 10, for example, contains 33 questions per Reading and Writing module and 27 per Math module. The real digital format has 27 and 22 respectively. The official paper page confirms these PDFs are nonadaptive [S1, S2]. Do not truncate them and call the result the actual digital SAT.
- **Paper scores are ranges.** The supplied Test 10 and 11 scoring guides provide lower/upper section conversions. Preserve the form-specific conversion, including ranges; do not invent a precise digital score.
- **Teaching labels mix different concepts.** “Poetry” describes a passage genre; calculator use describes a strategy; “grammar” groups more than one official skill. These belong on separate ontology axes.
- **Example references need validation.** A Test 7 example document contains a “Module 8” reference; the Test 10 slide deck also references Tests 9 and 6. Preserve original labels as provenance, flag questionable references, and establish identity from content plus form metadata.
- **Some heuristics need qualification.** A single numerical substitution does not prove two expressions equivalent, and an unusual-looking answer is not automatically wrong. Teach shortcuts with conditions and verify mathematically or textually.
- **The curriculum is a private input, not an assumed public content license.** The teacher guide explicitly reserves reproduction rights. Publish original app code and independently authored lessons; keep these source files and derived question packs out of public repositories unless redistribution permission is documented.

## 3. Scope, defaults, and explicit limitations

### Release scope

| Stage | Required outcome |
|---|---|
| Internal vertical slice | One imported full paper form; question review; deterministic grading; local profile; skill diagnosis; one verified math tutoring flow |
| MVP | All supplied paper bundles supported; complete eight-domain ontology; full local testing and history; targeted selection from reviewed questions; local explanations and constrained generation; light/dark UI; self-contained macOS Apple Silicon installer |
| v1 public release | Windows x64 installer; supported-hardware benchmarks; accessibility review; audited original starter content; digital-format rehearsal with transparent local routing; security and license checks |
| Later | Linux packaging, richer image understanding, broader generation templates, optional additional model packs, tutor workflows and opt-in sync |

The seven user requirements are the v1 target. Stage names must not be used to silently drop a requirement. Desktop platform order is a planning assumption because the current workspace is on macOS; Windows support is part of the intended public product.

### Exclusions

No official test administration, College Board login, Bluebook scraping, reverse engineering of proprietary scoring/routing, remote proctoring, social leaderboard, admissions advice engine, mandatory account, subscription, cloud inference, or required external model server. Mobile and Chromebook delivery are outside v1.

### Fidelity contract

The application reproduces documented timing, module boundaries, navigation, and study tools where feasible. It cannot claim to reproduce undisclosed College Board routing or IRT scoring [S3]. “Official question,” “official paper form,” and “digital-format rehearsal” are separate labels. An open-source offline graphing calculator may differ from Desmos; show that limitation in the rehearsal information screen.

## 4. Student journeys

### A. First use

Launch → choose local nickname → optional target date and score goal → confirm theme and accessibility settings → device/model readiness check → optional import of practice ZIPs → preview import report → take a test or begin a short diagnostic. The public package includes original starter questions so first use does not depend on private materials. No terminal, Python, Ollama, Docker, or API key is required.

### B. Test and diagnose

Choose a form → see format, timing, previous exposure, and scoring limitations → complete modules → see result summary → review missed and uncertain questions by skill → choose a recommended 10–20 minute session. Hints and answers are unavailable during strict testing.

### C. Targeted practice

Open a weak skill → read a 2–4 minute lesson → attempt a worked-example checkpoint → answer 5–10 fresh questions → review errors → schedule a later check using different questions. Student can choose another skill, length, or difficulty.

### D. Ask the coach

Select a bank question, paste text, or import an image/PDF crop → confirm any uncertain transcription → receive a hint or full explanation → inspect evidence/checks → try a related question. Clarify unreadable notation or missing diagrams before solving. Requests outside supported verification coverage receive a clear uncertainty status.

## 5. Functional requirements and acceptance criteria

### FR-01 — Content ingestion and curation

**P0.** Support supplied practice ZIP/PDF bundles first. Teaching DOCX/PPTX/PDF imports are supporting reference material; XLSX course outlines inform this PRD and need not be a runtime import feature.

Import pipeline: safe archive expansion → file hash and inventory → PDF text/layout extraction → local OCR only where necessary → question segmentation → image/diagram capture → answer-key and explanation matching → ontology suggestions → review → activation.

- Retain original files in private app storage, immutable hashes, source page/crop coordinates, attribution, and import version.
- Preserve equations, superscripts, italics, underlined spans, tables, graph axes, units, and passage/choice order. A plain-text extraction is not sufficient.
- Recognize section/module/question numbers and distinguish paper and adaptive examples. Module 2 branch may be unknown; never infer a unique identity from test number and question number alone.
- Show a side-by-side source preview and structured question preview. Flag missing choices, garbled mathematics, unresolved key mappings, ambiguous branches, and conflicting duplicates.
- Deduplicate by exact file/content hashes; surface near matches for review. Different source occurrences may point to the same canonical item.
- Never have an LLM invent a missing official answer key. Unresolved items remain quarantined.
- Import the entire form as a unit for official paper scoring. Partial imports may be used for practice but cannot receive full-form score conversion.
- Publication state: `draft → needs_review → approved` or `rejected`. Approval requires content integrity, valid answer, source match, primary skill, and assets; AI classification alone does not approve an item.

**Acceptance:** repeated import is idempotent; corrupt archives fail safely; all eight bundles have import reports; every activated form matches its verified module counts; all answer mappings are reviewed against its scoring PDF. No missing image or key silently passes. Private materials never appear in release bundles or public test fixtures.

### FR-02 — Local test engine

**P0 paper replay; P1 digital rehearsal.** Implement three explicit modes:

| Mode | Composition | Timing | Scoring |
|---|---|---|---|
| Official paper-form replay | Full imported form, original order/counts | Use authoritative timing if supplied; otherwise untimed or user-configured, visibly labeled | Exact form-specific official paper conversion/range |
| Digital-format rehearsal | Curated local assembly; 2×27 R&W and 2×22 Math | 32/32/35/35 minutes; 10-minute section break | Raw accuracy and skill report; no official scaled score |
| Skill practice | Selected or generated items | Untimed default; optional practice timer | Practice accuracy, assistance status, skill evidence |

The digital format totals 134 working minutes and 98 questions [S1]. Rehearsal assembly requires an approved blueprint with domain coverage, difficulty mix, ordering, no duplicate items, and sufficient unseen items. If inventory cannot satisfy it, explain the shortage and offer another mode; do not silently reuse items.

For local adaptive rehearsal, prepare a mixed Module 1 and two Module 2 branches per section. A proposed initial routing rule is at least 70% correct to the higher-difficulty branch; this is a configurable **app heuristic**, not College Board's threshold. Freeze the manifest, threshold, item versions, and routing version when an attempt starts. Routing uses finalized Module 1 responses and occurs only at the module boundary. Validate the blueprint and rule before release; do not suggest that the route predicts an official score.

Required controls: question navigation within current module, review grid, unanswered/flagged markers, answer elimination, text highlight, zoom, show/hide timer, directions, formula reference, and graphing/scientific calculator in Math. Autosave answer changes and annotations. Finishing a module locks it; later modules cannot reopen it. No AI, hint, answer key, or lesson access in strict testing.

Timer behavior: monotonic elapsed time during execution; persistent deadline and suspend/crash accounting across restarts. Sleep or closing the app does not pause strict testing. Expired module autosubmits once. A crash-recovered test is marked interrupted. Practice mode may pause and resume. Extended-time/custom-break settings are chosen before starting and stored with the attempt; label them as practice settings, not accommodation approval.

**Acceptance:** fake-clock tests cover expiry, sleep, early submission, restart, time changes, break transitions, and double-submit. Completing a test in airplane mode works. Saved responses survive forced termination; expired modules cannot gain time by relaunching. Unanswered responses are distinct from wrong answers in reports, though neither earns a correct-answer point.

### FR-03 — Deterministic grading

**P0.** Grade approved official items against imported keys, never model opinion. Store raw and normalized responses. MCQ uses stable choice IDs. Numeric answers support accepted fractions/decimals, negative signs, and item-specific accepted alternatives; follow the source's response conventions. Do not use a universal floating-point tolerance that accepts incorrect nearby answers.

Separate input-format validation from mathematical equivalence. An equivalent value that violates a strict response-format rule should produce the appropriate format feedback. Practice may explain a format correction without silently rewriting the submitted answer.

Score conversion references an immutable form ID and scoring-table version. Sum lower and upper section bounds separately where the guide specifies ranges. No conversion for modified forms, mixed quizzes, or digital rehearsal. Do not assign invented extra points to harder questions.

**Acceptance:** verify every row of each imported conversion table; tests cover zero/full scores, blank responses, numeric alternatives, invalid strings, fractions, rounding boundaries, and mismatched form IDs. Regrading after a corrected key creates a revision, preserves original results, and recomputes skill evidence reproducibly.

### FR-04 — Ontology and question classification

**P0.** Maintain a machine-readable, versioned ontology. A tree is useful for browsing, but relationships must support multiple tags and prerequisites.

Core hierarchy: `Section → Domain → Skill → QuestionType`. Additional entities: `Concept`, `Strategy`, `Misconception`, `Lesson`, `Question`, `SourceOccurrence`. Relations include `tests`, `requires`, `uses_strategy`, `may_reveal`, `taught_by`, `example_of`, and `same_item_as`. Prerequisite edges must be acyclic; aliases may be many-to-many.

Use official domains/skills as the backbone [S4, S5]. Fine-grained types below are product subdivisions, not claims of an official College Board taxonomy.

| Domain | Initial skills and example subtypes | What the student demonstrates |
|---|---|---|
| R&W: Information and Ideas | Central ideas/details; inference; textual evidence; quantitative evidence; support/weaken a claim | Identify meaning and justify a conclusion from supplied text/data |
| R&W: Craft and Structure | Words in context; text structure/purpose; function of a sentence; cross-text connections | Interpret language and explain how parts or viewpoints relate |
| R&W: Expression of Ideas | Rhetorical synthesis; transitions; notes-to-goal; comparison, contrast, cause, example | Select information or connections that accomplish a stated purpose |
| R&W: Standard English Conventions | Boundaries; form/structure/sense; clause joins, punctuation, agreement, tense, modifiers, possessives | Apply sentence and usage rules in context |
| Math: Algebra | Linear equations in one/two variables; linear functions; linear systems; linear inequalities | Create, solve, interpret, and connect linear representations |
| Math: Advanced Math | Equivalent expressions; nonlinear equations/systems; nonlinear functions; factoring, quadratics, exponentials, radicals, rational expressions | Use algebraic structure and nonlinear relationships |
| Math: Problem-Solving and Data Analysis | Ratios/rates/units; percentages; one-variable data; two-variable data; probability; sample inference/margin of error; study design/statistical claims | Reason quantitatively and interpret data and uncertainty |
| Math: Geometry and Trigonometry | Area/volume; lines/angles/triangles; right-triangle trig; circles | Use geometric relationships, measurement, and trigonometry |

Each type has stable ID, student-facing name, definition, inclusion/exclusion rules, observable cues, what it tests, prerequisites, common mistakes, strategies with applicability conditions, lesson links, and reviewed real-question references. Distinguish difficulty source (`official`, `expert_estimate`, `empirical`, `unknown`). Never portray LLM-estimated difficulty as calibrated.

Classify each question with one primary skill/type, optional secondary skills, and orthogonal format tags (MCQ/SPR, passage genre, chart, diagram). Maintain confidence, classifier version, reviewer, and review status. Low-confidence assignments appear in the curation queue. Official taxonomy and informal teaching aliases are separate fields.

**Acceptance:** every approved question resolves to an existing primary skill; an ontology migration preserves history and records remapping. The user can browse domain → skill → type → real examples → their attempts, with a plain-language “What this tests” description. The initial taxonomy covers all eight domains even where local content coverage is incomplete.

### FR-05 — Local student profile and evidence

**P0.** Multiple local profiles with explicit profile switching. Require only a nickname. Optional fields: target test date, score goal, weekly study time, preferred session duration, accessibility settings. No birth date, school, email, or College Board credentials required.

Persist attempt mode, form/version, timestamps, module route, timer settings, interruption status, per-question response/revisions, correctness, active viewing time, flags, hints, explanation exposure, previous exposure, and optional student confidence/reflection.

Reports distinguish wrong, omitted, correct-but-uncertain, correct-with-help, and repeated/exposed questions. The student can label why they missed an item: concept gap, misread, calculation, strategy choice, time, guessed, or unsure. Model suggestions are hypotheses until accepted; wrong answer alone does not prove a misconception.

Initial evidence model: keep a transparent recent performance estimate by primary skill and difficulty band. Use the latest 20 independent, first unassisted attempts on distinct items; `estimate = (correct + 1)/(eligible_count + 2)`. This is a smoothed practice estimate, not a calibrated mastery probability or SAT-score predictor. Unknown skills remain “Not enough evidence”; display sample count and last practiced date. Omitted items lower test accuracy but are recorded separately from concept evidence. A repeat does not add independent evidence. Secondary tags support navigation, not duplicate credit.

Suggested labels: fewer than 5 eligible items = insufficient evidence; otherwise below 60% = needs practice; 60–79% = developing; at least 80% = progressing. “Consistent” additionally requires at least 10 distinct items across 3 days and a successful delayed check. Display difficulty mix and evidence age; do not imply permanent mastery.

**Acceptance:** two profiles never share attempt data; a repeated memorized item cannot inflate independent evidence; profile deletion removes associated records and chats; export/import round-trips preserve IDs and versions. Charts show comparable modes separately.

### FR-06 — Targeted practice and study plan

**P0 curated selection; P1 constrained generation expansion.** Recommend a daily session with a visible reason, such as “You missed 3 of 5 fresh clause-boundary questions; practice joining complete sentences.”

Initial transparent ranking: for sufficiently observed skills, `priority = 0.50×(1−estimate) + 0.25×due + 0.15×recent_error_rate + 0.10×student_focus`, with each input in [0,1]. `due=1` when scheduled review is due, otherwise 0. Recent errors use the latest five eligible observations. Student focus is 1 only for explicitly selected focus skills. Unknown skills enter a separate diagnostic queue rather than being labeled weak. Prerequisite gaps may reorder the session with an explanation.

Default 10-question practice: 6 target-skill items, 2 prerequisites, 2 mixed retention items. Prefer unseen approved items, then scheduled distinct review items. Reserve at least two full forms for future diagnostics when possible; user controls reservation. Duplicate detection and exposure tracking apply across paper and teaching examples.

Offer a 1/3/7/14-day review schedule after successful practice; reset to an earlier interval after difficulty. This is a product heuristic. Students can override it. Do not infer a score-gain promise from the recommendation.

**Acceptance:** recommendations are reproducible from a stored policy version; no reserved item leaks through retrieval, hints, examples, or generation prompts; insufficient inventory produces a clear choice to reduce length, widen scope, or use labeled AI practice. A completed session ends with one actionable next step.

### FR-07 — Brief lessons and explanations

**P0.** Independently author starter lessons organized by skill. Use private teaching references only within the local user's context and keep provenance. Retrieval supplies the model with relevant approved lessons, question data, and evidence; fine-tuning is not required for v1.

Lesson format: skill objective → recognition cues → 3–5 steps → one worked example → common trap → one check-for-understanding. Target 2–4 minutes. Explain vocabulary and notation at roughly grades 8–10 without talking down to the student.

Question explanation format: answer → concise solution steps → evidence or mathematical check → why the selected wrong choice fails → reusable takeaway. R&W uses specific passage spans or chart cells and names the relevant rule where applicable. Math includes equations, units, domain restrictions, and substitution or another check. Offer conceptual and calculator approaches when both are valid; keep the shorter useful one first.

Progressive hints: identify the skill, suggest the next action, reveal a partial step, then full solution. Record hint use. Never treat lucky elimination or a single substitution as proof.

**Acceptance:** teacher review confirms clarity, correct prerequisites, and evidence support; explanations do not change the problem's meaning or rely on outside facts for passage questions; original lessons are distinguishable from private references and AI output.

### FR-08 — Local AI runtime

**P0.** Bundle a supported local inference runtime and a pinned quantized instruction model. Evaluate Gemma first; select a specific model/version only after offline SAT benchmarks and hardware tests. Google's current model catalog is a discovery source, not a reason to automatically select the newest/largest model [S6]. Model abstraction permits replacement without schema or UI changes.

Use bounded context, structured output schemas, retrieval limits, cancellation, resource monitoring, and one generation queue. Persist model identifier, file checksum, quantization, runtime version, prompt template version, tool results, and validation status with AI artifacts. Keep model files and runtime under app lifecycle management. No cloud fallback or content telemetry.

Task boundaries: classify draft items; retrieve lesson evidence; explain approved questions; propose bounded practice items; verify candidate answers with tools. The model cannot write grades, approve official content, access arbitrary files, execute arbitrary code, or make network calls. Mathematical tools expose allowlisted structured operations with time/resource limits.

**Acceptance:** clean-device install runs AI without developer tools; network-disabled end-to-end test passes; cancellation works; model failure preserves test/history/retrieval features; model replacement triggers benchmark regression checks before promotion.

### FR-09 — Explainable verification

**P0.** “Answer any SAT question” is a coverage aspiration, not a guarantee. Implement confidence in evidence, not model self-confidence.

Pipeline: validate transcription and required assets → classify → solve without exposing the answer key to the initial solver → verify → compare with trusted key if available → produce a short teaching explanation. A second pass by the same model is useful critique but not independent proof.

| Status | Evidence required | Student presentation |
|---|---|---|
| Key matched | Answer agrees with a reviewed official/source key | “Matches the answer key”; explanation validation shown separately |
| Tool checked | Appropriate symbolic/exact/numeric verification passes under explicit assumptions | “Checked mathematically” with the actual check |
| Evidence supported | Passage/rule/data evidence and option comparison pass a reviewed rubric | “Supported by the passage/rule”; do not imply mathematical certainty |
| Unverified | No sufficient independent support, missing context, or ambiguous item | Clearly provisional; ask for clarification or offer a reviewed alternative |
| Conflict | Key, tool, transcription, or model disagree | Withhold a confident answer; flag for review and explain the conflict |

Math verification: substitute all candidate solutions; reject extraneous roots; check denominator/domain constraints, units, answer uniqueness, and rounding. For expression equivalence use symbolic identity under stated assumptions when supported; multiple random examples alone are not proof. Geometry must use stated relationships, not unmarked pixel measurements.

R&W verification: identify the question's required task; link the supporting text or grammar rule; test every option for the relevant relation; flag two defensible answers. A model claiming that its own evidence is sufficient does not automatically earn the supported status. For new unconstrained R&W questions, keep provisional unless reviewed or covered by a validated rule/template.

**Acceptance:** adversarial evaluation includes wrong keys, OCR minus-sign errors, multiple valid answers, insufficient diagrams, near-equivalent expressions, and irrelevant passage evidence. Key match cannot mask an invalid explanation. Low-confidence/conflicting output must never silently overwrite an official answer or enter the approved quiz bank.

### FR-10 — Generated quizzes

**P0 limited validated templates; P1 broader coverage.** Begin with structured math templates and tightly bounded grammar/transition tasks. Other skills initially use curated items. The app must make supported generation coverage visible rather than claiming to generate every skill safely.

Generation input: skill/type, difficulty target, prerequisites, item count, output format, approved concept/strategy references, excluded/reserved item hashes, and seed. Generate original items, not cosmetic rewrites of official questions. Return structured prompt, choices, answer, solution, verification plan, and tags.

Validation gates: schema → content/asset completeness → solve independently → ensure one best answer or accepted numeric set → check distractors and difficulty plausibility → compare against source corpus for duplication → mark provenance/status. Math templates derive answers deterministically, then use the model for wording; validate again after wording. Unreviewed language-generation output remains experimental and does not affect independent skill estimates by default.

Allow at most two repair attempts; then offer approved bank content or a shorter quiz. A failed generation does not produce placeholder questions. Never call generated questions official SAT questions.

**Acceptance:** rejected candidates are not served; every delivered item has provenance and verification metadata; a seed and pinned model/template versions permit debugging; no release evaluation questions are used as generation examples.

### FR-11 — Simple accessible interface

**P0.** Primary navigation: Home, Practice, Tests, Progress. Library/import, model/device settings, profiles, and privacy live in Settings. Ask Coach is contextual on practice/review screens, not the main interface.

- Home: one recommended action, continue session, and next review date.
- Practice: skill picker, session length, difficulty, curated/generated label.
- Tests: format badge, exposure/reservation status, duration, readiness, and scoring explanation.
- Progress: skill list/heatmap, evidence count, history, mistake review, and next steps.
- Skill page: what it tests, prerequisites, lesson, actual examples, recent mistakes, practice button. Provide a browsable list first; an ontology graph is optional.
- Test screen: large legible question/choice area, unobtrusive tools, navigation/review controls, predictable focus. No gamified interruptions.

Light/dark/system theme, persistent setting, keyboard navigation, visible focus, screen-reader labels, 200% text zoom, and non-color status indicators. Target WCAG 2.2 AA. Keep imported diagrams readable in both themes; use a neutral image surface instead of blindly inverting source images. Tables need accessible structure and diagrams need reviewed text alternatives that do not disclose answers.

**Acceptance:** all core flows are keyboard usable; no clipped formulas or choices at target window size/zoom; light and dark screenshots are reviewed; calculator and modals do not trap focus; timer announcements are controllable.

### FR-12 — Distribution, privacy, and portability

**P0.** Deliver one self-contained installer per target platform containing the application, runtime, default model, original starter content, math rendering, and offline calculator. Model size may make the download several gigabytes; publish measured size and disk/RAM requirements. An installer that downloads the required model on first use does not meet this default offline-package requirement.

Keep optional larger models separate. Bundling is conditional on the selected model's license and distribution requirements; document model terms separately from the app's open-source license [S7]. Prefer Apache-2.0 for original application code, subject to dependency compatibility. Do not assume model weights or imported SAT questions inherit that license.

Private data is stored in the OS application-data directory with appropriate permissions. Logs exclude student answers/chats/source text by default. Provide portable profile export, backup/restore, and delete controls; warn before exporting private content and exclude source PDFs by default. No telemetry or automatic external requests. Optional update checks are explicit settings; signed updates preserve and back up databases before migration. Code signing/notarization is a release requirement on supported platforms.

**Acceptance:** install and first run on a clean offline machine succeed; uninstall choice for retaining/deleting data is documented; export restoration is tested; public repository scans find no private files or student data; artifact manifests include dependency/model licenses and checksums.

## 6. Data model and service boundaries

Use SQLite with migrations, foreign keys, and transactional writes. Large source/media/model files live in managed folders referenced by hash. A vector database is unnecessary initially; use local full-text search and optionally a bundled embedding index.

| Entity | Required fields/relationships |
|---|---|
| Profile | id, nickname, optional goals, preferences, created_at |
| SourceDocument | id, hash, private path, media type, title, edition, rights status |
| SourceOccurrence | source_id, page/slide, bounding box, original locator, form/branch, canonical question_id, match status |
| QuestionVersion | stable question_id, version, section, structured blocks/assets, choices/response spec, primary type, secondary tags, difficulty/source, provenance, review status |
| AnswerKey | question_version, accepted choices/values, grading rule, source occurrence, review status |
| OntologyNode/Edge | stable id, version, kind, definition, aliases; typed links and migration history |
| Lesson/Strategy | id/version, type links, prerequisites, content blocks, provenance, applicability |
| TestManifest | form/mode/version, ordered modules/item versions, timing, routing policy, scoring-table ID |
| Attempt/ModuleAttempt | profile, manifest snapshot, route, start/deadline/end, state, interruption and accommodations |
| ResponseEvent | attempt, question version, sequence, raw/normalized answer, active time, flag/hint/exposure, committed timestamp |
| GradingRevision | response, key version, outcome, score/conversion version, previous revision |
| SkillEvidence | profile, skill/version, eligible response IDs, estimate/count/difficulty mix, last updated |
| PracticePlan | profile, policy version, skill priorities, reserved forms, schedule, completed sessions |
| AIArtifact | task, model/runtime/prompt versions, retrieved source IDs, generated payload, checks, status, error |

Persist answer state before showing “Saved.” Use immutable attempt manifests and append-only grading revisions. All analytics can be rebuilt from stored events and versions. Content deletion must flag affected historical explanations rather than silently breaking links; profile deletion removes that profile's records.

Suggested architecture: desktop shell (Tauri with React/TypeScript as a candidate), native application service, SQLite repository, content import worker, local model worker, constrained math verification worker, and offline UI assets. Use a packaged runtime such as llama.cpp [S8]; confirm compatibility with the chosen model before committing. SymPy or an equivalent symbolic engine is a candidate for verification, bundled if selected. These are proposed implementation choices, not already tested dependencies.

UI calls typed commands such as `import_bundle`, `review_item`, `start_attempt`, `save_response`, `submit_module`, `grade_attempt`, `recommend_practice`, `generate_quiz`, `explain_question`, and `export_profile`. The deterministic services own grading and timers. AI workers return proposals; they never mutate test results directly.

A graphing calculator must work offline with expressions, plots, intersections, roots, tables, zoom, and common scientific functions. Treat exact Desmos embedding/distribution as an integration question requiring explicit documented permission and an offline feasibility test. Default to a suitably licensed implementation; label differences. A web iframe fails the offline requirement.

## 7. Nonfunctional requirements and evaluation gates

Targets below are proposed release gates, not measured performance claims.

| Area | Gate |
|---|---|
| Offline | Full install-to-test-to-review-to-AI-practice flow with network disabled; no attempted outbound content requests |
| UI | Navigation/answer selection p95 under 100 ms; committed answer save p95 under 250 ms; never wait on inference |
| Reliability | No lost committed response in 100 forced-stop/restart trials; idempotent module submission and import |
| AI performance | On declared 16 GB reference devices, first useful response p95 within 10 s and a short verified explanation within 60 s; publish actual model/quantization/hardware |
| Low-memory behavior | 8 GB devices tested as a candidate reduced-performance tier, not advertised until measured; no swap spiral or app crash; core non-AI features remain usable |
| Content fidelity | 100% activated full-form question/key associations checked; visual review of all activated diagram/table items |
| Classification | At least 95% primary-skill accuracy on a held-out, reviewed set; report domain-level results and abstentions |
| AI answer quality | At least 95% accuracy on answered in-scope held-out items, with at least 80% coverage overall and per section; publish counts, domain breakdown, and uncertainty intervals |
| Verification | No known false “tool checked” outcomes in release adversarial suite; every such failure blocks release |
| Teaching quality | At least 90% of evaluated explanations rated correct, evidence-supported, and understandable by an SAT-capable human reviewer |
| Generated practice | At least 98% valid answers/unique-best-answer rate in a reviewed sample of served items per supported generator family; failed cases removed and regression-tested |

Create an evaluation set of at least 200 reviewed items spanning all eight domains, plus at least 50 adversarial/ambiguous cases. Maintain a separate human-reviewed generated-item sample of at least 100 items for each enabled generator family. Split by canonical content and near duplicates, not filenames; reserve evaluation forms and keep answers out of solver prompts. Imported private items may be evaluated locally but cannot be committed publicly. Use original/licensed fixtures for public CI. Report abstention, coverage, wrong confident answers, and latency alongside accuracy so a system cannot pass by refusing all hard questions.

## 8. Implementation sequence for the coding agent

1. **Foundation:** create repository, dependency/license inventory, desktop skeleton, original starter fixture, SQLite migrations, private-data ignore rules, themes, and CI. Record platform and model assumptions in an architecture decision record.
2. **Content vertical slice:** import Test 10 locally; verify its full form and source assets; add reviewer UI and deterministic grading. Use its scoring range, not a point estimate. Do not publicly commit the imported content.
3. **Test engine:** implement modes, module state machine, autosave, recovery, calculator/reference panel, and timer acceptance tests.
4. **Learning records:** implement ontology, aliases, source occurrences, profiles, attempt history, skill evidence, reservations, and targeted curated practice. Expand import validation to Tests 4–11.
5. **Local coach:** benchmark candidate model/runtime pairs; add retrieval, constrained tools, progressive hints, evidence statuses, and original lessons. Validate text and image transcription before solving.
6. **Generation:** implement one deterministic math family end to end, then approved language templates; add repair limits, quarantine, provenance, and evaluation reports.
7. **Digital rehearsal:** curate sufficient module branches, freeze blueprint/routing rules, enforce exposure constraints, and label its fidelity/scoring limitations.
8. **Release:** package model/runtime; test clean offline installations on supported platforms; complete accessibility, content, security, quality, and licensing gates; publish reproducible build instructions and limitations.

Each stage must deliver a working user flow, automated checks where meaningful, and a short record of remaining gaps. Do not replace core behavior with mock responses in release builds. Use source fixtures only from approved original/licensed content in public CI.

### Definition of done

A student can install one package, import their official practice bundle, take and resume a local test, receive correct form-specific results, inspect missed questions by skill, complete a short lesson and targeted practice, ask the local coach for an explained answer with verification status, and see updated progress across sessions. The flow works offline in both themes, keeps private content local, and passes the gates above.

## 9. Decisions to validate during implementation

These defaults permit development to begin; they are not requests to stop before scaffolding.

| Decision | Default / validation task |
|---|---|
| Platform order | macOS Apple Silicon first; Windows x64 before public v1; validate reference OS versions in packaging spike |
| Model | Gemma candidate, exact pinned version/size/quantization selected by quality, license, memory, and latency tests |
| One download | Full offline bundle is mandatory; optional light installer may exist only as an additional distribution |
| Teaching rights | Private local import; independently authored public curriculum unless explicit redistribution rights are supplied |
| Official adaptive forms | Not present as complete adaptive manifests in reviewed inputs; implement paper replay and labeled local rehearsal |
| Calculator | Licensed offline equivalent; no promised Desmos parity until verified |
| Generation coverage | Narrow validated families first; visible gaps serviced by reviewed real questions |
| Score prediction | Excluded until separately calibrated and evaluated; goal score is planning metadata only |

## 10. External references

Checked October 18, 2026. Revalidate test-format rules and selected dependency/model terms before release.

- **S1 — SAT structure:** https://satsuite.collegeboard.org/sat/whats-on-the-test/structure
- **S2 — Official paper practice bundles and limitations:** https://satsuite.collegeboard.org/practice/practice-tests/paper
- **S3 — Score calculation and adaptivity:** https://satsuite.collegeboard.org/scores/what-scores-mean/how-scores-calculated
- **S4 — Content domains and skills:** https://satsuite.collegeboard.org/practice/content-domains
- **S5 — Math specifications:** https://satsuite.collegeboard.org/k12-educators/about/alignment/math
- **S6 — Gemma model catalog:** https://ai.google.dev/gemma/docs
- **S7 — Gemma terms (check selected artifact's actual applicable license):** https://ai.google.dev/gemma/terms/
- **S8 — Local inference runtime:** https://github.com/ggml-org/llama.cpp

The product defaults, evidence formula, routing threshold, schedules, architecture, and evaluation targets are proposed design decisions; they are not claims made by those sources.
