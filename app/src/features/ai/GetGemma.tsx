import { useEffect, useId, useRef, useState } from 'react';
import { GEMMA_FILES, recommendedGemmaFile, downloadGemma, cancelGemmaDownload, listAppModels, deleteAppModel, isDesktop, invokeDesktop, ping } from '../../ai';
import type { DownloadProgress, GemmaFile, GgufFile, PingResult, ProviderConfig } from '../../ai/types';
import { saveProvider, readyProvider, forgetRunning, errorText } from './aiState';
import './ai.css';

// One-click "Get Gemma" for the desktop app: download a Gemma 4 .gguf into the app's models folder,
// then run it with the app-managed llama.cpp server. Renders nothing in the web build.

const GB = 1e9; // decimal GB, matching the sizes shown on Hugging Face
const gb = (n: number) => (n / GB).toFixed(1);
const START_WAIT_MS = 60_000;

function speedText(bps: number): string | null {
  if (!bps || bps <= 0) return null;
  return bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} MB/s` : `${Math.max(1, Math.round(bps / 1e3))} KB/s`;
}

function timeLeftText(p: DownloadProgress): string | null {
  if (!p.bytesPerSec || p.bytesPerSec <= 0 || !p.totalBytes) return null;
  const s = Math.max(0, (p.totalBytes - p.receivedBytes) / p.bytesPerSec);
  if (s < 60) return 'less than a minute left';
  const m = Math.round(s / 60);
  if (m < 60) return `about ${m} min left`;
  return `about ${Math.floor(m / 60)} h ${m % 60} min left`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = 'loading' | 'idle' | 'downloading' | 'connecting' | 'deleting';
interface Failure { msg: string; retry: 'download' | 'connect' | 'delete'; file: GemmaFile; path?: string }

export function GetGemma({ onConnected }: { onConnected(): void }) {
  return isDesktop() ? <GetGemmaCard onConnected={onConnected} /> : null;
}

function GetGemmaCard({ onConnected }: { onConnected(): void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [memory, setMemory] = useState<number | null>(null);
  const [models, setModels] = useState<GgufFile[]>([]);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<GemmaFile['id']>(recommendedGemmaFile(null).id);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [pausedName, setPausedName] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [announce, setAnnounce] = useState('');
  const alive = useRef(true);
  const cancelRequested = useRef(false);
  const milestone = useRef(0);
  const titleId = useId();
  const groupId = useId();

  useEffect(() => {
    alive.current = true;
    (async () => {
      const [info, list, scan] = await Promise.all([
        invokeDesktop<{ totalMemoryBytes: number | null }>('device_info').catch(() => null),
        listAppModels().catch(() => [] as GgufFile[]),
        invokeDesktop<{ llamaServerPath?: string | null }>('scan_models').catch(() => null),
      ]);
      if (!alive.current) return;
      const mem = info?.totalMemoryBytes ?? null;
      const rec = recommendedGemmaFile(mem);
      const have = GEMMA_FILES.filter((f) => list.some((m) => m.name === f.fileName));
      setMemory(mem);
      setModels(list);
      setRuntime(scan?.llamaServerPath ?? null);
      setSelectedId((have.find((f) => f.id === rec.id) ?? have[0] ?? rec).id);
      setPhase('idle');
    })();
    return () => { alive.current = false; };
  }, []);

  const rec = recommendedGemmaFile(memory);
  const selected = GEMMA_FILES.find((f) => f.id === selectedId) ?? rec;
  const downloaded = (f: GemmaFile) => models.find((m) => m.name === f.fileName);
  const partial = (f: GemmaFile) => pausedName === f.fileName || models.some((m) => m.name === `${f.fileName}.part`);
  const busy = phase !== 'idle';
  const memGiB = memory ? Math.round(memory / 1024 ** 3) : null;
  const lowMemory = memGiB !== null && memGiB < selected.minMemoryGiB;
  const have = downloaded(selected);

  const refreshModels = async () => {
    const list = await listAppModels().catch(() => null);
    if (list && alive.current) setModels(list);
  };

  const findRuntime = async (): Promise<string | null> => {
    if (runtime) return runtime;
    const scan = await invokeDesktop<{ llamaServerPath?: string | null }>('scan_models').catch(() => null);
    const found = scan?.llamaServerPath ?? null;
    if (alive.current) setRuntime(found);
    return found;
  };

  const connect = async (file: GemmaFile, path: string) => {
    setFailure(null);
    setConfirmDelete(false);
    const rt = await findRuntime();
    if (!alive.current) return;
    if (!rt) {
      setPhase('idle');
      setAnnounce(`${file.label} is downloaded. Install the llama.cpp runtime (see the steps above), then choose “Use the downloaded Gemma”.`);
      return;
    }
    setPhase('connecting');
    setAnnounce('Starting Gemma… the first start can take up to a minute.');
    const provider: ProviderConfig = {
      kind: 'gguf_file', source: 'app_llama', baseUrl: '', model: file.fileName, filePath: path, label: `Gemma in this app · ${file.label}`,
    };
    try {
      const live = await readyProvider(provider);
      // llama-server may still be loading the model: keep asking for up to a minute.
      const deadline = Date.now() + START_WAIT_MS;
      let res: PingResult = await ping(live);
      while (!res.ok && Date.now() < deadline && alive.current) {
        await sleep(2000);
        res = await ping(live);
      }
      if (!alive.current) return;
      if (!res.ok) {
        forgetRunning();
        setPhase('idle');
        setAnnounce('');
        setFailure({ msg: `Gemma started but did not answer: ${res.error ?? 'no response'}.`, retry: 'connect', file, path });
        return;
      }
      saveProvider(provider); // the gguf_file config, so the app can start Gemma again on the next launch
      setPhase('idle');
      setAnnounce(`Connected. Gemma answered in ${Math.round(res.ms)} ms.`);
      onConnected();
    } catch (e) {
      forgetRunning();
      if (!alive.current) return;
      setPhase('idle');
      setAnnounce('');
      setFailure({ msg: `Could not start Gemma: ${errorText(e)}`, retry: 'connect', file, path });
    }
  };

  const onProgress = (p: DownloadProgress) => {
    if (!alive.current) return;
    setProgress(p);
    if (p.stage === 'verifying' && milestone.current < 100) {
      milestone.current = 100;
      setAnnounce('Download finished. Checking the file…');
    } else if (p.stage === 'downloading' && p.totalBytes > 0) {
      const step = Math.floor((p.receivedBytes / p.totalBytes) * 4) * 25;
      if (step > milestone.current && step < 100) {
        milestone.current = step;
        setAnnounce(`${step}% downloaded.`);
      }
    }
  };

  const startDownload = async (file: GemmaFile) => {
    const resuming = partial(file);
    cancelRequested.current = false;
    milestone.current = 0;
    setFailure(null);
    setCancelling(false);
    setConfirmDelete(false);
    setPhase('downloading');
    setProgress({ fileName: file.fileName, receivedBytes: 0, totalBytes: file.sizeBytes, bytesPerSec: 0, stage: 'downloading' });
    setAnnounce(resuming ? `Resuming the ${file.label} download.` : `Downloading ${file.label}.`);
    let path: string;
    try {
      path = await downloadGemma(file, onProgress);
    } catch (e) {
      if (!alive.current) return;
      setCancelling(false);
      setPhase('idle');
      if (cancelRequested.current) {
        setPausedName(file.fileName);
        setAnnounce('Download paused. The part already downloaded is kept.');
      } else {
        setAnnounce('');
        setFailure({ msg: `The download stopped: ${errorText(e)}`, retry: 'download', file });
      }
      void refreshModels();
      return;
    }
    if (!alive.current) return;
    setPausedName(null);
    setCancelling(false);
    setAnnounce('Download complete.');
    await refreshModels();
    await connect(file, path);
  };

  const cancel = async () => {
    cancelRequested.current = true;
    setCancelling(true);
    setAnnounce('Pausing the download…');
    try {
      await cancelGemmaDownload();
    } catch (e) {
      cancelRequested.current = false;
      if (!alive.current) return;
      setCancelling(false);
      setAnnounce(`Could not cancel: ${errorText(e)}`);
    }
  };

  const remove = async (file: GemmaFile) => {
    setConfirmDelete(false);
    setFailure(null);
    setPhase('deleting');
    try {
      await deleteAppModel(file.fileName);
      await refreshModels();
      if (!alive.current) return;
      setAnnounce(`${file.label} was deleted from this computer.`);
    } catch (e) {
      if (!alive.current) return;
      setFailure({ msg: `Could not delete the file: ${errorText(e)}`, retry: 'delete', file });
    } finally {
      if (alive.current) setPhase('idle');
    }
  };

  const retry = () => {
    const f = failure;
    if (!f) return;
    if (f.retry === 'download') void startDownload(f.file);
    else if (f.retry === 'connect' && f.path) void connect(f.file, f.path);
    else if (f.retry === 'delete') void remove(f.file);
  };

  const choose = (id: GemmaFile['id']) => {
    if (busy) return;
    setSelectedId(id);
    setConfirmDelete(false);
    setFailure(null);
  };

  const onGroupKey = (e: any) => {
    if (busy) return;
    const n = GEMMA_FILES.length;
    let i = GEMMA_FILES.findIndex((f) => f.id === selected.id);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i = (i + 1) % n;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i = (i - 1 + n) % n;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else return;
    e.preventDefault();
    const id = GEMMA_FILES[i].id;
    choose(id);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-gemma="${id}"]`)?.focus();
  };

  const pct = progress && progress.totalBytes > 0 ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100)) : 0;
  const downloadingFile = progress ? GEMMA_FILES.find((f) => f.fileName === progress.fileName) ?? selected : selected;
  const verifying = progress?.stage === 'verifying';
  const speed = progress && !verifying ? speedText(progress.bytesPerSec) : null;
  const left = progress && !verifying ? timeLeftText(progress) : null;

  return (
    <section className="card ai-gg" aria-labelledby={titleId} aria-busy={busy || undefined}>
      <p className="ai-eyebrow ai-m0">Easiest way · no other apps needed</p>
      <h3 id={titleId} className="ai-m0">Get Gemma for this app (recommended)</h3>
      <p className="ai-m0">Gemma is a free model from Google (Apache-2.0 license) that runs entirely on this computer, so your questions never leave it.</p>

      {phase === 'loading' ? (
        <p className="ai-m0 ai-spin-row"><span className="ai-spinner" aria-hidden="true" /> Checking this computer…</p>
      ) : (
        <>
          {!runtime ? (
            <div className="ai-note">
              <p className="ai-m0"><strong>Note:</strong> this build of the app doesn't include the llama.cpp runtime that runs Gemma. You can still download Gemma now. To run it, do one of these, then come back here:</p>
              <ul className="ai-steps">
                <li>Re-run <code className="ai-cmd">scripts/setup-mac.sh</code> to rebuild the app with the runtime.</li>
                <li>Or install it with Homebrew: <code className="ai-cmd">brew install llama.cpp</code></li>
                <li>Or use the Ollama option below instead.</li>
              </ul>
            </div>
          ) : null}

          <p id={groupId} className="ai-m0 ai-gg-label">Choose a size{memGiB !== null ? <span className="muted ai-small"> — this computer has about {memGiB} GB of memory</span> : null}</p>
          <div role="radiogroup" aria-labelledby={groupId} aria-disabled={busy || undefined} className="ai-models" onKeyDown={onGroupKey}>
            {GEMMA_FILES.map((f) => {
              const on = f.id === selected.id;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-gemma={f.id}
                  aria-disabled={busy || undefined} className={`ai-model${on ? ' ai-on' : ''}${busy ? ' ai-locked' : ''}`} onClick={() => choose(f.id)}>
                  <span className="ai-radio" aria-hidden="true">{on ? '●' : '○'}</span>
                  <span className="ai-model-body">
                    <span className="ai-model-title">
                      <strong>{f.label}</strong>
                      <span className="muted">{gb(f.sizeBytes)} GB</span>
                      {f.id === rec.id ? <span className="badge ai-badge-rec">{memory ? 'Best for this computer' : 'Suggested'}</span> : null}
                      {downloaded(f) ? <span className="badge ai-badge-ok">✓ Downloaded</span> : null}
                    </span>
                    <span className="muted ai-small">{f.note}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {lowMemory ? (
            <p className="ai-m0 ai-note ai-note-warn">
              <strong>Heads up:</strong> {selected.label} works best with {selected.minMemoryGiB} GB of memory or more, and this computer has about {memGiB} GB. It may run slowly{selected.id !== rec.id ? `; ${rec.label} should feel faster` : ''}.
            </p>
          ) : null}

          {phase === 'downloading' && progress ? (
            <div className="ai-gg-progress">
              <div className="ai-bar" role="progressbar" aria-label={`Downloading ${downloadingFile.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                aria-valuetext={verifying ? 'Checking the file' : `${pct}%, ${gb(progress.receivedBytes)} of ${gb(progress.totalBytes)} GB`}>
                <span className="ai-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="ai-m0 ai-small">
                {verifying
                  ? `Checking the file (${gb(progress.totalBytes)} GB)…`
                  : [`${pct}%`, `${gb(progress.receivedBytes)} of ${gb(progress.totalBytes)} GB`, speed, left].filter(Boolean).join(' · ')}
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={cancel} disabled={cancelling || verifying}>{cancelling ? 'Pausing…' : 'Cancel'}</button>
                <span className="muted ai-small">Cancelling keeps what is already downloaded.</span>
              </div>
            </div>
          ) : (
            <div className="stack ai-gg-actions">
              <div className="row">
                {have ? (
                  <>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => connect(selected, have.path)}>
                      {phase === 'connecting' ? 'Starting Gemma…' : 'Use the downloaded Gemma'}
                    </button>
                    <button type="button" className="ai-link" disabled={busy} onClick={() => setConfirmDelete(true)} aria-label={`Delete the downloaded ${selected.label} file`}>
                      {phase === 'deleting' ? 'Deleting…' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => startDownload(selected)}>
                    {phase === 'connecting' ? 'Starting Gemma…' : partial(selected) ? 'Resume download' : `Download Gemma (${gb(selected.sizeBytes)} GB)`}
                  </button>
                )}
              </div>
              {!have ? <p className="muted ai-small ai-m0">Needs about {Math.ceil(selected.sizeBytes / GB)} GB of free space.</p> : null}
              {confirmDelete && have ? (
                <div className="ai-note" role="group" aria-label="Confirm delete">
                  <p className="ai-m0">Delete {selected.label} ({gb(selected.sizeBytes)} GB) from this computer? You can download it again later.</p>
                  <div className="row">
                    <button type="button" className="btn ai-danger" onClick={() => remove(selected)}>Yes, delete</button>
                    <button type="button" className="btn" autoFocus onClick={() => setConfirmDelete(false)}>Keep it</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {failure ? (
            <div className="ai-gg-error">
              <p className="ai-m0 ai-bad" role="alert">✗ {failure.msg}</p>
              <button type="button" className="btn ai-sm" onClick={retry} disabled={busy}>Retry</button>
            </div>
          ) : null}
        </>
      )}

      <p aria-live="polite" className="ai-m0 ai-small ai-gg-live">
        {phase === 'connecting' ? <span className="ai-spinner ai-inline-spinner" aria-hidden="true" /> : null}
        {announce}
      </p>
    </section>
  );
}
