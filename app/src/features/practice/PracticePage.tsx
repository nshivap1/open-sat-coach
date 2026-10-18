import { useMemo, useState } from 'react';
import type { Attempt, ChoiceId, TestSpec } from '../../domain/types';
import { useAppState, activeProfile } from '../../domain/store';
import { DOMAINS, SKILLS, SKILL_BY_ID, LESSON_BY_SKILL, ITEM_BY_ID, itemsForSkill } from '../../content';
import { composeSession } from '../../domain/recommend';
import { gradeItem } from '../../domain/grading';
import { updateResponse } from '../../domain/attempts';
import { startPracticeAttempt, saveAttempt, finishPractice, getAttempt, gradedFor, markRemembered, reportProblem } from '../../domain/actions';
import { ItemView } from '../test/ItemView';
import { RichText } from '../../components/RichText';
import './practice.css';

type Stage = { kind: 'pick' } | { kind: 'lesson'; skillId: string } | { kind: 'session'; attemptId: string; skillId: string; note?: string } | { kind: 'done'; attemptId: string; skillId: string };

export function PracticePage({ initialSkillId, onOpenProgress }: { initialSkillId?: string; onOpenProgress(): void }) {
  const [stage, setStage] = useState<Stage>(initialSkillId ? { kind: 'lesson', skillId: initialSkillId } : { kind: 'pick' });
  const [length, setLength] = useState(10);

  const begin = (skillId: string) => {
    const profileId = activeProfile()?.id;
    const seen = new Set<string>();
    const practiced = new Set<string>();
    for (const o of useAppStateSnapshot().observations) if (o.profileId === profileId) { seen.add(o.itemId); if (o.skillId !== skillId) practiced.add(o.skillId); }
    const { itemIds, note } = composeSession(skillId, { seenItemIds: seen, length, practicedSkillIds: [...practiced] });
    if (itemIds.length === 0) return;
    const test: TestSpec = {
      id: `practice|${skillId}|${Date.now()}`,
      title: `Practice · ${SKILL_BY_ID[skillId]?.studentName ?? skillId}`,
      mode: 'practice',
      label: 'Skill practice · original questions',
      description: '',
      modules: [{ id: 'practice', section: SKILL_BY_ID[skillId]?.domainId.startsWith('rw') ? 'rw' : 'math', title: 'Practice', itemIds, durationSec: null }],
    };
    const id = startPracticeAttempt(test);
    if (id) setStage({ kind: 'session', attemptId: id, skillId, note });
  };

  if (stage.kind === 'pick') return <SkillPicker length={length} setLength={setLength} onPick={(id) => setStage({ kind: 'lesson', skillId: id })} />;
  if (stage.kind === 'lesson') return <LessonView skillId={stage.skillId} onStart={() => begin(stage.skillId)} onBack={() => setStage({ kind: 'pick' })} />;
  if (stage.kind === 'session') return <Session attemptId={stage.attemptId} note={stage.note} onDone={() => setStage({ kind: 'done', attemptId: stage.attemptId, skillId: stage.skillId })} />;
  return <SessionSummary attemptId={stage.attemptId} skillId={stage.skillId} onAgain={() => setStage({ kind: 'pick' })} onProgress={onOpenProgress} />;
}

// Snapshot accessor for event handlers (hooks can't be called there).
import { getState } from '../../domain/store';
function useAppStateSnapshot() { return getState(); }

