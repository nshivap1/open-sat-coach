import type { DetectedModel, DetectedServer, DetectionReport, GgufFile, ProviderConfig, ProviderSource } from './types';
import { invokeDesktop, isDesktop, isLoopbackUrl, localRequest } from './transport';

const PROBE_TIMEOUT_MS = 1500;

const SOURCE_ORDER: ProviderSource[] = ['ollama', 'lmstudio', 'llamacpp', 'jan', 'custom', 'app_llama'];
const SOURCE_LABEL: Record<ProviderSource, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
  jan: 'Jan',
  custom: 'Custom server',
  app_llama: 'Model file',
};

interface ProbeOutcome { server: DetectedServer; models: DetectedModel[] }

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isEmbedding(name: string): boolean {
  return /embed/i.test(name);
}

function makeModel(source: ProviderSource, kind: 'ollama' | 'openai_compat', baseUrl: string, name: string, sizeBytes?: number, details?: string): DetectedModel {
  const provider: ProviderConfig = { kind, source, baseUrl, model: name, label: `${SOURCE_LABEL[source]} · ${name}` };
  const m: DetectedModel = { provider, isGemma: /gemma/i.test(name) };
  if (typeof sizeBytes === 'number' && Number.isFinite(sizeBytes)) m.sizeBytes = sizeBytes;
  if (details) m.details = details;
  return m;
}

async function getJson(url: string): Promise<unknown> {
  const res = await localRequest({ method: 'GET', url, timeoutMs: PROBE_TIMEOUT_MS });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} from ${url}`);
  try {
    return JSON.parse(res.body);
  } catch {
    throw new Error(`Unexpected response from ${url}`);
  }
}

function parseOllamaTags(json: unknown, source: ProviderSource, baseUrl: string): DetectedModel[] {
  const list = (json as { models?: unknown })?.models;
  if (!Array.isArray(list)) throw new Error('Unexpected response: no models list');
  const out: DetectedModel[] = [];
  for (const raw of list) {
    const m = raw as { name?: unknown; model?: unknown; size?: unknown; details?: { parameter_size?: unknown; quantization_level?: unknown } };
    const name = typeof m.name === 'string' ? m.name : typeof m.model === 'string' ? m.model : '';
    if (!name || isEmbedding(name)) continue;
    const details = [m.details?.parameter_size, m.details?.quantization_level].filter((x): x is string => typeof x === 'string' && x !== '').join(' · ');
    out.push(makeModel(source, 'ollama', baseUrl, name, typeof m.size === 'number' ? m.size : undefined, details || undefined));
  }
  return out;
}

function parseOpenAiModels(json: unknown, source: ProviderSource, baseUrl: string): DetectedModel[] {
  const list = (json as { data?: unknown })?.data;
  if (!Array.isArray(list)) throw new Error('Unexpected response: no data list');
  const out: DetectedModel[] = [];
  for (const raw of list) {
    const id = (raw as { id?: unknown })?.id;
    if (typeof id !== 'string' || !id || isEmbedding(id)) continue;
    out.push(makeModel(source, 'openai_compat', baseUrl, id));
  }
  return out;
}

async function probeOllama(baseUrl: string, source: ProviderSource): Promise<ProbeOutcome> {
  try {
    const json = await getJson(`${baseUrl}/api/tags`);
    return { server: { source, baseUrl, reachable: true }, models: parseOllamaTags(json, source, baseUrl) };
  } catch (e) {
    return { server: { source, baseUrl, reachable: false, error: errMsg(e) }, models: [] };
  }
}

async function probeOpenAi(baseUrl: string, source: ProviderSource): Promise<ProbeOutcome> {
  try {
    const json = await getJson(`${baseUrl}/v1/models`);
    return { server: { source, baseUrl, reachable: true }, models: parseOpenAiModels(json, source, baseUrl) };
  } catch (e) {
    return { server: { source, baseUrl, reachable: false, error: errMsg(e) }, models: [] };
  }
}

/** Normalizes a user-entered server address to a base URL without a trailing API path. */
function normalizeCustomBase(customUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(customUrl.trim());
  } catch {
    return null;
  }
  let path = u.pathname.replace(/\/+$/, '');
  path = path.replace(/\/(v1\/models|v1\/chat\/completions|v1|api\/tags|api\/chat|api)$/i, '');
  return `${u.protocol}//${u.host}${path}`;
}

async function probeCustom(customUrl: string): Promise<ProbeOutcome> {
  const base = normalizeCustomBase(customUrl);
  if (!base) return { server: { source: 'custom', baseUrl: customUrl, reachable: false, error: 'Not a valid address' }, models: [] };
  if (!isLoopbackUrl(base)) return { server: { source: 'custom', baseUrl: base, reachable: false, error: 'Only local addresses are allowed' }, models: [] };
  const openai = await probeOpenAi(base, 'custom');
  if (openai.server.reachable) return openai;
  const ollama = await probeOllama(base, 'custom');
  if (ollama.server.reachable) return ollama;
  return openai;
}

function rank(m: DetectedModel): [number, number, number] {
  const name = m.provider.model.toLowerCase();
  return [m.isGemma ? 0 : 1, name.includes('e4b') ? 0 : 1, SOURCE_ORDER.indexOf(m.provider.source)];
}

function sortModels(models: DetectedModel[]): DetectedModel[] {
  return [...models].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
}

export async function detectLocalModels(opts?: { customUrl?: string }): Promise<DetectionReport> {
  const desktop = isDesktop();
  const probes: Promise<ProbeOutcome>[] = [
    probeOllama('http://127.0.0.1:11434', 'ollama'),
    probeOpenAi('http://127.0.0.1:1234', 'lmstudio'),
    probeOpenAi('http://127.0.0.1:8080', 'llamacpp'),
    probeOpenAi('http://127.0.0.1:1337', 'jan'),
  ];
  if (opts?.customUrl && opts.customUrl.trim()) probes.push(probeCustom(opts.customUrl));

  const scan: Promise<{ ggufFiles: GgufFile[]; llamaServerPath: string | null }> = desktop
    ? invokeDesktop<{ ggufFiles?: GgufFile[]; llamaServerPath?: string | null }>('scan_models')
        .then((r) => ({ ggufFiles: Array.isArray(r?.ggufFiles) ? r.ggufFiles : [], llamaServerPath: r?.llamaServerPath ?? null }))
        .catch(() => ({ ggufFiles: [], llamaServerPath: null }))
    : Promise.resolve({ ggufFiles: [], llamaServerPath: null });

  const [outcomes, scanned] = await Promise.all([Promise.all(probes), scan]);

  const servers = outcomes.map((o) => o.server);
  const seen = new Set<string>();
  const models: DetectedModel[] = [];
  for (const o of outcomes) {
    for (const m of o.models) {
      const key = `${m.provider.baseUrl}|${m.provider.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      models.push(m);
    }
  }
  for (const f of scanned.ggufFiles) {
    models.push({
      provider: { kind: 'gguf_file', source: 'app_llama', baseUrl: '', model: f.name, filePath: f.path, label: `Model file · ${f.name}` },
      isGemma: /gemma/i.test(f.name),
      sizeBytes: f.sizeBytes,
    });
  }

  const report: DetectionReport = {
    at: Date.now(),
    environment: desktop ? 'desktop' : 'web',
    servers,
    models: sortModels(models),
    ggufFiles: scanned.ggufFiles,
  };
  if (scanned.llamaServerPath) report.llamaServerPath = scanned.llamaServerPath;
  return report;
}
