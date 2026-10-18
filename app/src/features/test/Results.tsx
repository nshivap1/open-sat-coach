import { useState } from 'react';
import type { Attempt, GradedResponse, MissReason, ResponseRecord } from '../../domain/types';
import { DOMAIN_BY_ID, ITEM_BY_ID, SKILL_BY_ID } from '../../content';
import { ItemView } from './ItemView';
import './test.css';

const REASONS: MissReason[] = ['concept', 'misread', 'calculation', 'strategy', 'time', 'guessed', 'unsure'];
type Tally = { correct: number; incorrect: number; omitted: number };
const bump = (t: Record<string, Tally>, k: string, o: GradedResponse['outcome']) => {
  const x = (t[k] ??= { correct: 0, incorrect: 0, omitted: 0 });
  if (o === 'correct') x.correct++; else if (o === 'omitted') x.omitted++; else x.incorrect++;
};

export interface ResultsProps {
  attempt: Attempt;
  graded: GradedResponse[];
  missReasons: Record<string, MissReason>;
  onSetMissReason: (itemId: string, reason: MissReason) => void;
  onPracticeSkill: (skillId: string) => void;
  onDone: () => void;
}

export function Results({ attempt, graded, missReasons, onSetMissReason, onPracticeSkill, onDone }: ResultsProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const respOf = (id: string): ResponseRecord | undefined => attempt.modules.map((m) => m.responses[id]).find(Boolean);
  const bySection: Record<string, Tally> = {};
  const byDomain: Record<string, Tally> = {};
  for (const g of graded) {
    bump(bySection, ITEM_BY_ID[g.itemId]?.section ?? 'other', g.outcome);
    bump(byDomain, SKILL_BY_ID[g.skillId]?.domainId ?? 'other', g.outcome);
  }
  const review = graded.filter((g) => g.outcome !== 'correct' || respOf(g.itemId)?.flagged);
  const groups: Record<string, GradedResponse[]> = {};
  for (const g of review) (groups[g.skillId] ??= []).push(g);
  const reasonOf = (id: string) => missReasons[`${attempt.id}:${id}`] ?? missReasons[id];
  const label = (o: GradedResponse['outcome'], flagged: boolean) =>
    `${o === 'correct' ? '✓ Correct' : o === 'omitted' ? '○ Omitted' : o === 'invalid_format' ? '✗ Invalid format' : '✗ Incorrect'}${flagged ? ' · ⚑ Flagged' : ''}`;
  const Table = ({ title, rows, name }: { title: string; rows: Record<string, Tally>; name: (k: string) => string }) => (
    <table className="t-table t-res-table">
      <caption>{title}</caption>
      <thead><tr><th scope="col">Area</th><th scope="col">Correct</th><th scope="col">Incorrect</th><th scope="col">Omitted</th></tr></thead>
      <tbody>{Object.entries(rows).map(([k, t]) => (
        <tr key={k}><th scope="row">{name(k)}</th><td>{t.correct}</td><td>{t.incorrect}</td><td>{t.omitted}</td></tr>
      ))}</tbody>
    </table>
  );

  return (
    <div className="t-results">
      <header className="t-res-head">
        <h1>{attempt.testSnapshot.title} — results</h1>
        <p className="t-badge">{attempt.testSnapshot.label}</p>
        {attempt.interrupted && <p className="t-muted">This attempt was interrupted and resumed.</p>}
      </header>
      <div className="t-res-tables">
        <Table title="By section" rows={bySection} name={(k) => (k === 'rw' ? 'Reading and Writing' : k === 'math' ? 'Math' : k)} />
        <Table title="By domain" rows={byDomain} name={(k) => DOMAIN_BY_ID[k]?.name ?? k} />
      </div>
      <p className="t-muted">Invalid-format answers count as incorrect.</p>
      <h2>Review missed, omitted, and flagged questions</h2>
      {Object.keys(groups).length === 0 && <p>Nothing to review — every question was answered correctly and none were flagged.</p>}
      {Object.entries(groups).map(([skillId, list]) => (
        <section key={skillId} className="t-res-skill">
          <div className="t-res-skill-head">
            <h3>{SKILL_BY_ID[skillId]?.studentName ?? skillId}</h3>
            <button type="button" className="t-btn t-primary t-sm" onClick={() => onPracticeSkill(skillId)}>Practice this skill</button>
          </div>
          <ul className="t-res-list">
            {list.map((g) => {
              const item = ITEM_BY_ID[g.itemId];
              const resp = respOf(g.itemId);
              const isOpen = !!open[g.itemId];
              if (!item) return null;
              const chosen = item.response.kind === 'mcq' ? (resp?.raw as keyof NonNullable<typeof item.explanation.whyWrong> | null) : null;
              const why = chosen && chosen !== (item.response.kind === 'mcq' ? item.response.answer : '') ? item.explanation.whyWrong?.[chosen] : undefined;
              return (
                <li key={g.itemId} className="t-res-item">
                  <button type="button" className="t-res-toggle" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [g.itemId]: !o[g.itemId] }))}>
                    <span>{isOpen ? '▾' : '▸'} {item.prompt.slice(0, 90)}{item.prompt.length > 90 ? '…' : ''}</span>
                    <span className="t-res-out">{label(g.outcome, !!resp?.flagged)}</span>
                  </button>
                  {isOpen && (
                    <div className="t-res-detail">
                      <ItemView item={item} response={resp} onChange={() => {}} disabled reveal />
                      {g.formatMessage && <p className="t-warn">⚠ {g.formatMessage}</p>}
                      <div className="t-expl">
                        <p><strong>{item.explanation.answerSummary}</strong></p>
                        <ol>{item.explanation.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                        <p><strong>Check:</strong> {item.explanation.check}</p>
                        {why && <p><strong>Why {chosen} is wrong:</strong> {why}</p>}
                        <p><strong>Takeaway:</strong> {item.explanation.takeaway}</p>
                      </div>
                      {g.outcome !== 'correct' && (
                        <div className="t-chips" role="group" aria-label="Why did you miss this?">
                          <span className="t-muted">Why did you miss this?</span>
                          {REASONS.map((r) => (
                            <button key={r} type="button" className={`t-chip${reasonOf(g.itemId) === r ? ' t-on' : ''}`}
                              aria-pressed={reasonOf(g.itemId) === r} onClick={() => onSetMissReason(g.itemId, r)}>
                              {reasonOf(g.itemId) === r ? '✓ ' : ''}{r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="t-row"><button type="button" className="t-btn t-primary" onClick={onDone}>Done</button></div>
    </div>
  );
}
