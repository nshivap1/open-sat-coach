import { useEffect, useId, useRef, useState } from 'react';
import { explainWithJudge, followUpWithJudge, MAX_FOLLOW_UPS } from '../../ai';
import type { CoachReply, CoachTurn, JudgeStage, JudgedReply } from '../../ai';
import type { Item } from '../../domain/types';
import { useAiProvider, useJudgeSettings, readyProvider, readyJudge, errorText } from './aiState';
import { JudgeBadge } from './JudgeBadge';
import './ai.css';

type Pending = { kind: 'explain' } | { kind: 'follow'; question: string };
type Meta = Omit<JudgedReply<CoachReply>, 'reply'>;
const metaOf = (r: JudgedReply<CoachReply>): Meta => ({ verdict: r.verdict, attempts: r.attempts, repaired: r.repaired, judgeError: r.judgeError });

// A reply the judge failed stays collapsed; the student is pointed back to the reference explanation.
function Guarded({ meta, children }: { meta?: Meta; children: any }) {
  if (meta?.verdict?.verdict !== 'fail') return children;
  return (
    <>
      <p className="jd-steer ai-m0"><span aria-hidden="true">⚠ </span>Use the official explanation above instead — the judge found a problem with this AI explanation.</p>
      <details className="jd-hidden">
        <summary>Show the AI explanation anyway</summary>
        {children}
      </details>
    </>
  );
}

// Optional local-AI help shown in practice feedback and results review only — never during strict tests.
export function CoachPanel({ item, chosen }: { item: Item; chosen?: string | null }) {
  const provider = useAiProvider();
  const judgeSettings = useJudgeSettings();
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [thread, setThread] = useState<CoachTurn[]>([]);
  const [meta, setMeta] = useState<(Meta | undefined)[]>([]); // aligned with thread indices (coach turns only)
  const [loading, setLoading] = useState<Pending | null>(null);
  const [stage, setStage] = useState<JudgeStage | null>(null);
  const [error, setError] = useState<{ msg: string; retry: Pending } | null>(null);
  const [question, setQuestion] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const inputId = useId();

  // New question or unmount: drop the old conversation and cancel anything in flight.
  useEffect(() => {
    setReply(null); setThread([]); setMeta([]); setError(null); setLoading(null); setStage(null); setQuestion('');
    return () => { ctrl.current?.abort(); ctrl.current = null; };
  }, [item.id]);

  if (!provider) return <p className="muted ai-small ai-hint">Connect a local AI model in Settings to ask the coach.</p>;

  const followUps = thread.filter((t) => t.role === 'student').length;
  const left = MAX_FOLLOW_UPS - followUps;

  const run = async (job: Pending) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(job); setError(null); setStage('writing');
    try {
      const live = await readyProvider(provider);
      const judge = await readyJudge(live);
      const opts = {
        autoRepair: judgeSettings.autoRepair,
        signal: c.signal,
        sameModel: judge.sameModel,
        judgeLabel: judge.label,
        onStage: (s: JudgeStage) => { if (!c.signal.aborted) setStage(s); },
      };
      if (job.kind === 'explain') {
        const res = await explainWithJudge(live, judge.provider, item, chosen ?? null, opts);
        if (c.signal.aborted) return;
        const r = res.reply;
        setReply(r);
        setThread([{ role: 'coach', text: [r.text, ...(r.steps ?? []), r.takeaway ?? ''].filter(Boolean).join('\n') }]);
        setMeta([metaOf(res)]);
      } else {
        const res = await followUpWithJudge(live, judge.provider, item, thread, job.question, opts);
        if (c.signal.aborted) return;
        setThread((t) => [...t, { role: 'student', text: job.question }, { role: 'coach', text: res.reply.text }]);
        setMeta((m) => { const n = m.slice(); n[thread.length] = undefined; n[thread.length + 1] = metaOf(res); return n; });
        setQuestion('');
      }
    } catch (e) {
      if (c.signal.aborted) return;
      setError({ msg: errorText(e), retry: job });
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setLoading(null); setStage(null); }
    }
  };

  const cancel = () => { ctrl.current?.abort(); ctrl.current = null; setLoading(null); setStage(null); };

  const ask = (e: any) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || left <= 0 || loading) return;
    void run({ kind: 'follow', question: q });
  };

  const transcript = thread.slice(1); // first coach turn is the explanation rendered above
  const first = meta[0];
  const judging = stage === 'judging' || stage === 'revising';

  return (
    <section className="ai-coach" aria-label="AI coach">
      {!reply ? (
        <button type="button" className="btn" onClick={() => run({ kind: 'explain' })} disabled={!!loading}>
          Explain it another way (local AI)
        </button>
      ) : (
        <div className="ai-reply">
          <JudgeBadge verdict={first?.verdict ?? null} repaired={first?.repaired} judgeError={first?.judgeError} />
          <Guarded meta={first}>
            <p className="ai-label">AI explanation · local model · the answer key above is authoritative</p>
            <p className="ai-m0 ai-pre">{reply.text}</p>
            {reply.steps?.length ? <ol className="ai-steps">{reply.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
            {reply.takeaway ? <p className="ai-m0"><strong>Takeaway:</strong> {reply.takeaway}</p> : null}
          </Guarded>
        </div>
      )}

      {transcript.length ? (
        <ol className="ai-thread" aria-label="Follow-up conversation">
          {transcript.map((t, i) => {
            const m = meta[i + 1];
            return (
              <li key={i} className={`ai-turn ai-turn-${t.role}`}>
                <span className="ai-who">{t.role === 'student' ? 'You' : 'Coach (AI)'}</span>
                {t.role === 'coach' ? (
                  <>
                    <JudgeBadge verdict={m?.verdict ?? null} repaired={m?.repaired} judgeError={m?.judgeError} />
                    <Guarded meta={m}><span className="ai-pre">{t.text}</span></Guarded>
                  </>
                ) : <span className="ai-pre">{t.text}</span>}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div aria-live="polite" className="ai-status">
        {loading ? (
          <div className="row">
            {judging ? <JudgeBadge verdict={null} stage={stage} /> : (
              <span className="ai-spin-row"><span className="ai-spinner" aria-hidden="true" /> {loading.kind === 'explain' ? 'The local model is writing an explanation…' : 'The local model is answering…'}</span>
            )}
            <button type="button" className="btn ai-sm" onClick={cancel}>Cancel</button>
          </div>
        ) : null}
        {error && !loading ? (
          <div className="row">
            <span className="ai-bad">✗ The coach couldn't answer: {error.msg}</span>
            <button type="button" className="btn ai-sm" onClick={() => run(error.retry)}>Retry</button>
          </div>
        ) : null}
      </div>

      {reply ? (
        left > 0 ? (
          <form className="ai-follow stack" onSubmit={ask}>
            <label htmlFor={inputId}>Ask a follow-up about this question</label>
            <div className="row">
              <input id={inputId} className="input ai-grow" value={question} maxLength={500} disabled={!!loading}
                aria-describedby={`${inputId}-count`} onChange={(e: any) => setQuestion(e.target.value)} />
              <button type="submit" className="btn" disabled={!!loading || !question.trim()}>Ask</button>
            </div>
            <span id={`${inputId}-count`} className="muted ai-small">{left} of {MAX_FOLLOW_UPS} follow-ups left</span>
          </form>
        ) : (
          <p className="muted ai-small ai-m0">You've used all {MAX_FOLLOW_UPS} follow-ups for this question.</p>
        )
      ) : null}
    </section>
  );
}
