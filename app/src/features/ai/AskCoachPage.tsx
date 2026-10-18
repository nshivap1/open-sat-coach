import { useEffect, useId, useRef, useState } from 'react';
import { askWithJudge, followUpPasted, judgeExplanation, MAX_FOLLOW_UPS, MAX_PASTED_CHARS } from '../../ai';
import type { CoachTurn, JudgeStage, JudgeVerdict, PastedQuestionReply } from '../../ai';
import { SKILL_BY_ID } from '../../content';
import { useAiProvider, useJudgeSettings, readyProvider, readyJudge, errorText } from './aiState';
import { JudgeBadge } from './JudgeBadge';
import './ai.css';

type Job = { kind: 'ask'; text: string; answer: string } | { kind: 'follow'; question: string };
type Meta = { verdict: JudgeVerdict | null; repaired?: boolean; judgeError?: string };

const norm = (x: string | null | undefined) => (x ?? '').trim().replace(/^\(?([A-Da-d])\)?[.)]?$/, '$1').toUpperCase();

export interface AskCoachPageProps {
  onPracticeSkill(skillId: string): void;
  onBack(): void;
}

// Ask the local AI coach about any SAT question the student pastes as text. Output is provisional.
export function AskCoachPage({ onPracticeSkill, onBack }: AskCoachPageProps) {
  const provider = useAiProvider();
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [asked, setAsked] = useState('');          // the pasted text the current reply is about
  const judgeSettings = useJudgeSettings();
  const [reply, setReply] = useState<PastedQuestionReply | null>(null);
  const [meta, setMeta] = useState<(Meta | undefined)[]>([]); // aligned with thread indices (coach turns only)
  const [stage, setStage] = useState<JudgeStage | null>(null);
  const [thread, setThread] = useState<CoachTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState<Job | null>(null);
  const [error, setError] = useState<{ msg: string; retry: Job } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => () => { ctrl.current?.abort(); ctrl.current = null; }, []);

  const back = <button type="button" className="btn" onClick={onBack}>← Back</button>;

  if (!provider) {
    return (
      <div className="stack">
        <div className="row">{back}</div>
        <h1>Ask the coach about any question</h1>
        <div className="card stack">
          <p className="ai-m0">The AI coach is optional — everything else in the app works without it.</p>
          <p className="ai-m0">
            To use it, connect a model that runs on this computer (for example Gemma in Ollama or LM Studio) in{' '}
            <strong>Settings → AI coach</strong>. Nothing is sent to the internet.
          </p>
        </div>
      </div>
    );
  }

  const run = async (job: Job) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(job); setError(null); setStage('writing');
    const onStage = (st: JudgeStage) => { if (!c.signal.aborted) setStage(st); };
    try {
      const live = await readyProvider(provider);
      const judge = await readyJudge(live);
      if (job.kind === 'ask') {
        const res = await askWithJudge(live, judge.provider, job.text, job.answer || undefined, {
          autoRepair: judgeSettings.autoRepair, signal: c.signal, onStage, sameModel: judge.sameModel, judgeLabel: judge.label,
        });
        if (c.signal.aborted) return;
        const r = res.reply;
        setReply(r); setAsked(job.text); setQuestion('');
        setThread([{ role: 'coach', text: [r.answer ? `Proposed answer: ${r.answer}` : '', r.text, ...r.steps, r.check ?? '', r.takeaway ?? ''].filter(Boolean).join('\n') }]);
        setMeta([{ verdict: res.verdict, repaired: res.repaired, judgeError: res.judgeError }]);
      } else {
        // Pasted questions have no Item, so the follow-up is written by the coach and then judged in a separate pass.
        const r = await followUpPasted(live, asked, thread, job.question, c.signal);
        if (c.signal.aborted) return;
        let m: Meta = { verdict: null };
        if (judge.provider) {
          onStage('judging');
          try {
            const v = await judgeExplanation(judge.provider, {
              questionText: asked, keyAnswer: null, proposedAnswer: reply?.answer ?? null, followUpQuestion: job.question, explanation: { text: r.text },
            }, { signal: c.signal, sameModel: judge.sameModel, judgeLabel: judge.label });
            m = { verdict: v };
          } catch (e) {
            if (c.signal.aborted) return;
            m = { verdict: null, judgeError: errorText(e) };
          }
          if (c.signal.aborted) return;
        }
        const at = thread.length;
        setThread((t) => [...t, { role: 'student', text: job.question }, { role: 'coach', text: r.text }]);
        setMeta((old) => { const n = old.slice(); n[at] = undefined; n[at + 1] = m; return n; });
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

  const submitAsk = (e: any) => {
    e.preventDefault();
    if (loading) return;
    void run({ kind: 'ask', text: text.trim(), answer: answer.trim() });
  };

  const followUps = thread.filter((t) => t.role === 'student').length;
  const left = MAX_FOLLOW_UPS - followUps;
  const submitFollow = (e: any) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || left <= 0 || loading) return;
    void run({ kind: 'follow', question: q });
  };

  const skill = reply?.skillId ? SKILL_BY_ID[reply.skillId] : undefined;
  const transcript = thread.slice(1);
  const tooLong = text.trim().length > MAX_PASTED_CHARS;
  const first = meta[0];
  const v = first?.verdict ?? null;
  const failed = v?.verdict === 'fail';
  const conflict = !!(reply && v && failed && v.answerCorrect === false && v.judgeAnswer && norm(v.judgeAnswer) !== norm(reply.answer));
  const judging = stage === 'judging' || stage === 'revising';

  return (
    <div className="stack">
      <div className="row">{back}</div>
      <h1>Ask the coach about any question</h1>

      <form className="card stack" onSubmit={submitAsk}>
        <label htmlFor={`${id}-q`}><strong>Paste the question (passage, question and answer choices)</strong></label>
        <textarea id={`${id}-q`} className="input" rows={12} value={text} disabled={!!loading}
          aria-describedby={`${id}-note`} onChange={(e: any) => setText(e.target.value)} />
        <span id={`${id}-note`} className="muted ai-small">
          Images and graphs aren't read yet — describe them in words.{' '}
          {tooLong ? <span className="ai-bad">Too long: {text.trim().length} of {MAX_PASTED_CHARS} characters.</span> : null}
        </span>
        <label htmlFor={`${id}-a`}>Your answer (optional)</label>
        <input id={`${id}-a`} className="input" value={answer} maxLength={200} disabled={!!loading}
          onChange={(e: any) => setAnswer(e.target.value)} />
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={!!loading || !text.trim() || tooLong}>Ask</button>
        </div>
      </form>

      <div aria-live="polite" className="ai-status">
        {loading ? (
          <div className="row">
            {judging ? <JudgeBadge verdict={null} stage={stage} /> : (
              <span className="ai-spin-row"><span className="ai-spinner" aria-hidden="true" /> {loading.kind === 'ask' ? 'The local model is working on the question…' : 'The local model is answering…'}</span>
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
        <section className="card ai-reply stack" aria-label="Coach answer">
          <p className="ai-label ai-m0">AI answer · local model. Check it against the official answer key when you have one.</p>
          <JudgeBadge verdict={v} repaired={first?.repaired} judgeError={first?.judgeError} />
          <div className="row">
            <span><strong>Skill:</strong> {skill ? skill.officialName : 'Not sure which skill this tests'}</span>
            {skill ? <button type="button" className="btn ai-sm" onClick={() => onPracticeSkill(skill.id)}>Practice this skill</button> : null}
          </div>
          {conflict ? (
            <div className="jd-conflict" role="alert">
              <strong><span aria-hidden="true">⚠ </span>The coach and the judge disagree (coach: {reply.answer ?? 'no answer'}, judge: {v!.judgeAnswer}).</strong>{' '}
              Don't rely on either — check the official answer key.
            </div>
          ) : failed ? null : (
            <p className="ai-m0"><strong>Proposed answer:</strong> {reply.answer ?? 'No answer — the coach could not solve it from the text given.'}</p>
          )}
          {failed ? (
            <details className="jd-hidden">
              <summary>Show the AI explanation anyway</summary>
              {!conflict ? <p className="ai-m0"><strong>Coach's answer (judge found a problem):</strong> {reply.answer ?? 'none'}</p> : null}
              <p className="ai-m0 ai-pre">{reply.text}</p>
              {reply.steps.length ? <ol className="ai-steps">{reply.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
              {reply.check ? <p className="ai-m0"><strong>Check:</strong> {reply.check}</p> : null}
              {reply.takeaway ? <p className="ai-m0"><strong>Takeaway:</strong> {reply.takeaway}</p> : null}
            </details>
          ) : (
            <>
              <p className="ai-m0 ai-pre">{reply.text}</p>
              {reply.steps.length ? <ol className="ai-steps">{reply.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
              {reply.check ? <p className="ai-m0"><strong>Check:</strong> {reply.check}</p> : null}
              {reply.takeaway ? <p className="ai-m0"><strong>Takeaway:</strong> {reply.takeaway}</p> : null}
            </>
          )}

          {transcript.length ? (
            <ol className="ai-thread" aria-label="Follow-up conversation">
              {transcript.map((t, i) => {
                const m = meta[i + 1];
                return (
                  <li key={i} className={`ai-turn ai-turn-${t.role}`}>
                    <span className="ai-who">{t.role === 'student' ? 'You' : 'Coach (AI)'}</span>
                    {t.role === 'coach' ? <JudgeBadge verdict={m?.verdict ?? null} repaired={m?.repaired} judgeError={m?.judgeError} /> : null}
                    {t.role === 'coach' && m?.verdict?.verdict === 'fail' ? (
                      <details className="jd-hidden"><summary>Show the AI reply anyway</summary><span className="ai-pre">{t.text}</span></details>
                    ) : <span className="ai-pre">{t.text}</span>}
                  </li>
                );
              })}
            </ol>
          ) : null}

          {left > 0 ? (
            <form className="ai-follow stack" onSubmit={submitFollow}>
              <label htmlFor={`${id}-f`}>Ask a follow-up about this question</label>
              <div className="row">
                <input id={`${id}-f`} className="input ai-grow" value={question} maxLength={500} disabled={!!loading}
                  aria-describedby={`${id}-count`} onChange={(e: any) => setQuestion(e.target.value)} />
                <button type="submit" className="btn" disabled={!!loading || !question.trim()}>Ask</button>
              </div>
              <span id={`${id}-count`} className="muted ai-small">{left} of {MAX_FOLLOW_UPS} follow-ups left</span>
            </form>
          ) : (
            <p className="muted ai-small ai-m0">You've used all {MAX_FOLLOW_UPS} follow-ups for this question.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
