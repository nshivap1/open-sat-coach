import type { JudgeStage, JudgeVerdict } from '../../ai';
import './ai.css';

export interface JudgeBadgeProps {
  verdict: JudgeVerdict | null;
  repaired?: boolean;
  judgeError?: string;
  stage?: JudgeStage | null;
}

// Shows what the AI judge concluded about a coach reply. Text and symbols carry the meaning, not color alone.
export function JudgeBadge({ verdict, repaired, judgeError, stage }: JudgeBadgeProps) {
  if (stage === 'judging' || stage === 'revising') {
    return (
      <div className="jd-badge jd-busy" role="status" aria-live="polite">
        <span className="ai-spinner" aria-hidden="true" />{' '}
        {stage === 'judging' ? 'AI judge checking the answer and reasoning…' : 'The judge found a problem — revising…'}
      </div>
    );
  }
  if (stage === 'writing') return null;

  if (!verdict) {
    return (
      <div className="jd-badge jd-off" aria-live="polite">
        <span className="jd-head"><span aria-hidden="true">○ </span>
          {judgeError ? `Not checked — the judge couldn't run (${judgeError})` : 'Not checked (judge is off)'}
        </span>
      </div>
    );
  }

  const label = (
    <span className="jd-who">
      {verdict.judgeLabel}{verdict.sameModel ? ' — same model, so this is a second look, not proof' : ''}
    </span>
  );
  const issues = verdict.issues.filter((x) => x && x.trim());
  const answerWrong = verdict.answerCorrect === false;

  return (
    <div className={`jd-badge jd-${verdict.verdict}`} aria-live="polite">
      {verdict.verdict === 'pass' ? (
        <span className="jd-head"><span aria-hidden="true">✓ </span>Judge: answer and reasoning check out</span>
      ) : verdict.verdict === 'fail' ? (
        <span className="jd-head"><span aria-hidden="true">⚠ </span>Judge found a problem</span>
      ) : (
        <span className="jd-head"><span aria-hidden="true">? </span>Judge couldn't confirm this</span>
      )}
      {label}
      {repaired ? <span className="jd-who">(revised after the judge's first review)</span> : null}
      {verdict.verdict !== 'pass' && (answerWrong || issues.length) ? (
        <ul className="jd-issues">
          {answerWrong ? <li><strong>The final answer looks wrong.</strong>{verdict.judgeAnswer ? ` The judge got ${verdict.judgeAnswer}.` : ''}</li> : null}
          {verdict.verdict === 'fail' && !verdict.reasoningSound && !issues.length ? <li>The reasoning has a step that doesn't follow.</li> : null}
          {issues.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      ) : null}
      <details className="jd-details">
        <summary>What the judge checked</summary>
        <ul className="jd-checks">
          <li>Judge's own answer (worked out first): <strong>{verdict.judgeAnswer ?? 'none — it could not solve it'}</strong></li>
          <li>Final answer: {verdict.answerCorrect == null ? '? unknown' : verdict.answerCorrect ? '✓ matches' : '✗ does not match'}</li>
          <li>Reasoning: {verdict.reasoningSound ? '✓ each step follows' : '✗ a step does not follow'}</li>
          <li>Grounding: {verdict.grounded ? '✓ supported by the question text / the math checks out' : '✗ uses unsupported claims or a wrong computation'}</li>
          <li className="muted">Took {(verdict.ms / 1000).toFixed(1)} s on this computer.</li>
        </ul>
      </details>
    </div>
  );
}
