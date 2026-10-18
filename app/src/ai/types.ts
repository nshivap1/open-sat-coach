// AI layer contract. The model is NOT bundled: the app connects to a local installation
// (Ollama, LM Studio, llama.cpp server, Jan, any OpenAI-compatible server on this machine)
// or runs a local .gguf file with llama-server (desktop only). Loopback addresses only — never the cloud.

export type ProviderKind = 'ollama' | 'openai_compat' | 'gguf_file';
export type ProviderSource = 'ollama' | 'lmstudio' | 'llamacpp' | 'jan' | 'custom' | 'app_llama';

export interface ProviderConfig {
  kind: ProviderKind;
  source: ProviderSource;
  label: string;            // e.g. 'Ollama · gemma4:e4b'
  baseUrl: string;          // loopback only, e.g. 'http://127.0.0.1:11434'; '' for gguf_file before start
  model: string;            // model id/tag as the server names it (gguf_file: file name)
  filePath?: string;        // gguf_file: absolute path on disk (desktop)
  apiKey?: string;          // per-launch token for the app-managed llama-server; never persisted
}

export interface DetectedServer {
  source: ProviderSource;
  baseUrl: string;
  reachable: boolean;
  error?: string;
}

export interface DetectedModel {
  provider: ProviderConfig;
  isGemma: boolean;
  sizeBytes?: number;
  details?: string;         // quantization / parameter size if the server reports it
}

export interface GgufFile { path: string; name: string; sizeBytes: number }

export interface DetectionReport {
  at: number;
  environment: 'desktop' | 'web';
  servers: DetectedServer[];
  models: DetectedModel[];  // from reachable servers + gguf files (desktop), Gemma first
  ggufFiles: GgufFile[];    // desktop only
  llamaServerPath?: string; // desktop only: binary able to run gguf files
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatOptions {
  jsonSchema?: Record<string, unknown>; // constrain output to this JSON schema when the server supports it
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatResult { text: string; json?: unknown; ms: number; tokens?: number }

export interface PingResult { ok: boolean; ms: number; model?: string; error?: string }

export interface CoachReply {
  text: string;             // short explanation in plain language
  steps?: string[];
  takeaway?: string;
  ms: number;
  status: 'unverified';     // FR-09: AI explanations are provisional until a verification pipeline exists
}

export interface CoachTurn { role: 'student' | 'coach'; text: string }

export interface BenchmarkRow {
  itemId: string; skillId: string; expected: string; answer: string | null;
  correct: boolean; ms: number; predictedSkillId?: string; error?: string;
}

export interface BenchmarkSummary {
  at: number;
  providerLabel: string;
  items: number;
  answered: number;          // valid parsed answers
  correct: number;
  accuracy: number;          // correct / answered
  coverage: number;          // answered / items
  p50Ms: number;
  p95Ms: number;
  classifyAccuracy?: number; // predicted skill == item skill
  device?: string;
}

export interface BenchmarkResult extends BenchmarkSummary { rows: BenchmarkRow[] }

export interface DownloadOption {
  id: 'ollama' | 'lmstudio' | 'gguf';
  title: string;
  summary: string;
  url: string;               // https page opened in the system browser
  command?: string;          // e.g. 'ollama pull gemma4:e4b'
  steps: string[];
  sizeNote?: string;
}

export interface AiSettings {
  enabled: boolean;
  provider?: ProviderConfig;     // apiKey stripped before persisting
  lastDetection?: DetectionReport;
  lastBenchmark?: BenchmarkSummary;
}

// ---- Desktop (Tauri) command contract — implemented in src-tauri/src/lib.rs ----
// JS calls use camelCase argument names; Rust receives snake_case.
//   invoke('load_state') -> string | null
//   invoke('save_state', { json: string }) -> void
//   invoke('http_local', { req: { method, url, headers: Record<string,string>, body?: string, timeoutMs: number } })
//        -> { status: number, body: string }        (rejects non-loopback hosts)
//   invoke('scan_models') -> { ggufFiles: GgufFile[], llamaServerPath: string | null }
//   invoke('start_llama', { modelPath: string, ctxSize?: number }) -> { port: number, token: string, pid: number }
//   invoke('stop_llama') -> void
//   invoke('llama_status') -> { running: boolean, port: number | null, modelPath: string | null }
//   invoke('device_info') -> { os: string, arch: string, totalMemoryBytes: number | null, cpu: string | null }
//   invoke('open_external', { url: string }) -> void  (https only)
