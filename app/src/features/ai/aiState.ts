import { getState, setState, useAppState } from '../../domain/store';
import type { AiSettings, BenchmarkSummary, DetectionReport, JudgeSettings, ProviderConfig } from '../../ai/types';
import { ensureRunning, resolveJudge } from '../../ai';

// Persist the chosen local model. The per-launch apiKey is never written to storage.
export function saveProvider(p: ProviderConfig): void {
  const { apiKey: _drop, ...rest } = p;
  setState((s) => ({ ...s, ai: { ...(s.ai ?? { enabled: true }), enabled: true, provider: rest } }));
}

export function disableAi(): void {
  setState((s) => ({ ...s, ai: { ...(s.ai ?? { enabled: false }), enabled: false, provider: undefined, lastBenchmark: undefined } }));
}

export function saveDetection(report: DetectionReport): void {
  setState((s) => ({ ...s, ai: { ...(s.ai ?? { enabled: false }), lastDetection: report } }));
}

export function saveBenchmark(summary: BenchmarkSummary): void {
  setState((s) => ({ ...s, ai: { ...(s.ai ?? { enabled: true }), lastBenchmark: summary } }));
}

export function useAiSettings(): AiSettings | undefined {
  return useAppState((s) => s.ai);
}

export function useAiProvider(): ProviderConfig | undefined {
  return useAppState((s) => (s.ai?.enabled ? s.ai.provider : undefined));
}

// Started/running copy of a provider (app-managed llama-server gets a port + per-launch token).
// Kept in memory only.
let running: { key: string; p: ProviderConfig } | null = null;
const keyOf = (p: ProviderConfig) => `${p.kind}|${p.source}|${p.baseUrl}|${p.model}|${p.filePath ?? ''}`;

export async function readyProvider(p: ProviderConfig): Promise<ProviderConfig> {
  const key = keyOf(p);
  if (running && running.key === key) return running.p;
  const started = await ensureRunning(p);
  running = { key, p: started };
  return started;
}

export function forgetRunning(): void { running = null; runningJudge = null; }

// ---- AI judge settings ----
export const DEFAULT_JUDGE: JudgeSettings = { enabled: true, autoRepair: true };

export function useJudgeSettings(): JudgeSettings {
  const j = useAppState((s) => s.ai?.judge);
  return { ...DEFAULT_JUDGE, ...(j ?? {}) };
}

// Persist judge settings. A judge provider's per-launch apiKey is never written to storage.
export function saveJudgeSettings(patch: Partial<JudgeSettings>): void {
  setState((s) => {
    const next: JudgeSettings = { ...DEFAULT_JUDGE, ...(s.ai?.judge ?? {}), ...patch };
    if ('provider' in patch && !patch.provider) delete next.provider;
    if (next.provider) { const { apiKey: _drop, ...rest } = next.provider; next.provider = rest; }
    return { ...s, ai: { ...(s.ai ?? { enabled: true }), judge: next } };
  });
}

// Started copy of a separate judge model, kept apart from the coach's so neither evicts the other.
let runningJudge: { key: string; p: ProviderConfig } | null = null;

/** The judge for a started coach: null provider when the judge is off. Same-model judging reuses the coach. */
export async function readyJudge(coachLive: ProviderConfig): Promise<{ provider: ProviderConfig | null; sameModel: boolean; label: string }> {
  const settings: JudgeSettings = { ...DEFAULT_JUDGE, ...(getState().ai?.judge ?? {}) };
  let chosen = settings;
  // The app-managed llama-server runs one model file at a time: a second file can't judge alongside the coach's file.
  if (settings.provider?.kind === 'gguf_file' && coachLive.kind === 'gguf_file' && (settings.provider.filePath ?? settings.provider.model) !== (coachLive.filePath ?? coachLive.model)) {
    chosen = { ...settings, provider: undefined };
  }
  const r = resolveJudge(coachLive, chosen);
  if (!r.provider) return { provider: null, sameModel: r.sameModel, label: r.label };
  if (r.sameModel) return { provider: coachLive, sameModel: true, label: r.label };
  const key = keyOf(r.provider);
  if (runningJudge && runningJudge.key === key) return { provider: runningJudge.p, sameModel: false, label: r.label };
  const started = await ensureRunning(r.provider);
  runningJudge = { key, p: started };
  return { provider: started, sameModel: false, label: r.label };
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Returns an error message for anything that is not an http(s) URL on this computer, else null.
export function localUrlError(url: string): string | null {
  const v = url.trim();
  if (!v) return 'Enter the address of the server, for example http://127.0.0.1:8000.';
  let u: URL;
  try { u = new URL(v); } catch { return 'That is not a valid address. Include http://, for example http://127.0.0.1:8000.'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Use an address that starts with http:// or https://.';
  if (u.username || u.password) return 'Remove the user name or password from the address.';
  if (!LOOPBACK.has(u.hostname.toLowerCase())) return 'Only servers on this computer are allowed (localhost or 127.0.0.1). Nothing is sent to other machines.';
  return null;
}

export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') return 'Cancelled.';
  const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
  return msg || 'Unknown error';
}

export function formatBytes(n?: number): string | null {
  if (!n || n <= 0) return null;
  const gb = n / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(n / 1024 ** 2)} MB`;
}

export const SOURCE_NAMES: Record<string, string> = {
  ollama: 'Ollama', lmstudio: 'LM Studio', llamacpp: 'llama.cpp server', jan: 'Jan', custom: 'Custom local server', app_llama: 'Model file on disk',
};
