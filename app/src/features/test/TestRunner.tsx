import { useEffect, useRef, useState } from 'react';
import type { Attempt, ChoiceId, ResponseRecord } from '../../domain/types';
import { ITEM_BY_ID } from '../../content';
import { endBreak, remainingMs, startModule, submitModule, updateResponse } from '../../domain/attempts';
import { ItemView } from './ItemView';
import { Calculator } from './Calculator';
import { ReferenceSheet } from './ReferenceSheet';
import './test.css';

function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TestRunner({ attempt, onChange, onExit }: { attempt: Attempt; onChange: (next: Attempt) => void; onExit: () => void }) {
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState(0);
  const [view, setView] = useState<'item' | 'review'>('item');
  const [grid, setGrid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [calc, setCalc] = useState(false);
  const [ref, setRef] = useState(false);
  const [dirs, setDirs] = useState(false);
  const expiredKey = useRef('');
  const since = useRef(Date.now());
  const latest = useRef(attempt);
  latest.current = attempt;

  const mi = attempt.currentModule;
  const spec = attempt.testSnapshot.modules[mi];
  const mod = attempt.modules[mi];
  const ids = spec?.itemIds ?? [];
  const itemId = ids[Math.min(q, ids.length - 1)];
  const item = itemId ? ITEM_BY_ID[itemId] : undefined;
  const isMath = spec?.section === 'math';

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Expiry: submit exactly once per module.
  useEffect(() => {
    if (attempt.status !== 'in_progress' || !mod || mod.status !== 'active' || mod.deadline == null) return;
    const key = `${attempt.id}:${mi}`;
    if (now >= mod.deadline && expiredKey.current !== key) {
      expiredKey.current = key;
      onChange(submitModule(withTime(latest.current), mi, Date.now(), 'expired'));
      setView('item'); setQ(0); setConfirm(false); setGrid(false);
    }
  }, [now, attempt.status, mod?.status, mod?.deadline, mi]);

  // Break: auto-end when countdown reaches zero.
  useEffect(() => {
    if (attempt.status === 'on_break' && attempt.breakEndsAt != null && now >= attempt.breakEndsAt) {
      onChange(endBreak(latest.current, Date.now())); setQ(0); setView('item');
    }
  }, [now, attempt.status]);

  /** Adds time spent on the current item to its activeMs. */
  function withTime(a: Attempt): Attempt {
    const t = Date.now();
    const elapsed = t - since.current;
    since.current = t;
    const m = a.modules[a.currentModule];
    if (view !== 'item' || !itemId || !m || m.status !== 'active' || elapsed <= 0) return a;
    const prev = m.responses[itemId]?.activeMs ?? 0;
    return updateResponse(a, itemId, { activeMs: prev + elapsed }, t);
  }

  const patch = (p: Partial<ResponseRecord>) => { if (itemId) onChange(updateResponse(latest.current, itemId, p, Date.now())); };
  const go = (next: number) => {
    onChange(withTime(latest.current));
    setGrid(false); setConfirm(false);
    if (next >= ids.length) { setView('review'); return; }
    setView('item'); setQ(Math.max(0, next));
  };
  const submit = () => {
    const next = submitModule(withTime(latest.current), mi, Date.now(), 'manual');
    setQ(0); setView('item'); setConfirm(false); setGrid(false); setCalc(false); setRef(false);
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e: any) => {
      const tag = (e.target?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (attempt.status !== 'in_progress' || mod?.status !== 'active') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(view === 'review' ? ids.length : q + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(view === 'review' ? ids.length - 1 : q - 1); }
      else if (view === 'item' && (e.key === 'f' || e.key === 'F')) patch({ flagged: !(mod.responses[itemId]?.flagged ?? false) });
      else if (view === 'item' && item?.response.kind === 'mcq' && /^[a-dA-D]$/.test(e.key)) patch({ raw: e.key.toUpperCase() as ChoiceId });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (attempt.status === 'completed') {
    return <div className="t-screen"><h1>Test complete</h1><p>Preparing your results…</p><button type="button" className="t-btn" onClick={onExit}>Exit</button></div>;
  }

  if (attempt.status === 'on_break') {
    const left = Math.max(0, (attempt.breakEndsAt ?? now) - now);
    return (
      <div className="t-screen">
        <h1>Break</h1>
        <p>You have an optional 10-minute break before the next module.</p>
        <p className="t-big" role="timer" aria-live="off">{mmss(left)}</p>
        <button type="button" className="t-btn t-primary" onClick={() => { onChange(endBreak(latest.current, Date.now())); setQ(0); setView('item'); }}>Resume now</button>
      </div>
    );
  }

  if (!spec || !mod) return <div className="t-screen"><p>Module not found.</p><button type="button" className="t-btn" onClick={onExit}>Exit</button></div>;

  if (mod.status === 'not_started') {
    return (
      <div className="t-screen">
        <p className="t-muted">{attempt.testSnapshot.title} · Module {mi + 1} of {attempt.modules.length}</p>
        <h1>{spec.title}</h1>
        <p>{ids.length} questions · {spec.durationSec != null ? `${Math.round(spec.durationSec / 60)} minutes` : 'untimed'}</p>
        <p className="t-muted">The timer keeps running if you close the app. You can move between questions in this module and flag any to revisit. Once you submit, you cannot return.</p>
        <div className="t-row">
          <button type="button" className="t-btn" onClick={onExit}>Exit</button>
          <button type="button" className="t-btn t-primary" onClick={() => { since.current = Date.now(); setQ(0); setView('item'); onChange(startModule(latest.current, mi, Date.now())); }}>Start module</button>
        </div>
      </div>
    );
  }

  const rem = remainingMs(mod, now);
  const answered = (id: string) => { const r = mod.responses[id]?.raw; return r != null && r !== ''; };
  const flagged = (id: string) => !!mod.responses[id]?.flagged;
  const Grid = (
    <ol className="t-grid" aria-label="Question navigator">
      {ids.map((id, i) => (
        <li key={id}>
          <button type="button" className={`t-cell${answered(id) ? ' t-answered' : ''}${i === q && view === 'item' ? ' t-current' : ''}`}
            onClick={() => go(i)} aria-current={i === q && view === 'item' ? 'step' : undefined}>
            <span className="t-cell-n">{i + 1}</span>
            <span className="t-cell-s">{answered(id) ? '● Answered' : '○ Unanswered'}</span>
            {flagged(id) && <span className="t-cell-f">⚑ Flagged</span>}
          </button>
        </li>
      ))}
    </ol>
  );
  const resp = itemId ? mod.responses[itemId] : undefined;

  return (
    <div className="t-runner">
      <header className="t-head">
        <div className="t-head-title">{spec.title}</div>
        <div className="t-timer">
          {rem != null && (hideTimer
            ? <span className="t-muted">Timer hidden</span>
            : <span role="timer" className={rem < 5 * 60000 ? 't-low' : ''}>{rem < 5 * 60000 ? '⏱ ' : ''}{mmss(rem)}</span>)}
          {rem != null && <button type="button" className="t-btn t-sm" onClick={() => setHideTimer((h) => !h)}>{hideTimer ? 'Show' : 'Hide'}</button>}
        </div>
        <div className="t-head-tools">
          {isMath && <button type="button" className="t-btn t-sm" aria-pressed={calc} onClick={() => setCalc((c) => !c)}>Calculator</button>}
          {isMath && <button type="button" className="t-btn t-sm" aria-pressed={ref} onClick={() => setRef((r) => !r)}>Reference</button>}
          <button type="button" className="t-btn t-sm" aria-expanded={dirs} onClick={() => setDirs((d) => !d)}>Directions</button>
        </div>
      </header>
      {dirs && (
        <div className="t-dirs" role="note">
          {isMath
            ? 'Solve each problem. For multiple-choice questions choose the best answer. For student-produced responses, enter one answer; fractions and decimals are accepted, but not mixed numbers, %, $, or commas.'
            : 'Read each passage and question carefully, then choose the single best answer based on the text.'}
          {' Keyboard: ←/→ move, A–D choose, F flag.'}
        </div>
      )}
      <main className="t-body">
        {view === 'review' ? (
          <div className="t-review">
            <h2>Check your work</h2>
            <p>{ids.filter(answered).length} of {ids.length} answered · {ids.filter(flagged).length} flagged. Select a question to return to it.</p>
            {Grid}
            {!confirm ? (
              <button type="button" className="t-btn t-primary" onClick={() => setConfirm(true)}>Submit module</button>
            ) : (
              <div className="t-confirm" role="alertdialog" aria-label="Confirm submission">
                <p><strong>Submit this module?</strong> You won't be able to return to these questions.
                  {ids.some((id) => !answered(id)) ? ` ${ids.filter((id) => !answered(id)).length} unanswered.` : ''}</p>
                <div className="t-row">
                  <button type="button" className="t-btn" onClick={() => setConfirm(false)}>Keep working</button>
                  <button type="button" className="t-btn t-primary" onClick={submit}>Yes, submit</button>
                </div>
              </div>
            )}
          </div>
        ) : item ? (
          <ItemView item={item} response={resp} onChange={patch} allowEliminate />
        ) : <p>Item unavailable.</p>}
      </main>
      {grid && <div className="t-grid-pop">{Grid}<button type="button" className="t-btn t-primary" onClick={() => go(ids.length)}>Go to review</button></div>}
      <footer className="t-foot">
        <button type="button" className="t-btn" disabled={view === 'item' && q === 0} onClick={() => go(view === 'review' ? ids.length - 1 : q - 1)}>Back</button>
        <button type="button" className="t-btn" aria-expanded={grid} onClick={() => setGrid((g) => !g)}>
          {view === 'review' ? 'Review' : `Question ${q + 1} of ${ids.length}`}
        </button>
        {view === 'item' && (
          <button type="button" className="t-btn" aria-pressed={!!resp?.flagged} onClick={() => patch({ flagged: !resp?.flagged })}>
            {resp?.flagged ? '⚑ Flagged' : '⚐ Flag for review'}
          </button>
        )}
        {view === 'item' && <button type="button" className="t-btn t-primary" onClick={() => go(q + 1)}>Next</button>}
      </footer>
      {calc && <Calculator onClose={() => setCalc(false)} />}
      {ref && <ReferenceSheet onClose={() => setRef(false)} />}
    </div>
  );
}
