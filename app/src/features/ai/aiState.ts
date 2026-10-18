import { setState, useAppState } from '../../domain/store';
import type { AiSettings, BenchmarkSummary, DetectionReport, ProviderConfig } from '../../ai/types';
import { ensureRunning } from '../../ai';

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

export function forgetRunning(): void { running = null; }

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
