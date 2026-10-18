import { useId } from 'react';
import type { ProviderConfig } from '../../ai';
import { useAiProvider, useAiSettings, useJudgeSettings, saveJudgeSettings } from './aiState';
import './ai.css';

const keyOf = (p: ProviderConfig) => `${p.kind}|${p.source}|${p.baseUrl}|${p.model}|${p.filePath ?? ''}`;
const sameModelAs = (a: ProviderConfig, b: ProviderConfig) =>
  a.kind === 'gguf_file' && b.kind === 'gguf_file' ? (a.filePath ?? a.model) === (b.filePath ?? b.model) : keyOf(a) === keyOf(b);

// Settings section: whether (and with which local model) every AI answer is checked before the student sees it.
export function JudgeSettings() {
  const coach = useAiProvider();
  const ai = useAiSettings();
  const j = useJudgeSettings();
  const id = useId();
  if (!coach) return null;

  const others = (ai?.lastDetection?.models ?? []).map((m) => m.provider).filter((p) => !sameModelAs(p, coach));
  const current = j.provider ? keyOf(j.provider) : '';
  const missing = j.provider && !others.some((p) => keyOf(p) === current);

  const pick = (value: string) => {
    if (!value) { saveJudgeSettings({ provider: undefined }); return; }
    const p = others.find((o) => keyOf(o) === value) ?? (j.provider && keyOf(j.provider) === value ? j.provider : undefined);
    saveJudgeSettings({ provider: p });
  };

  return (
    <div className="stack jd-settings" role="group" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="ai-m0">Answer checking (AI judge)</h3>
      <p className="muted ai-small ai-m0">A second, skeptical pass solves the question on its own first, then checks the coach's answer and every step before you see it.</p>
      <label className="row ai-gap-s">
        <input type="checkbox" checked={j.enabled} onChange={(e: any) => saveJudgeSettings({ enabled: e.target.checked })} />
        Check every AI answer with a judge before showing it
      </label>
      <label className="row ai-gap-s">
        <input type="checkbox" checked={j.autoRepair} disabled={!j.enabled} onChange={(e: any) => saveJudgeSettings({ autoRepair: e.target.checked })} />
        Let the coach revise once when the judge finds a problem
      </label>
      <div className="stack ai-gap-s">
        <label htmlFor={`${id}-m`}>Judge model</label>
        <select id={`${id}-m`} className="input" value={current} disabled={!j.enabled} aria-describedby={`${id}-note`}
          onChange={(e: any) => pick(e.target.value)}>
          <option value="">Same as the coach (second pass)</option>
          {others.map((p) => <option key={keyOf(p)} value={keyOf(p)}>{p.label}</option>)}
          {missing && j.provider ? <option value={current}>{j.provider.label} (not found in the last scan)</option> : null}
        </select>
        <span id={`${id}-note`} className="muted ai-small">
          A different model makes the check more independent — for example Gemma 4 12B judging Gemma 4 E4B. Everything still runs on this computer.
          {coach.kind === 'gguf_file' ? ' A second model file can\'t run next to the coach\'s file; pick a model from Ollama or LM Studio, or the same-model check is used.' : ''}
          {!others.length ? ' No other local models were found in the last scan — scan again above after installing one.' : ''}
        </span>
      </div>
    </div>
  );
}
