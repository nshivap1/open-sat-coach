import { useMemo, useState } from 'react';
import type { Attempt, Observation, ReviewSchedule } from '../../domain/types';
import { activeProfile, useAppState } from '../../domain/store';
import { computeSkillEvidence } from '../../domain/evidence';
import { DOMAIN_BY_ID, SKILL_BY_ID, SKILLS, itemsForSkill } from '../../content/index';
import { MAP_ORDER, STATUS, SkillMap } from './SkillMap';
import { SkillPanel } from './SkillPanel';
import './progress.css';

const EMPTY_OBS: Observation[] = [];
const EMPTY_REV: ReviewSchedule[] = [];
const EMPTY_ATT: Attempt[] = [];

function fmtDate(t?: number): string {
  return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
}

export function ProgressPage({ onPractice }: { onPractice(skillId: string): void }) {
  const profile = useAppState((s) => activeProfile(s));
  const observations = useAppState((s) => s.observations) ?? EMPTY_OBS;
  const reviews = useAppState((s) => s.reviews) ?? EMPTY_REV;
  const attempts = useAppState((s) => s.attempts) ?? EMPTY_ATT;
  const profileId = profile?.id ?? '';
  const [view, setView] = useState<'map' | 'list'>('map');
  const [overlay, setOverlay] = useState<'evidence' | 'coverage'>('evidence');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const now = Date.now();
  const evidence = useMemo(() => computeSkillEvidence(observations, profileId, reviews, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observations, profileId, reviews]);
  const coverage = useMemo(() => Object.fromEntries(SKILLS.map((s) => [s.id, itemsForSkill(s.id).length])), []);
  const done = useMemo(() => attempts.filter((a) => a.profileId === profileId && a.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt)), [attempts, profileId]);
  const scoreFor = (a: Attempt) => {
    const os = observations.filter((o) => o.attemptId === a.id);
    const total = os.length || a.modules.reduce((n, m) => n + Object.keys(m.responses).length, 0);
    return { correct: os.filter((o) => o.outcome === 'correct').length, total };
  };
  const focusSkills = profile?.focusSkillIds ?? [];

  return (
    <div className="p-page">
      <header className="p-header">
        <div>
          <h1 className="p-h1">Skill map</h1>
          <p className="muted p-sub">29 SAT skills across 8 domains. Colors and symbols show practice evidence from fresh, unassisted answers.</p>
        </div>
        <div className="p-toggles">
          <div className="p-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          </div>
          <div className="p-seg" role="group" aria-label="Overlay">
            <button type="button" aria-pressed={overlay === 'evidence'} onClick={() => setOverlay('evidence')}>Evidence</button>
            <button type="button" aria-pressed={overlay === 'coverage'} onClick={() => setOverlay('coverage')}>Coverage</button>
          </div>
        </div>
      </header>

      {done.length === 0 && (
        <div className="p-empty card">
          <h2>Start with the quick diagnostic</h2>
          <p>Each tile is one SAT skill, grouped by the official domains; bigger domains count for more of the test. Tiles fill in as you answer fresh questions without hints — five answers are needed before a skill gets a status. The quick diagnostic asks one question per skill and is the fastest way to see where to begin.</p>
        </div>
      )}
      {focusSkills.length > 0 && (
        <p className="p-small muted">Focus skills: {focusSkills.map((id) => SKILL_BY_ID[id]?.studentName ?? id).join(', ')}</p>
      )}

      <div className={`p-body${selected ? ' p-has-panel' : ''}`}>
        <div className="p-main">
          {view === 'map' ? (
            <SkillMap evidence={evidence} selectedSkillId={selected} onSelect={(id) => setSelected(id === selected ? undefined : id)} overlay={overlay} coverage={coverage} />
          ) : (
            <table className="p-table">
              <caption className="sr-only">Skills with practice evidence</caption>
              <thead><tr><th scope="col">Skill</th><th scope="col">Domain</th><th scope="col">Status</th><th scope="col">n</th><th scope="col">Estimate</th><th scope="col">{overlay === 'coverage' ? 'Questions' : 'Last practiced'}</th></tr></thead>
              <tbody>
                {MAP_ORDER.map((id) => {
                  const s = SKILL_BY_ID[id]; const e = evidence[id]; const st = STATUS[e?.label ?? 'insufficient'];
                  return (
                    <tr key={id} className={id === selected ? 'p-row-sel' : ''}>
                      <th scope="row"><button type="button" className="p-link" onClick={() => setSelected(id)}>{s.studentName}</button></th>
                      <td>{DOMAIN_BY_ID[s.domainId]?.name}</td>
                      <td><span className={`p-chip ${st.cls}`}><span aria-hidden="true">{st.glyph}</span> {st.text}</span></td>
                      <td>{e?.eligible ?? 0}</td>
                      <td>{e?.estimate != null ? `${Math.round(e.estimate * 100)}%` : '—'}</td>
                      <td>{overlay === 'coverage' ? coverage[id] : fmtDate(e?.lastPracticed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {selected && (
          <SkillPanel skillId={selected} evidence={evidence} onPractice={onPractice} onClose={() => setSelected(undefined)} />
        )}
      </div>

      <section className="p-recent" aria-labelledby="p-recent-h">
        <h2 id="p-recent-h">Recent activity</h2>
        {done.length === 0 ? <p className="muted">No completed tests or practice sessions yet.</p> : (
          <ul className="p-recent-list">
            {done.slice(0, 10).map((a) => {
              const sc = scoreFor(a);
              return (
                <li key={a.id}>
                  <span>{a.testSnapshot?.title ?? a.testId}</span>
                  <span className="muted">{fmtDate(a.completedAt ?? a.createdAt)}</span>
                  <span>{sc.correct}/{sc.total} correct</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ProgressPage;
