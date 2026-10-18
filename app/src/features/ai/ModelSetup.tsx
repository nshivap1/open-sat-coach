import { useEffect, useId, useRef, useState } from 'react';
import { detectLocalModels, ping, GEMMA_DOWNLOADS, recommendedVariant, isDesktop, invokeDesktop, openExternal } from '../../ai';
import type { DetectionReport, DetectedModel, DownloadOption, PingResult } from '../../ai/types';
import { GetGemma } from './GetGemma';
import { saveProvider, disableAi, saveDetection, useAiProvider, readyProvider, forgetRunning, localUrlError, errorText, formatBytes, SOURCE_NAMES } from './aiState';
import './ai.css';

type Variant = { ollamaTag: string; label: string; why: string } | null;

export function ModelSetup({ variant, onDone }: { variant: 'onboarding' | 'settings'; onDone?(): void }) {
  const current = useAiProvider();
  const [changing, setChanging] = useState(variant === 'onboarding' || !current);
  const showSetup = variant === 'onboarding' || !current || changing;

  return (
    <div className="ai-setup stack">
      {variant === 'settings' && current ? <ConnectedModel onChange={() => setChanging(true)} changing={changing} /> : null}
      {variant === 'settings' && !current ? (
        <p className="muted ai-m0">AI is optional. Every practice, test and progress feature works without it.</p>
      ) : null}
      {showSetup ? (
        <Finder variant={variant} onDone={() => { setChanging(false); onDone?.(); }} onCancel={variant === 'settings' && current ? () => setChanging(false) : undefined} />
      ) : null}
    </div>
  );
}

function ConnectedModel({ onChange, changing }: { onChange(): void; changing: boolean }) {
  const p = useAiProvider()!;
  const [test, setTest] = useState<{ busy: boolean; res?: PingResult; err?: string }>({ busy: false });
  const runTest = async () => {
    setTest({ busy: true });
    try {
      const res = await ping(await readyProvider(p));
      setTest({ busy: false, res });
    } catch (e) { setTest({ busy: false, err: errorText(e) }); }
  };
  return (
    <div className="ai-connected">
      <div className="ai-connected-head">
        <span className="badge ai-badge-ok">✓ Connected</span>
        <strong>{p.label}</strong>
      </div>
      <p className="muted ai-m0">{SOURCE_NAMES[p.source] ?? p.source} · {p.filePath ?? (p.baseUrl || 'starts when needed')} · stays on this computer</p>
      <div className="row">
        <button type="button" className="btn" onClick={runTest} disabled={test.busy}>{test.busy ? 'Testing…' : 'Test'}</button>
        {!changing ? <button type="button" className="btn" onClick={onChange}>Change</button> : null}
        <button type="button" className="btn ai-danger" onClick={() => { forgetRunning(); disableAi(); }}>Turn off AI</button>
      </div>
      <p aria-live="polite" className="ai-m0">
        {test.res ? (test.res.ok
          ? <span className="ai-ok">✓ The model answered in {Math.round(test.res.ms)} ms.</span>
          : <span className="ai-bad">✗ No answer: {test.res.error ?? 'the model did not respond.'}</span>) : null}
        {test.err ? <span className="ai-bad">✗ {test.err}</span> : null}
      </p>
    </div>
  );
}

