import { useEffect, useId, useRef, useState } from 'react';
import { runBenchmark, isDesktop, invokeDesktop } from '../../ai';
import type { BenchmarkSummary } from '../../ai/types';
import { ITEMS } from '../../content';
import { useAiProvider, useAiSettings, readyProvider, saveBenchmark, errorText } from './aiState';
import './ai.css';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function BenchmarkPanel() {
  const provider = useAiProvider();
  const last = useAiSettings()?.lastBenchmark;
  const [limit, setLimit] = useState('10');
  const [classify, setClassify] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const limitId = useId();

  useEffect(() => () => { ctrl.current?.abort(); }, []);

  if (!provider) return null;

  const start = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setError(null);
    const n = limit === 'all' ? ITEMS.length : Number(limit);
    setProgress({ done: 0, total: n });
    try {
      let device: string | undefined;
      if (isDesktop()) {
        try {
          const d = await invokeDesktop<{ os: string; arch: string; totalMemoryBytes: number | null; cpu: string | null }>('device_info');
          device = [d.cpu, `${d.os}/${d.arch}`, d.totalMemoryBytes ? `${Math.round(d.totalMemoryBytes / 1024 ** 3)} GB RAM` : null].filter(Boolean).join(' · ');
        } catch { device = undefined; }
      }
      const live = await readyProvider(provider);
      const res = await runBenchmark(live, ITEMS, {
        limit: limit === 'all' ? undefined : n,
        classify,
        signal: c.signal,
        device,
        onProgress: (done, total) => { if (!c.signal.aborted) setProgress({ done, total }); },
      });
      if (c.signal.aborted) return;
      const { rows: _rows, ...summary } = res;
      saveBenchmark(summary);
    } catch (e) {
      if (!c.signal.aborted) setError(errorText(e));
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setProgress(null); }
    }
  };

  const cancel = () => { ctrl.current?.abort(); ctrl.current = null; setProgress(null); setError('Check cancelled.'); };
  const running = !!progress;

  return (
    <div className="stack ai-bench">
      <h3 className="ai-m0">Check how well this model answers SAT questions</h3>
      <p className="muted ai-m0 ai-small">The model answers some of this app's original practice questions on your computer and we compare with the answer key. It's a quick local check of this model on this device, not the app's release evaluation, and nothing leaves your computer.</p>
      <div className="row">
        <label htmlFor={limitId}>Questions</label>
        <select id={limitId} className="input" value={limit} disabled={running} onChange={(e: any) => setLimit(e.target.value)}>
          <option value="10">10</option><option value="30">30</option><option value="all">All ({ITEMS.length})</option>
        </select>
        <label className="row ai-gap-s"><input type="checkbox" checked={classify} disabled={running} onChange={(e: any) => setClassify(e.target.checked)} /> Also check skill classification</label>
      </div>
      <div className="row">
        {!running
          ? <button type="button" className="btn" onClick={start}>{last ? 'Run the check again' : 'Run the check'}</button>
          : <button type="button" className="btn" onClick={cancel}>Cancel</button>}
      </div>
      <div aria-live="polite" className="ai-status">
        {progress ? (
          <div className="stack ai-gap-s">
            <progress className="ai-progress" max={Math.max(progress.total, 1)} value={progress.done} aria-label="Benchmark progress" />
            <span className="ai-small">{progress.done} of {progress.total} questions…</span>
          </div>
        ) : null}
        {error && !running ? <p className="ai-m0 ai-bad">✗ {error}</p> : null}
      </div>
      {last && !running ? <BenchResult s={last} /> : null}
    </div>
  );
}

function BenchResult({ s }: { s: BenchmarkSummary }) {
  return (
    <div className="ai-bench-result" aria-live="polite">
      <p className="ai-m0 muted ai-small">Last check: {s.providerLabel} · {new Date(s.at).toLocaleString()}{s.device ? ` · ${s.device}` : ''}</p>
      <dl className="ai-stats">
        <div><dt>Accuracy</dt><dd>{pct(s.accuracy)}</dd><dd className="muted ai-small">{s.correct} of {s.answered} answered correctly</dd></div>
        <div><dt>Coverage</dt><dd>{pct(s.coverage)}</dd><dd className="muted ai-small">{s.answered} of {s.items} gave a usable answer</dd></div>
        <div><dt>Typical time</dt><dd>{(s.p50Ms / 1000).toFixed(1)} s</dd><dd className="muted ai-small">median (p50)</dd></div>
        <div><dt>Slow answers</dt><dd>{(s.p95Ms / 1000).toFixed(1)} s</dd><dd className="muted ai-small">p95</dd></div>
        {s.classifyAccuracy != null ? <div><dt>Skill classification</dt><dd>{pct(s.classifyAccuracy)}</dd><dd className="muted ai-small">matched the question's skill</dd></div> : null}
      </dl>
    </div>
  );
}
