# SAT source review and ontology examples

Reviewed October 18, 2026. Companion to [PRD.md](PRD.md).

## Scope and method

Located one teaching archive and eight practice-test ZIPs in `/Users/nataraj/Downloads`. Inventoried all 50 contained files and extracted searchable text from PDF pages and Office document XML into temporary working storage. Reviewed substantive sections of the teacher guide, the key-points document, technology guidance, example-question documents, slide headings/references, course-outline text, and representative test and scoring-guide pages. Visually checked the teacher guide's data-question page and Test 10's Reading and Writing and Math module opening pages.

This is a requirements-oriented review, not a complete editorial audit or question-bank import. It does **not** certify every answer, every slide image, every source locator, or all test conversion tables. Office XML extraction does not capture all image-based question content; these assets need visual review/OCR in the implementation. The accompanying PRD makes item-level approval a separate required step.

No original archives were modified. No proprietary source documents, question images, or full extracted texts have been copied into this project. Archive member paths below identify the sources for future local import; the temporary extraction directory is not a project dependency.

## Teaching approach to retain

The teacher guide is 73 PDF pages. Its introduction sets expectations and emphasizes time management and reflection; Reading and Writing instruction begins on page 23; Math begins on page 52; study-plan prompts appear on pages 66–67; appendices close the guide. The student guide is also 73 pages. A separate 14-page technology guide teaches the test interface.

The most useful product pattern is a short strategy paired with a worked example, followed by student practice and a personal next step. Adapt that pattern into short lessons and mistake review. Preserve evidence-seeking, reasonable pacing, mathematical checks, and familiarity with tools. Write original lessons rather than copying the guides.

The course outlines establish a classroom sequence involving orientation, test modules, instruction, and study planning. They should influence onboarding and session structure, not impose an eight-hour experience on every app user.

## Classification changes required

| Teaching label | Recommended ontology mapping | Caution |
|---|---|---|
| Vocabulary in Context | Craft and Structure → Words in Context | Classify the actual stem, not the document heading |
| Main Purpose | Craft and Structure → Text Structure and Purpose, or Information and Ideas → Central Ideas and Details | Main idea and rhetorical purpose are different tasks; the example collection includes both |
| Function of Underlined Portion | Craft and Structure → Text Structure and Purpose → sentence function | Preserve exact underline spans |
| Fact Checking | Information and Ideas → Central Ideas and Details or Inferences | Explicit fact retrieval differs from inference |
| Interpretation | Information and Ideas → Command of Evidence or Inferences | Separate support/weaken evidence from logical completion |
| Student Notes | Expression of Ideas → Rhetorical Synthesis | Store rhetorical goal as subtype metadata |
| Data Questions | Information and Ideas → Quantitative Evidence, for R&W items | A chart is an asset/format tag; Math data items need Math skills |
| Grammar | Standard English Conventions → Boundaries or Form, Structure, and Sense | Transitions belong to Expression of Ideas despite grouping in the guide |
| Two Texts | Craft and Structure → Cross-Text Connections | Store relationship and perspective being tested |
| Poetry | Passage genre tag; actual skill from the stem | Do not create a stand-alone official “poetry” domain |
| By the Book | Strategy tag: direct conceptual/algebraic solution | Not a mathematical skill category |
| Calculator | Strategy tag: graph, intersect, evaluate, inspect | Using a calculator does not prove conceptual mastery |
| Picking Numbers | Strategy tag: substitution to test candidates | One matching input does not establish an identity |
| Using Answer Choices | Strategy tag: back-substitution | Check all constraints, not merely one equation |
| Elimination | Strategy tag with an explicit mathematical/textual reason | Unusual magnitude or appearance is not proof of an incorrect answer |

## Specific source issues and curation implications

