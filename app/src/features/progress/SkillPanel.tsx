import type { SkillEvidence } from '../../domain/types';
import { DOMAIN_BY_ID, LESSON_BY_SKILL, SKILL_BY_ID, itemsForSkill } from '../../content/index';
import { STATUS } from './SkillMap';
import './progress.css';

export interface SkillPanelProps {
  skillId: string;
  evidence?: Record<string, SkillEvidence>;
  onPractice(skillId: string): void;
  onClose(): void;
}

function fmtDate(t?: number): string {
  return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not yet';
}

export function SkillPanel({ skillId, evidence, onPractice, onClose }: SkillPanelProps) {
  const s = SKILL_BY_ID[skillId];
  if (!s) return null;
  const ev = evidence?.[skillId];
  const st = STATUS[ev?.label ?? 'insufficient'];
  const lesson = LESSON_BY_SKILL[skillId];
  const count = itemsForSkill(skillId).length;
  return (
    <aside className="p-panel card" aria-labelledby={`p-panel-${skillId}`}>
      <div className="p-panel-head">
        <div>
          <div className="muted p-small">{DOMAIN_BY_ID[s.domainId]?.name} · {s.officialName}</div>
          <h2 id={`p-panel-${skillId}`} className="p-panel-title">{s.studentName}</h2>
          <span className={`p-chip ${st.cls}`}><span aria-hidden="true">{st.glyph}</span> {st.text}</span>
        </div>
        <button type="button" className="btn" onClick={onClose} aria-label="Close skill details">Close</button>
      </div>

      <h3>What this tests</h3>
      <p>{s.tests}</p>

      <h3>Your evidence</h3>
      {ev && ev.estimate !== null ? (
        <dl className="p-dl">
          <dt>Estimate</dt><dd>{Math.round(ev.estimate * 100)}% ({ev.correct} of {ev.eligible} fresh answers correct)</dd>
          <dt>Difficulty mix</dt><dd>{ev.difficultyMix.easy} easy · {ev.difficultyMix.medium} medium · {ev.difficultyMix.hard} hard</dd>
          <dt>Last practiced</dt><dd>{fmtDate(ev.lastPracticed)}</dd>
          {ev.due && <><dt>Review</dt><dd>A review is due.</dd></>}
        </dl>
      ) : (
        <p className="muted">No fresh answers yet{ev?.lastPracticed ? ` (last practiced ${fmtDate(ev.lastPracticed)})` : ''}. A few questions will show where you stand.</p>
      )}
      <p className="muted p-small">This is a practice estimate, not a score prediction.</p>

      <h3>How to recognize it</h3>
      <ul>{s.cues.map((c) => <li key={c}>{c}</li>)}</ul>
      <h3>Common mistakes</h3>
      <ul>{s.commonMistakes.map((c) => <li key={c}>{c}</li>)}</ul>
      <h3>Strategies</h3>
      <ul>{s.strategies.map((c) => <li key={c}>{c}</li>)}</ul>

      <h3>Prerequisites</h3>
      {s.prerequisites.length ? (
        <ul>{s.prerequisites.map((p) => {
          const ps = STATUS[evidence?.[p]?.label ?? 'insufficient'];
          return <li key={p}>{SKILL_BY_ID[p]?.studentName ?? p} — <span aria-hidden="true">{ps.glyph}</span> {ps.text}</li>;
        })}</ul>
      ) : <p className="muted">None — a good starting point.</p>}

      <h3>Question types</h3>
      <ul>{s.types.map((t) => <li key={t.id}><strong>{t.name}:</strong> {t.definition}</li>)}</ul>

      <p className="p-small">{count} question{count === 1 ? '' : 's'} available{lesson ? <> · Lesson: <em>{lesson.title}</em> ({lesson.minutes} min)</> : null}</p>
      <button type="button" className="btn btn-primary" onClick={() => onPractice(skillId)} disabled={count === 0}>Start practice</button>
    </aside>
  );
}

export default SkillPanel;
