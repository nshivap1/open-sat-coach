import { useEffect, useId, useRef, useState } from 'react';
import { explainAnotherWay, followUp, MAX_FOLLOW_UPS } from '../../ai';
import type { CoachReply, CoachTurn } from '../../ai/types';
import type { Item } from '../../domain/types';
import { useAiProvider, readyProvider, errorText } from './aiState';
import './ai.css';

type Pending = { kind: 'explain' } | { kind: 'follow'; question: string };

// Optional local-AI help shown in practice feedback and results review only — never during strict tests.
export function CoachPanel({ item, chosen }: { item: Item; chosen?: string | null }) {
  const provider = useAiProvider();
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [thread, setThread] = useState<CoachTurn[]>([]);
  const [loading, setLoading] = useState<Pending | null>(null);
  const [error, setError] = useState<{ msg: string; retry: Pending } | null>(null);
  const [question, setQuestion] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const inputId = useId();

  // New question or unmount: drop the old conversation and cancel anything in flight.
  useEffect(() => {
    setReply(null); setThread([]); setError(null); setLoading(null); setQuestion('');
    return () => { ctrl.current?.abort(); ctrl.current = null; };
  }, [item.id]);

  if (!provider) return <p className="muted ai-small ai-hint">Connect a local AI model in Settings to ask the coach.</p>;

  const followUps = thread.filter((t) => t.role === 'student').length;
  const left = MAX_FOLLOW_UPS - followUps;

  const run = async (job: Pending) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(job); setError(null);
    try {
      const live = await readyProvider(provider);
      if (job.kind === 'explain') {
        const r = await explainAnotherWay(live, item, chosen ?? null, c.signal);
        if (c.signal.aborted) return;
        setReply(r);
        setThread([{ role: 'coach', text: [r.text, ...(r.steps ?? []), r.takeaway ?? ''].filter(Boolean).join('\n') }]);
      } else {
        const r = await followUp(live, item, thread, job.question, c.signal);
        if (c.signal.aborted) return;
        setThread((t) => [...t, { role: 'student', text: job.question }, { role: 'coach', text: r.text }]);
        setQuestion('');
      }
    } catch (e) {
      if (c.signal.aborted) return;
      setError({ msg: errorText(e), retry: job });
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setLoading(null); }
    }
  };

  const cancel = () => { ctrl.current?.abort(); ctrl.current = null; setLoading(null); };

  const ask = (e: any) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || left <= 0 || loading) return;
    void run({ kind: 'follow', question: q });
  };

  const transcript = thread.slice(1); // first coach turn is the explanation rendered above

  return (
    <section className="ai-coach" aria-label="AI coach">
      {!reply ? (
        <button type="button" className="btn" onClick={() => run({ kind: 'explain' })} disabled={!!loading}>
          Explain it another way (local AI)
        </button>
      ) : (
        <div className="ai-reply">
          <p className="ai-label">AI explanation · local model · not verified — the answer key above is authoritative</p>
          <p className="ai-m0 ai-pre">{reply.text}</p>
          {reply.steps?.length ? <ol className="ai-steps">{reply.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
          {reply.takeaway ? <p className="ai-m0"><strong>Takeaway:</strong> {reply.takeaway}</p> : null}
        </div>
      )}

      {transcript.length ? (
        <ol className="ai-thread" aria-label="Follow-up conversation">
          {transcript.map((t, i) => (
            <li key={i} className={`ai-turn ai-turn-${t.role}`}>
              <span className="ai-who">{t.role === 'student' ? 'You' : 'Coach (AI, not verified)'}</span>
              <span className="ai-pre">{t.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div aria-live="polite" className="ai-status">
        {loading ? (
          <div className="row">
            <span className="ai-spin-row"><span className="ai-spinner" aria-hidden="true" /> {loading.kind === 'explain' ? 'The local model is writing an explanation…' : 'The local model is answering…'}</span>
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