1. **Nonadaptive form mismatch:** Test 10 PDF page 4 shows 33 Reading and Writing questions in Module 1; page 32 shows 27 Math questions. Its scoring guide uses section totals of 66 and 54. These are not the digital-format counts. The official paper download page independently confirms the nonadaptive nature of the bundles.
2. **Score ranges:** Test 10 and 11 scoring guides explicitly use lower/upper score bounds and describe simplified paper scoring. Form-specific tables differ. Never reuse one test's conversion for another test or display an unsupported exact score.
3. **Impossible locator:** `dSAT Tests #7-10 Bluebook Practice Problems.docx`, in the NEW examples folder, includes a Test 7 interpretation example with “Module 8.” Preserve it as an unresolved source label; do not create a fictitious module.
4. **Missing branch context:** the same Test 7 document includes two different R&W examples labeled Module 2, Question 6. They may belong to different branches, but the labels alone do not establish that. Use content identity plus reviewed branch/form information.
5. **Mixed references:** the Test 10 slide deck's slide 13 references Test 9, Module 1, Question 9; slide 42 references Test 6, Module 1, Question 4. These may be intentional reuse or copy errors. Do not silently change them to Test 10.
6. **Heading mismatch:** the Test 7 document places a transition item labeled Module 1, Question 24 under the vocabulary examples. Classification must inspect the question's actual task.
7. **Legacy information:** the key-points document describes four practice tests and an early digital rollout; the folder now includes later materials and Tests 4–11. Treat historical test availability, technology instructions, and scoring simplifications as dated.
8. **Unqualified shortcuts:** the teacher guide's substitution strategy needs an identity-check qualification; elimination based solely on outlier appearance should not become the coach's correctness criterion. Grammar explanations should name applicable rules rather than relying only on how a sentence sounds.
9. **Private curriculum:** page 2 of the teacher guide contains an explicit rights-reserved notice. The app can be designed around the pedagogical pattern without copying the curriculum into an open-source release. Maintain distinct rights/provenance fields for code, model, original lessons, and imported content.
10. **Layout-sensitive ingestion:** Test 10's two-column pages, embedded graph images, and mathematical notation demonstrate why text-only parsing is insufficient. Reconstruct accessible structured questions with source crops available for checking.

## Concrete real-question mappings

These are seed mappings from the actual Test 10 **paper** PDF and its scoring guide, not a complete ontology annotation. Topic descriptions below are brief paraphrases; full questions are intentionally left in the local source. PDF page means one-based file page, which differs from printed page numbers. Answer-key locators refer to PDF page 4 of `scoring-sat-practice-test-10-digital.pdf`.

| Stable example locator | Source PDF page | Topic/task | Primary skill → proposed subtype | What it tests | Key / validation state |
|---|---:|---|---|---|---|
| `cb.paper.10.rw.m1.q1` | 4 | General store as an information hub | Words in Context → contextual word completion | Infer a word's meaning from nearby descriptions | A; key checked; source page visually checked |
| `cb.paper.10.rw.m1.q2` | 4 | Painter's attention to neighborhood details | Words in Context → contextual word completion | Select a trait consistent with textual evidence | B; key checked; source page visually checked |
| `cb.paper.10.rw.m1.q15` | 10 | Evidence for an editor's publishing aim | Command of Evidence → textual support | Choose a finding directly relevant to a stated claim | A; key checked; text reviewed |
| `cb.paper.10.rw.m1.q18` | 12 | Targeted control of an invasive plant | Inferences → logical completion | Derive a consequence from the stated mechanism | D; key checked; text reviewed |
| `cb.paper.10.rw.m1.q20` | 12 | Joining clauses about extinction theories | Boundaries → comma and coordinating conjunction | Recognize independent clauses and correct punctuation | B; key checked; text reviewed |
| `cb.paper.10.rw.m2.q13` | 24 | Graph comparison of coating performance | Command of Evidence → quantitative support | Compare graph evidence against a research conclusion | B; key checked; graph requires visual validation before activation |
| `cb.paper.10.math.m1.q2` | 34 | Intersection of two lines | Algebra: linear systems → graphical solution | Identify coordinates satisfying both equations | A; key checked; graph requires visual validation before activation |

For each item, the production record must add source hash, content version, reviewed assets, primary/secondary tags, difficulty provenance, strategy links, and explanation verification. These references are not Bluebook adaptive locators and must never be joined by number alone.

### Example relationship chain

`R&W → Standard English Conventions → Boundaries → coordinating independent clauses`

- Prerequisite: identify an independent clause.
- Tests: whether the student can join two complete clauses correctly.
- Strategy: identify subjects and finite verbs before comparing punctuation choices.
- Possible misconception: using a comma alone between independent clauses.
- Real example: `cb.paper.10.rw.m1.q20`.
- Lesson: an originally authored explanation of clause boundaries.
- Student evidence: immutable responses to this question and other fresh items of this type.
- Follow-up: different clause-boundary questions, with an explanation of why this skill was selected.

A misconception is a diagnostic hypothesis until supported by repeated evidence or student reflection; it is not an automatic label attached after one wrong response.

## Source inventory

All teaching members below are in `Digital SAT -20261018T171315Z-1-001.zip`. Test bundles are named `full-length-sat-paper-practice-test_-bundle-N.zip`. Office units count slides or extracted XML parts only where indicated; PDF counts are actual PDF pages.