function Finder({ variant, onDone, onCancel }: { variant: 'onboarding' | 'settings'; onDone(): void; onCancel?(): void }) {
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [scanning, setScanning] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [connect, setConnect] = useState<{ busy: boolean; msg?: string; ok?: boolean }>({ busy: false });
  const [customUrl, setCustomUrl] = useState('');
  const [customErr, setCustomErr] = useState<string | null>(null);
  const [rec, setRec] = useState<Variant>(null);
  const runId = useRef(0);
  const customId = useId();
  const desktop = isDesktop();
  const otherHeadingId = useId();

  const scan = async (custom?: string) => {
    const id = ++runId.current;
    setScanning(true); setScanError(null); setConnect({ busy: false });
    try {
      const r = await detectLocalModels(custom ? { customUrl: custom } : undefined);
      if (id !== runId.current) return;
      setReport(r); setSelected(0); saveDetection(r);
    } catch (e) {
      if (id !== runId.current) return;
      setScanError(errorText(e));
    } finally {
      if (id === runId.current) setScanning(false);
    }
  };

  useEffect(() => { void scan(); return () => { runId.current++; }; }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let mem: number | null = null;
      if (isDesktop()) {
        try { mem = (await invokeDesktop<{ totalMemoryBytes: number | null }>('device_info')).totalMemoryBytes ?? null; } catch { mem = null; }
      }
      try { const v = recommendedVariant(mem); if (alive) setRec(v); } catch { /* catalog unavailable */ }
    })();
    return () => { alive = false; };
  }, []);

  const models = report?.models ?? [];
  const firstGemma = models.findIndex((m) => m.isGemma);
  const missing = (report?.servers ?? []).filter((s) => !s.reachable);
  const found = (report?.servers ?? []).filter((s) => s.reachable);

  const connectModel = async (m: DetectedModel) => {
    setConnect({ busy: true, msg: `Connecting to ${m.provider.label}…` });
    try {
      const live = await readyProvider(m.provider);
      const res = await ping(live);
      if (!res.ok) { setConnect({ busy: false, ok: false, msg: `The model did not answer: ${res.error ?? 'no response'}. Make sure it is running, then try again.` }); return; }
      setConnect({ busy: false, ok: true, msg: `Connected. The model answered in ${Math.round(res.ms)} ms.` });
      saveProvider(live);
      onDone();
    } catch (e) {
      forgetRunning();
      setConnect({ busy: false, ok: false, msg: `Could not connect: ${errorText(e)}` });
    }
  };

  const tryCustom = (e: any) => {
    e.preventDefault();
    const err = localUrlError(customUrl);
    setCustomErr(err);
    if (!err) void scan(customUrl.trim());
  };

  return (
    <div className="stack ai-finder">
      {desktop ? <GetGemma onConnected={onDone} /> : <p className="muted ai-small ai-m0">The desktop app can download Gemma for you.</p>}

      {desktop ? <h3 id={otherHeadingId} className="ai-m0 ai-section-h">Or use an app you already have</h3> : null}

      <div aria-live="polite" className="ai-status">
        {scanning ? <p className="ai-m0 ai-spin-row"><span className="ai-spinner" aria-hidden="true" /> Looking for AI models on this computer…</p> : null}
        {!scanning && scanError ? <p className="ai-m0 ai-bad">✗ The search failed: {scanError}</p> : null}
        {!scanning && report ? (
          <p className="ai-m0">{models.length ? `Found ${models.length} model${models.length === 1 ? '' : 's'} on this computer.` : 'No AI models were found on this computer.'}</p>
        ) : null}
      </div>

      {!scanning && models.length > 0 ? (
        <div className="stack">
          <div role="radiogroup" aria-label="Models found on this computer" className="ai-models">
            {models.map((m, i) => {
              const size = formatBytes(m.sizeBytes);
              const on = i === selected;
              return (
                <button key={`${m.provider.source}:${m.provider.model}:${i}`} type="button" role="radio" aria-checked={on}
                  className={`ai-model${on ? ' ai-on' : ''}`} onClick={() => setSelected(i)}>
                  <span className="ai-radio" aria-hidden="true">{on ? '●' : '○'}</span>
                  <span className="ai-model-body">
                    <span className="ai-model-title">
                      <strong>{m.provider.label}</strong>
                      {m.isGemma ? <span className="badge">Gemma</span> : null}
                      {i === firstGemma ? <span className="badge ai-badge-rec">Recommended</span> : null}
                    </span>
                    <span className="muted ai-small">
                      {[SOURCE_NAMES[m.provider.source] ?? m.provider.source, m.details, size].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={connect.busy} onClick={() => models[selected] && connectModel(models[selected])}>
              {connect.busy ? 'Connecting…' : 'Use this model'}
            </button>
            {firstGemma < 0 ? <span className="muted ai-small">None of these is Gemma. They may work, but Gemma is what the coach is tuned for.</span> : null}
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="ai-m0">
        {connect.msg && !connect.busy ? <span className={connect.ok ? 'ai-ok' : 'ai-bad'}>{connect.ok ? '✓ ' : '✗ '}{connect.msg}</span> : null}
        {connect.busy ? <span className="muted">{connect.msg}</span> : null}
      </p>

      {!scanning && report && models.length === 0 ? (
        <div className="stack">
          <p className="ai-m0">{desktop
            ? 'If you prefer, install one of these free apps instead, start it, then choose “Check again”.'
            : 'The coach uses a free AI model that runs entirely on your computer, and it isn\'t included with this app. Install one of the options below, start it, then choose “Check again”.'}</p>
          {rec ? (
            <p className="ai-m0 ai-rec"><strong>Suggested for this computer:</strong> {rec.label} <span className="muted">({rec.why})</span></p>
          ) : null}
          <div className="ai-downloads">
            {GEMMA_DOWNLOADS.map((d) => <DownloadCard key={d.id} d={d} />)}
          </div>
        </div>
      ) : null}

      {!scanning && report && report.servers.length > 0 ? (
        <details className="ai-details">
          <summary>Places checked ({found.length} found, {missing.length} not found)</summary>
          <ul className="ai-small">
            {report.servers.map((s, i) => (
              <li key={`${s.source}-${s.baseUrl}-${i}`}>
                {s.reachable ? '✓' : '✗'} {SOURCE_NAMES[s.source] ?? s.source} <span className="muted">{s.baseUrl}</span> — {s.reachable ? 'running' : `not found${s.error ? ` (${s.error})` : ''}`}
              </li>
            ))}
            {report.environment === 'desktop' ? <li>{report.ggufFiles.length ? '✓' : '✗'} Model files on disk (.gguf): {report.ggufFiles.length}{report.ggufFiles.length && !report.llamaServerPath ? ' — llama.cpp server not found to run them' : ''}</li> : null}
          </ul>
        </details>
      ) : null}

      <div className="row">
        <button type="button" className="btn" onClick={() => scan()} disabled={scanning}>{scanning ? 'Checking…' : 'Check again'}</button>
        {variant === 'onboarding' ? <button type="button" className="btn" onClick={onDone}>Skip for now</button> : null}
        {onCancel ? <button type="button" className="btn" onClick={onCancel}>Keep current model</button> : null}
      </div>

      <form className="ai-custom stack" onSubmit={tryCustom} noValidate>
        <label htmlFor={customId}>Use a custom local server</label>
        <div className="row">
          <input id={customId} className="input ai-url" type="url" inputMode="url" placeholder="http://127.0.0.1:8000" value={customUrl}
            aria-invalid={customErr ? true : undefined} aria-describedby={customErr ? `${customId}-err` : undefined}
            onChange={(e: any) => { setCustomUrl(e.target.value); if (customErr) setCustomErr(null); }} />
          <button type="submit" className="btn" disabled={scanning}>Look for models here</button>
        </div>
        {customErr ? <p id={`${customId}-err`} className="ai-m0 ai-bad" role="alert">✗ {customErr}</p> : null}
      </form>

      <p className="muted ai-small ai-m0">
        Everything stays on this device: the app only talks to addresses on this computer. In the web build, local models are reachable when the app is opened as a local file or as the desktop app; the hosted preview can't reach your computer. LM Studio needs CORS turned on in its server settings for the web build.
        {variant === 'onboarding' ? ' AI is optional — every core feature works without it, and you can connect a model later in Settings.' : ''}
      </p>
    </div>
  );
}

function DownloadCard({ d }: { d: DownloadOption }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.command ?? '');
      setCopied('Copied.');
    } catch { setCopied('Could not copy — select the command and copy it by hand.'); }
  };
  const open = async () => {
    setOpenErr(null);
    try { await openExternal(d.url); } catch (e) { setOpenErr(`${errorText(e)} — the address is ${d.url}`); }
  };
  return (
    <article className="card ai-dl">
      <h3 className="ai-m0">{d.title}</h3>
      <p className="ai-m0">{d.summary}</p>
      {d.steps.length ? <ol className="ai-steps">{d.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
      {d.sizeNote ? <p className="muted ai-small ai-m0">{d.sizeNote}</p> : null}
      {d.command ? (
        <div className="ai-cmd-row">
          <code className="ai-cmd">{d.command}</code>
          <button type="button" className="btn ai-sm" onClick={copy} aria-label={`Copy command: ${d.command}`}>Copy</button>
        </div>
      ) : null}
      <span aria-live="polite" className="ai-small">{copied}</span>
      <div className="row">
        <button type="button" className="btn" onClick={open}>Open download page</button>
      </div>
      {openErr ? <p className="ai-m0 ai-bad ai-small" role="alert">✗ {openErr}</p> : null}
    </article>
  );
}