function SkillPicker({ onPick, length, setLength }: { onPick(id: string): void; length: number; setLength(n: number): void }) {
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Practice</h1>
          <p className="muted">Pick a skill. Each session starts with a short lesson, then fresh questions with hints and explanations.</p>
        </div>
        <label className="row">Session length
          <select className="input" value={String(length)} onChange={(e: any) => setLength(Number(e.target.value))}>
            <option value="5">5 questions</option>
            <option value="10">10 questions</option>
            <option value="15">15 questions</option>
          </select>
        </label>
      </div>
      <p className="badge" style={{ alignSelf: 'flex-start' }}>Curated original questions · AI-generated practice arrives with the desktop app's local model</p>
      {DOMAINS.map((d) => (
        <section key={d.id} className="card">
          <h2 className="pr-domain">{d.section === 'rw' ? 'Reading and Writing' : 'Math'} · {d.name}</h2>
          <div className="pr-skill-grid">
            {SKILLS.filter((s) => s.domainId === d.id).map((s) => (
              <button key={s.id} className="pr-skill" onClick={() => onPick(s.id)}>
                <strong>{s.studentName}</strong>
                <span className="muted">{s.tests}</span>
                <span className="badge">{itemsForSkill(s.id).length} questions{LESSON_BY_SKILL[s.id] ? ' · lesson' : ''}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LessonView({ skillId, onStart, onBack }: { skillId: string; onStart(): void; onBack(): void }) {
  const lesson = LESSON_BY_SKILL[skillId];
  const skill = SKILL_BY_ID[skillId];
  const [showCheck, setShowCheck] = useState(false);
  const count = itemsForSkill(skillId).length;
  return (
    <div className="stack pr-lesson">
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← All skills</button>
      <div className="card stack">
        <span className="badge" style={{ alignSelf: 'flex-start' }}>Lesson · about {lesson?.minutes ?? 3} min · original</span>
        <h1>{lesson?.title ?? skill?.studentName}</h1>
        <p><strong>Goal:</strong> {lesson?.objective ?? skill?.tests}</p>
        {lesson ? (
          <>
            <h3>How to recognize it</h3>
            <ul>{lesson.cues.map((c, i) => <li key={i}>{c}</li>)}</ul>
            <h3>Steps</h3>
            <ol>{lesson.steps.map((c, i) => <li key={i}>{c}</li>)}</ol>
            <h3>Worked example</h3>
            <div className="pr-example"><RichText text={lesson.workedExample.problem} /><ol>{lesson.workedExample.solution.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
            <h3>Common trap</h3>
            <p>{lesson.trap}</p>
            <h3>Quick check</h3>
            <p>{lesson.check.question}</p>
            {showCheck ? <p className="pr-answer"><strong>Answer:</strong> {lesson.check.answer}</p> : <button className="btn" onClick={() => setShowCheck(true)}>Show answer</button>}
          </>
        ) : (
          <>
            <h3>How to recognize it</h3>
            <ul>{skill?.cues.map((c, i) => <li key={i}>{c}</li>)}</ul>
            <h3>Strategies</h3>
            <ul>{skill?.strategies.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </>
        )}
      </div>
      <div className="row">
        <button className="btn btn-primary" onClick={onStart} disabled={count === 0}>Start practice</button>
        {count === 0 ? <span className="muted">No questions available for this skill yet.</span> : null}
      </div>
    </div>
  );
}

const HINT_LABELS = ['What is this asking?', 'What should I do next?', 'Show a partial step', 'Show the full solution'];

function Session({ attemptId, note, onDone }: { attemptId: string; note?: string; onDone(): void }) {
  const attempt = useAppState((s) => s.attempts.find((a) => a.id === attemptId));
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reporting, setReporting] = useState(false);
  if (!attempt) return <p>Session not found.</p>;
  const ids = attempt.testSnapshot.modules[0].itemIds;
  const item = ITEM_BY_ID[ids[idx]];
  const resp = attempt.modules[0].responses[item.id];
  const isChecked = !!checked[item.id];
  const result = isChecked ? gradeItem(item, resp?.raw ?? null) : null;
  const hintLevel = resp?.hintLevel ?? 0;

  const patch = (p: any) => {
    const a = getAttempt(attemptId);
    if (!a) return;
    saveAttempt(updateResponse(a, item.id, p, Date.now()));
  };
  const showHint = () => {
    const next = Math.min(4, hintLevel + 1);
    patch(isChecked ? { } : { hintLevel: next, explanationSeen: next >= 4 ? true : resp?.explanationSeen ?? false });
    if (isChecked) return;
  };
  const check = () => setChecked((c) => ({ ...c, [item.id]: true }));
  const next = () => {
    if (idx < ids.length - 1) { setIdx(idx + 1); setReporting(false); }
    else { const a = getAttempt(attemptId); if (a) finishPractice(a); onDone(); }
  };
  const chosen = resp?.raw as ChoiceId | undefined;

  return (
    <div className="stack pr-session">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{attempt.testSnapshot.title}</h1>
        <span className="muted">Question {idx + 1} of {ids.length}</span>
      </div>
      {note ? <p className="badge">{note}</p> : null}
      <div className="pr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={idx + 1}><div style={{ width: `${((idx + 1) / ids.length) * 100}%` }} /></div>
      <div className="card">
        <ItemView item={item} response={resp} onChange={(p) => { if (!isChecked) patch(p); }} disabled={isChecked} reveal={isChecked} allowEliminate />
      </div>
      {!isChecked && hintLevel > 0 ? (
        <div className="card pr-hints" aria-live="polite">
          <strong>Hints</strong>
          <ol>{item.hints.slice(0, Math.min(3, hintLevel)).map((h, i) => <li key={i}>{h}</li>)}</ol>
          {hintLevel >= 4 ? <Explanation itemId={item.id} chosen={chosen} /> : null}
          <p className="muted">Questions answered with hints still count as practice, but not as independent evidence of the skill.</p>
        </div>
      ) : null}
      {isChecked && result ? (
        <div className={`card pr-feedback ${result.outcome}`} aria-live="polite">
          <strong>{result.outcome === 'correct' ? '✓ Correct' : result.outcome === 'omitted' ? '— Skipped' : result.outcome === 'invalid_format' ? '! Answer format' : '✗ Not quite'}</strong>
          {result.formatMessage ? <p>{result.formatMessage}</p> : null}
          <Explanation itemId={item.id} chosen={chosen} />
        </div>
      ) : null}
      <div className="row">
        {!isChecked ? (
          <>
            <button className="btn btn-primary" onClick={check}>{resp?.raw ? 'Check answer' : 'Skip'}</button>
            <button className="btn" onClick={showHint} disabled={hintLevel >= 4}>{HINT_LABELS[Math.min(3, hintLevel)]}</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={next}>{idx < ids.length - 1 ? 'Next question' : 'Finish session'}</button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => markRemembered(item.id)} title="Seen this exact question before? It won't count as fresh evidence.">I remember this question</button>
        <button className="btn" onClick={() => setReporting(!reporting)}>Report a problem</button>
      </div>
      {reporting ? <ReportForm itemId={item.id} onDone={() => setReporting(false)} /> : null}
    </div>
  );
}

export function Explanation({ itemId, chosen }: { itemId: string; chosen?: ChoiceId }) {
  const item = ITEM_BY_ID[itemId];
  const e = item.explanation;
  const correct = item.response.kind === 'mcq' ? item.response.answer : item.response.accepted[0];
  return (
    <div className="pr-expl">
      <p><strong>Answer: {correct}.</strong> {e.answerSummary}</p>
      <ol>{e.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <p><strong>Check:</strong> {e.check}</p>
      {chosen && item.response.kind === 'mcq' && chosen !== item.response.answer && e.whyWrong?.[chosen] ? <p><strong>Why {chosen} doesn't work:</strong> {e.whyWrong[chosen]}</p> : null}
      <p><strong>Takeaway:</strong> {e.takeaway}</p>
      <p className="muted pr-status">Answer source: original question key · explanation checked by automated review</p>
    </div>
  );
}

function ReportForm({ itemId, onDone }: { itemId: string; onDone(): void }) {
  const [kind, setKind] = useState('wrong_answer');
  const [comment, setComment] = useState('');
  return (
    <div className="card stack">
      <label>What's wrong?
        <select className="input" value={kind} onChange={(e: any) => setKind(e.target.value)}>
          <option value="wrong_answer">The answer key looks wrong</option>
          <option value="unclear">The question is unclear or has two answers</option>
          <option value="explanation">The explanation is wrong or confusing</option>
          <option value="typo">Typo or display problem</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Details (optional)<textarea className="input" rows={3} value={comment} onChange={(e: any) => setComment(e.target.value)} /></label>
      <p className="muted">Reports stay on this device. Nothing is sent anywhere.</p>
      <div className="row"><button className="btn btn-primary" onClick={() => { reportProblem(itemId, kind, comment); onDone(); }}>Save report</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

function SessionSummary({ attemptId, skillId, onAgain, onProgress }: { attemptId: string; skillId: string; onAgain(): void; onProgress(): void }) {
  const attempt = useAppState((s) => s.attempts.find((a) => a.id === attemptId)) as Attempt | undefined;
  const review = useAppState((s) => s.reviews.find((r) => r.profileId === attempt?.profileId && r.skillId === skillId));
  const graded = useMemo(() => (attempt ? gradedFor(attempt) : []), [attempt]);
  if (!attempt) return null;
  const correct = graded.filter((g) => g.outcome === 'correct').length;
  const assisted = graded.filter((g) => g.assisted).length;
  return (
    <div className="stack">
      <div className="card stack">
        <h1>Session complete</h1>
        <p style={{ fontSize: '1.25rem' }}><strong>{correct} of {graded.length}</strong> correct{assisted ? ` · ${assisted} with hints` : ''}</p>
        <ul className="pr-summary">
          {graded.map((g, i) => (
            <li key={g.itemId}><span aria-hidden="true">{g.outcome === 'correct' ? '✓' : g.outcome === 'omitted' ? '—' : '✗'}</span> Q{i + 1} · {SKILL_BY_ID[g.skillId]?.studentName} <span className="sr-only">{g.outcome}</span>{g.assisted ? <span className="badge">hint used</span> : null}</li>
          ))}
        </ul>
        <p><strong>Next step:</strong> {review ? `A quick check on ${SKILL_BY_ID[skillId]?.studentName} with different questions is scheduled for ${new Date(review.dueAt).toLocaleDateString()}.` : 'Try another skill, or open your skill map to see what changed.'}</p>
      </div>
      <div className="row"><button className="btn btn-primary" onClick={onProgress}>See my skill map</button><button className="btn" onClick={onAgain}>Practice another skill</button></div>
    </div>
  );
}