| Archive | Member | Extent |
|---|---|---|
| Teaching archive | `Digital SAT /Computers and Bluebook App - Start of Class Instructions.docx` | Office document |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /Teacher Administrative Guide - Logistics Only Final.pdf` | 7 pages |
| Teaching archive | `Digital SAT /Teacher Guide for Tech Problems When Teaching.docx` | Office document |
| Teaching archive | `Digital SAT /SAT - 8 Hour Course Timing.xlsx` | Office document |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /SAT Prep Admin Guide - Final.pdf` | 13 pages |
| Teaching archive | `Digital SAT /Digital SAT Key Points Document.docx` | Office document |
| Teaching archive | `Digital SAT /BRAVE SAT - 8 Hour Course Timing Outline.xlsx` | Office document |
| Teaching archive | `Digital SAT /Back Up Option for Classes (when tech isn_t working)/Copy of Digital SAT Tech Guide_.pptx` | 14 slides |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /Digital SAT - TECH Guide.pdf` | 14 pages |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 4 Digital SAT Example Problem Slideshow.pptx` | 49 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 6 Digital SAT Example Problem Slideshow.pptx` | 47 slides |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /Digital SAT example problems.pdf` | 39 pages |
| Teaching archive | `Digital SAT /Back Up Option for Classes (when tech isn_t working)/Test #1_ Digital SAT Test Example Problem Google Slides.pptx` | 42 slides |
| Teaching archive | `Digital SAT /Back Up Option for Classes (when tech isn_t working)/Test #2_ Digital SAT Test Example Problems Google Slides.pptx` | 40 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 8 Digital SAT Example Problem Slideshow.pptx` | 51 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 9 Digital SAT Example Problem Slideshow.pptx` | 51 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 10 Digital SAT Example Problem Slideshow.pptx` | 48 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 7 Digital SAT Example Problem Slideshow.pptx` | 50 slides |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /dSAT Tests #7-10 Bluebook Practice Problems.docx` | Office document |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /Bluebook Test 5 Digital SAT Example Problem Slideshow.pptx` | 51 slides |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /Digital SAT - STUDENT Guide.pdf` | 73 pages |
| Teaching archive | `Digital SAT /NEW Digital SAT Example Problems /dSAT Tests #4-6 Bluebook Practice Problems.docx` | Office document |
| Teaching archive | `Digital SAT /Online Digital SAT Teacher Binder /Digital SAT - TEACHER Guide.pdf` | 73 pages |
| Teaching archive | `Digital SAT /New Bluebook Practice Problems Digital SAT Tests 7-10 (1).docx` | Office document |
| Teaching archive | `Digital SAT /New Bluebook Practice Problems Digital SAT Tests 7-10.docx` | Office document |
| Teaching archive | `Digital SAT /OLD Digital Example Problems (Linear) - for reference only/Digital SAT Test Example Problem Slideshow.pptx` | 163 slides |
| Test 10 | `sat-practice-test-10-answers-digital.pdf` | 47 pages |
| Test 10 | `scoring-sat-practice-test-10-digital.pdf` | 5 pages |
| Test 10 | `sat-practice-test-10-digital.pdf` | 56 pages |
| Test 11 | `scoring-sat-practice-test-11-digital.pdf` | 5 pages |
| Test 11 | `sat-practice-test-11-answers-digital.pdf` | 51 pages |
| Test 11 | `sat-practice-test-11-digital.pdf` | 52 pages |
| Test 4 | `sat-practice-test-4-answers-digital.pdf` | 53 pages |
| Test 4 | `scoring-sat-practice-test-4-digital.pdf` | 5 pages |
| Test 4 | `sat-practice-test-4-digital.pdf` | 56 pages |
| Test 5 | `scoring-sat-practice-test-5-digital.pdf` | 5 pages |
| Test 5 | `sat-practice-test-5-answers-digital.pdf` | 50 pages |
| Test 5 | `sat-practice-test-5-digital.pdf` | 56 pages |
| Test 6 | `scoring-sat-practice-test-6-digital.pdf` | 5 pages |
| Test 6 | `sat-practice-test-6-answers-digital.pdf` | 52 pages |
| Test 6 | `sat-practice-test-6-digital.pdf` | 56 pages |
| Test 7 | `sat-practice-test-7-answers-digital.pdf` | 46 pages |
| Test 7 | `scoring-sat-practice-test-7-digital.pdf` | 5 pages |
| Test 7 | `sat-practice-test-7-digital.pdf` | 56 pages |
| Test 8 | `sat-practice-test-8-answers-digital.pdf` | 48 pages |
| Test 8 | `scoring-sat-practice-test-8-digital.pdf` | 5 pages |
| Test 8 | `sat-practice-test-8-digital.pdf` | 56 pages |
| Test 9 | `scoring-sat-practice-test-9-digital.pdf` | 5 pages |
| Test 9 | `sat-practice-test-9-answers-digital.pdf` | 47 pages |
| Test 9 | `sat-practice-test-9-digital.pdf` | 56 pages |

## External confirmation

- [College Board: SAT structure](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure).
- [College Board: paper practice tests](https://satsuite.collegeboard.org/practice/practice-tests/paper).
- [College Board: content domains](https://satsuite.collegeboard.org/practice/content-domains).

See the PRD for model/runtime references and the distinction between verified source facts and proposed product policies.
